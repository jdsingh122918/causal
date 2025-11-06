//! # Encryption Module for Secure Settings Storage
//!
//! This module provides secure encryption and decryption capabilities for storing
//! sensitive data like API keys in the SQLite database. It uses ChaCha20-Poly1305
//! for encryption and Argon2 for key derivation.
//!
//! ## Security Features
//!
//! - **ChaCha20-Poly1305**: Modern AEAD cipher for encryption
//! - **Argon2**: Memory-hard key derivation function
//! - **Random Salt**: Unique salt per value for protection against rainbow tables
//! - **Device Entropy**: Uses device-specific entropy for additional security

use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use base64::prelude::*;
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use rand::RngCore;

/// Error types for encryption operations
#[derive(thiserror::Error, Debug)]
pub enum EncryptionError {
    #[error("Failed to encrypt data: {0}")]
    EncryptionFailed(String),

    #[error("Failed to decrypt data: {0}")]
    DecryptionFailed(String),

    #[error("Failed to derive key: {0}")]
    KeyDerivationFailed(String),

    #[error("Invalid encrypted data format")]
    InvalidData,
}

/// Encrypted data container with salt for storage
#[derive(Debug, Clone)]
pub struct EncryptedData {
    pub encrypted_value: Vec<u8>,
    pub salt: Vec<u8>,
}

/// Secure settings encryption manager
///
/// This struct handles encryption/decryption of sensitive settings data
/// using a combination of device entropy and user-specific data.
pub struct SettingsEncryption {
    device_entropy: [u8; 32],
}

impl SettingsEncryption {
    /// Create a new settings encryption instance
    ///
    /// Uses deterministic device-specific entropy for key derivation to ensure
    /// consistency across application restarts.
    pub fn new() -> Result<Self, EncryptionError> {
        let mut device_entropy = [0u8; 32];

        // Generate deterministic device-specific entropy
        // This ensures the same entropy is generated every time for this device
        let device_string = Self::get_device_identifier();
        let device_bytes = device_string.as_bytes();

        // Create deterministic entropy by hashing the device identifier
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        device_bytes.hash(&mut hasher);
        let hash = hasher.finish();

        // Fill entropy array with deterministic but unique data
        for (i, chunk) in device_entropy.chunks_mut(8).enumerate() {
            let mut local_hasher = DefaultHasher::new();
            (hash, i).hash(&mut local_hasher);
            let chunk_hash = local_hasher.finish();
            let bytes = chunk_hash.to_le_bytes();
            let copy_len = chunk.len().min(bytes.len());
            chunk[..copy_len].copy_from_slice(&bytes[..copy_len]);
        }

        Ok(Self { device_entropy })
    }

    /// Get a device identifier for consistent entropy generation
    fn get_device_identifier() -> String {
        // Create a deterministic device identifier
        // This combines multiple device-specific elements for uniqueness
        let mut identifier = String::new();

        // Add OS information
        identifier.push_str(&std::env::consts::OS);
        identifier.push_str("-");
        identifier.push_str(&std::env::consts::ARCH);
        identifier.push_str("-");

        // Add current user information (if available)
        if let Ok(username) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
            identifier.push_str(&username);
        } else {
            identifier.push_str("unknown-user");
        }
        identifier.push_str("-");

        // Add a constant application identifier
        identifier.push_str("causal-app-v2");

