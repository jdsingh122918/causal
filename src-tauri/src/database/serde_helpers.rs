use serde::{Deserialize, Deserializer, Serializer};
use std::time::{SystemTime, UNIX_EPOCH};

/// Serialize SystemTime as Unix timestamp (seconds since epoch)
pub fn serialize<S>(time: &SystemTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let duration = time
        .duration_since(UNIX_EPOCH)
        .map_err(serde::ser::Error::custom)?;
    serializer.serialize_u64(duration.as_secs())
}

/// Deserialize Unix timestamp to SystemTime
pub fn deserialize<'de, D>(deserializer: D) -> Result<SystemTime, D::Error>
where
    D: Deserializer<'de>,
{
    let secs = u64::deserialize(deserializer)?;
    Ok(UNIX_EPOCH + std::time::Duration::from_secs(secs))
}
