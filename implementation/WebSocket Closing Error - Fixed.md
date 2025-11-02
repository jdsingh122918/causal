---
title: WebSocket Closing Error - Fixed
type: note
permalink: implementation/web-socket-closing-error-fixed
---

# WebSocket Closing Error - Fixed

## Date: 2025-10-30

## Problem
Error occurring during shutdown:
```
ERROR causal_lib::transcription::assemblyai: Failed to send audio data: WebSocket protocol error: Sending after closing is not allowed
```

## Root Cause
The shutdown sequence was incorrect:
1. `stop_transcription` was called
2. Stop signal sent to transcription task
3. Transcription task completes and closes WebSocket
4. Audio capture thread still running, trying to send data
5. **ERROR**: Audio data sent to closed WebSocket

## Solution

### 1. Fix Shutdown Order in commands.rs (lines 137-157)

**Key Change**: Stop audio capture FIRST, then close WebSocket

```rust
// IMPORTANT: Stop the audio capture thread FIRST
// This ensures no more audio data is sent after we close the WebSocket
if let Some(audio_handle) = state.audio_handle.lock().await.take() {
    // Spawn a blocking task to stop the audio thread
    // This is necessary because stop() calls join() which blocks
    tokio::task::spawn_blocking(move || {
        if let Err(e) = audio_handle.stop() {
            tracing::error!("Error stopping audio capture: {}", e);
        } else {
            tracing::info!("Audio capture stopped successfully");
        }
    })
    .await
    .map_err(|e| format!("Failed to join audio stop task: {}", e))?;
}

// Now send stop signal to the transcription task
// This will close the audio channel and WebSocket connection
if let Some(stop_tx) = state.stop_sender.lock().await.take() {
    let _ = stop_tx.send(());
}
```

Note the `.await` after `spawn_blocking` - this ensures we wait for the audio thread to fully stop before proceeding.

### 2. Add Graceful WebSocket Close Handling in assemblyai.rs (lines 123-132)

```rust
// Send audio data to WebSocket as binary PCM data
while let Some(audio_data) = audio_receiver.recv().await {
    if let Err(e) = ws_sender.send(Message::Binary(audio_data)).await {
        // Check if the error is because the WebSocket is closing/closed
        if e.to_string().contains("closed") || e.to_string().contains("closing") {
            tracing::info!("WebSocket closed, stopping audio transmission");
            break;
        } else {
            tracing::error!("Failed to send audio data: {}", e);
            return Err(format!("Failed to send audio data: {}", e));
        }
    }
}
```

This provides a fallback in case audio data arrives after WebSocket closure.

## Why This Works

1. **Audio stops first**: No new audio data generated after we start shutdown
2. **Channel drains**: Any buffered audio data is consumed or dropped
3. **WebSocket closes cleanly**: No attempts to send after closure
4. **Blocking wait**: We ensure audio thread fully stops before proceeding

## Testing
- Start transcription
- Stop transcription
- No more "Sending after closing" errors
- Clean shutdown with proper logging

## Status: COMPLETE ✅

The shutdown sequence is now correct and all resources clean up properly.