        identifier
    }

    /// Derive encryption key from device entropy and salt
    ///
    /// Uses Argon2 for key derivation with the device entropy as the password
    /// and the provided salt for uniqueness per encrypted value.
    fn derive_key(&self, salt: &[u8]) -> Result<[u8; 32], EncryptionError> {
        let argon2 = Argon2::default();

        // Convert salt to SaltString format required by argon2
        // Use B64 encoding without padding for compatibility
        let salt_b64 = base64::prelude::BASE64_STANDARD_NO_PAD.encode(salt);
        let salt_str = SaltString::from_b64(&salt_b64)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

        // Derive key using Argon2
        let password_hash = argon2
            .hash_password(&self.device_entropy, &salt_str)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

        // Extract the first 32 bytes for ChaCha20 key
        let hash = password_hash.hash.unwrap();
        let hash_bytes = hash.as_bytes();
        if hash_bytes.len() < 32 {
            return Err(EncryptionError::KeyDerivationFailed(
                "Derived hash too short".to_string()
            ));
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&hash_bytes[..32]);
        Ok(key)
    }

    /// Encrypt a plaintext value
    ///
    /// Returns encrypted data with a unique salt for storage in the database.
    pub fn encrypt(&self, plaintext: &str) -> Result<EncryptedData, EncryptionError> {
        // Generate random salt
        let mut salt = [0u8; 16];
        OsRng.fill_bytes(&mut salt);

        // Derive key from device entropy and salt
        let key_bytes = self.derive_key(&salt)?;
        let key: &Key = (&key_bytes[..32]).into();

        // Create cipher and generate nonce
        let cipher = ChaCha20Poly1305::new(key);
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);

        // Encrypt the plaintext
        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // Prepend nonce to ciphertext for storage
        let mut encrypted_value = Vec::new();
        encrypted_value.extend_from_slice(&nonce);
        encrypted_value.extend_from_slice(&ciphertext);

        Ok(EncryptedData {
            encrypted_value,
            salt: salt.to_vec(),
        })
    }

    /// Decrypt an encrypted value
    ///
    /// Takes encrypted data with salt and returns the original plaintext.
    pub fn decrypt(&self, encrypted_data: &EncryptedData) -> Result<String, EncryptionError> {
        if encrypted_data.encrypted_value.len() < 12 {
            return Err(EncryptionError::InvalidData);
        }

        // Derive key from device entropy and stored salt
        let key_bytes = self.derive_key(&encrypted_data.salt)?;
        let key: &Key = (&key_bytes[..32]).into();

        // Extract nonce and ciphertext
        let (nonce_bytes, ciphertext) = encrypted_data.encrypted_value.split_at(12);
        let nonce: &Nonce = nonce_bytes.into();

        // Create cipher and decrypt
        let cipher = ChaCha20Poly1305::new(key);
        let plaintext_bytes = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        // Convert back to string
        String::from_utf8(plaintext_bytes)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))
    }
}

impl Default for SettingsEncryption {
    fn default() -> Self {
        Self::new().expect("Failed to create settings encryption")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let encryption = SettingsEncryption::new().unwrap();
        let plaintext = "test-api-key-123";

        let encrypted = encryption.encrypt(plaintext).unwrap();
        let decrypted = encryption.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_different_salts_produce_different_ciphertext() {
        let encryption = SettingsEncryption::new().unwrap();
        let plaintext = "same-api-key";

        let encrypted1 = encryption.encrypt(plaintext).unwrap();
        let encrypted2 = encryption.encrypt(plaintext).unwrap();

        // Same plaintext with different salts should produce different ciphertext
        assert_ne!(encrypted1.encrypted_value, encrypted2.encrypted_value);
        assert_ne!(encrypted1.salt, encrypted2.salt);

        // But both should decrypt to the same plaintext
        assert_eq!(encryption.decrypt(&encrypted1).unwrap(), plaintext);
        assert_eq!(encryption.decrypt(&encrypted2).unwrap(), plaintext);
    }

    #[test]
    fn test_multiple_keys() {
        let encryption = SettingsEncryption::new().unwrap();

        let assembly_key = "test-assembly-key";
        let claude_key = "test-claude-key";

        let encrypted_assembly = encryption.encrypt(assembly_key).unwrap();
        let encrypted_claude = encryption.encrypt(claude_key).unwrap();

        let decrypted_assembly = encryption.decrypt(&encrypted_assembly).unwrap();
        let decrypted_claude = encryption.decrypt(&encrypted_claude).unwrap();

        assert_eq!(assembly_key, decrypted_assembly);
        assert_eq!(claude_key, decrypted_claude);
    }
}