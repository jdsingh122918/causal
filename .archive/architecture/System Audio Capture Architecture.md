---
title: System Audio Capture Architecture
type: note
permalink: architecture/system-audio-capture-architecture
---

# System Audio Capture Architecture

## Overview
The Causal application will capture system-level audio (both microphone and loopback/system audio) using native OS APIs through Rust, enabling transcription of any audio playing on the device.

## Platform-Specific Approaches

### macOS
- **API**: ScreenCaptureKit (macOS 12.3+)
- **Library**: cpal with ScreenCaptureKit support (PR #894)
- **Permissions**: Screen Recording permission required
- **Capabilities**: Can capture system audio output (speakers/loopback)

### Windows
- **API**: WASAPI (Windows Audio Session API)
- **Library**: `wasapi` crate or cpal with WASAPI backend
- **Loopback**: `AUDCLNT_STREAMFLAGS_LOOPBACK` flag
- **Permissions**: No special permissions needed

### Linux
- **API**: PulseAudio/PipeWire via JACK protocol
- **Library**: `jack` crate or `alsa` crate
- **Loopback**: Configure monitor source in PulseAudio/PipeWire
- **Permissions**: Varies by distro

## Architecture Components

### 1. Audio Capture Layer (Rust)
- Device enumeration (list available input/output devices)
- Audio stream management (start/stop capture)
- Format conversion (resample to 16kHz, convert to mono PCM)
- Buffer management (circular buffer for smooth streaming)

### 2. AssemblyAI Integration Layer (Rust)
- WebSocket client for real-time streaming
- Temporary token generation
- Audio data encoding (PCM to base64)
- Transcript result parsing

### 3. State Management (Rust)
- Active capture session state
- Device configuration
- API credentials
- Connection status

### 4. Tauri Commands
- `list_audio_devices()` → Get available devices
- `start_capture(device_id, api_key)` → Begin capture session
- `stop_capture()` → End capture session
- `get_capture_status()` → Current state

### 5. Events (Rust → Frontend)
- `transcript-partial` → Interim results
- `transcript-final` → Final utterance
- `capture-error` → Error states
- `capture-status` → Status updates

### 6. Frontend UI
- Device selector dropdown
- Capture controls (start/stop)
- Real-time transcript display
- Status indicators

## Audio Flow

```
OS Audio Sources (Mic/System)
  ↓
Native Audio API (ScreenCaptureKit/WASAPI/JACK)
  ↓
Rust Audio Capture (cpal/wasapi/jack)
  ↓
Format Conversion (16kHz, 16-bit, mono PCM)
  ↓
AssemblyAI WebSocket (base64 encoded)
  ↓
Transcription Results
  ↓
Tauri Events
  ↓
Frontend Display
```

## Key Design Decisions

1. **Use cpal as primary library**: Cross-platform, pure Rust, good community support
2. **Fallback to platform-specific crates**: Use `wasapi` directly on Windows if needed
3. **Async runtime**: Tokio for handling concurrent audio streaming and WebSocket
4. **Buffer size**: ~100ms chunks (1600 samples at 16kHz)
5. **Thread model**: Dedicated thread for audio capture, async task for WebSocket

## Permissions Required

### macOS
- Microphone access (for mic input)
- Screen Recording permission (for system audio via ScreenCaptureKit)

### Windows
- Microphone access (for mic input)
- No additional permissions for system audio loopback

### Linux
- Audio device access
- May need to add user to `audio` group

## Dependencies

### Cargo.toml
```toml
cpal = "0.15"  # Cross-platform audio I/O
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"  # WebSocket
futures-util = "0.3"
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
base64 = "0.21"

# Platform-specific (optional fallbacks)
[target.'cfg(target_os = "windows")'.dependencies]
wasapi = "0.13"

[target.'cfg(target_os = "linux")'.dependencies]
jack = "0.11"
```

## Error Handling

- Device not found/unavailable
- Permission denied
- Audio format not supported
- WebSocket connection failures
- API authentication errors
- Buffer overflow/underflow

## Performance Considerations

- Use ring buffer to prevent audio dropouts
- Process audio on dedicated thread
- Minimize allocations in audio callback
- Stream audio chunks asynchronously
- Monitor CPU/memory usage during extended sessions
