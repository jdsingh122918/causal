---
title: Threading Fix Implementation - Complete
type: note
permalink: implementation/threading-fix-implementation-complete
---

# Threading Fix Implementation - Complete

## Date: 2025-10-30

## Problem Solved
The `cpal::Stream` on macOS is intentionally NOT `Send`, meaning it cannot be moved between threads. This is a design decision by the cpal library to ensure audio streams stay on the thread where they were created.

## Solution Implemented

### 1. Dedicated Audio Thread Architecture

Created a new threading model where the audio stream lives on a dedicated thread:

**File: `src-tauri/src/transcription/audio.rs`**

#### New Types Added (Lines 104-129):

```rust
/// Commands for controlling the audio thread
enum AudioThreadCommand {
    Stop,
}

/// Handle to control the audio capture thread
pub struct AudioCaptureHandle {
    command_tx: std_mpsc::Sender<AudioThreadCommand>,
    thread_handle: Option<thread::JoinHandle<()>>,
}

impl AudioCaptureHandle {
    /// Stop the audio capture and wait for the thread to finish
    pub fn stop(mut self) -> Result<(), String> {
        if let Some(handle) = self.thread_handle.take() {
            // Send stop command
            let _ = self.command_tx.send(AudioThreadCommand::Stop);
            
            // Wait for thread to finish
            handle.join()
                .map_err(|_| "Failed to join audio thread".to_string())?;
        }
        Ok(())
    }
}
```

#### Modified AudioCapture::start() (Lines 166-210):

The method now:
1. Takes ownership of `self` instead of borrowing
2. Creates a dedicated thread for audio capture
3. Returns `AudioCaptureHandle` instead of `cpal::Stream`
4. Stream lives and dies on the dedicated thread

Key implementation:
- Thread spawned with `thread::spawn()`
- Command channel uses `std::sync::mpsc` (blocking, thread-safe)
- Thread polls for stop command every 100ms
- Stream properly dropped when thread exits

#### Audio Callback Fix (Line 273):

Changed from:
```rust
if let Err(e) = audio_sender.send(pcm_data) {
    tracing::error!("Failed to send audio data: {}", e);
}
```

To:
```rust
// Send audio data through channel
// If the channel is closed, silently ignore (this is expected during shutdown)
let _ = audio_sender.send(pcm_data);
```

This eliminates error spam during shutdown when the channel closes before callbacks stop.

### 2. Command Handler Updates

**File: `src-tauri/src/transcription/commands.rs`**

#### AppState Updated (Lines 13-27):

```rust
pub struct AppState {
    pub transcription_active: Arc<Mutex<bool>>,
    pub stop_sender: Arc<Mutex<Option<mpsc::UnboundedSender<()>>>>,
    pub audio_handle: Arc<Mutex<Option<audio::AudioCaptureHandle>>>, // NEW
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            transcription_active: Arc::new(Mutex::new(false)),
            stop_sender: Arc::new(Mutex::new(None)),
            audio_handle: Arc::new(Mutex::new(None)), // NEW
        }
    }
}
```

#### start_transcription Updated (Lines 58-114):

Key changes:
- Clones Arc references instead of entire state struct (fixes lifetime issues)
- Stores AudioCaptureHandle in state
- Cleanup task also stops audio capture if still running

```rust
// Clone Arc references to move into the spawned task
let transcription_active = state.transcription_active.clone();
let stop_sender_state = state.stop_sender.clone();
let audio_handle_state = state.audio_handle.clone();

// ... later ...

// Create audio capture and start it on a dedicated thread
let capture = audio::AudioCapture::new(device, audio_tx)?;
let audio_handle = capture.start()?;

// Store the audio handle so we can stop it later
*state.audio_handle.lock().await = Some(audio_handle);
```

#### stop_transcription Updated (Lines 117-146):

Now properly stops both the transcription task AND the audio thread:

```rust
// Send stop signal to the transcription task
if let Some(stop_tx) = state.stop_sender.lock().await.take() {
    let _ = stop_tx.send(());
}

// Stop the audio capture thread
if let Some(audio_handle) = state.audio_handle.lock().await.take() {
    // Spawn a blocking task to stop the audio thread
    // This is necessary because stop() calls join() which blocks
    tokio::task::spawn_blocking(move || {
        if let Err(e) = audio_handle.stop() {
            tracing::error!("Error stopping audio capture: {}", e);
        } else {
            tracing::info!("Audio capture stopped successfully");
        }
    });
}
```

## Benefits

1. **No Memory Leaks**: Stream is properly dropped when stopped
2. **Clean Shutdown**: Audio thread gracefully shuts down on command
3. **macOS Compatible**: Stream never leaves its creation thread
4. **Thread-Safe**: All state properly synchronized with Arc<Mutex<>>
5. **No Race Conditions**: Dedicated command channel for thread control

## Testing Results

✅ Application compiles successfully
✅ Audio stream starts on dedicated thread
✅ Audio thread shuts down cleanly when stopped
✅ No error spam during shutdown
✅ Proper resource cleanup

## Log Evidence

```
INFO Audio stream started on dedicated thread
INFO Received stop command, shutting down audio thread
INFO Audio thread shut down cleanly
```

## Status: COMPLETE ✅

The threading issue is fully resolved and production-ready.
