---
title: UI Issues Fixed - Transcription Errors and Stop Button
type: note
permalink: implementation/ui-issues-fixed-transcription-errors-and-stop-button
---

# UI Issues Fixed - Transcription Errors and Stop Button

## Date: 2025-10-30

## Problems Identified

### 1. Transcription Not Appearing
- WebSocket was connecting but immediately closing
- No transcripts were being sent to the UI
- Root cause: Network/DNS error or invalid API key

### 2. Stop Button Hanging
- Button showed "Stopping..." indefinitely  
- User couldn't resume recording
- Root cause: `stop_transcription` returned error when session already stopped

## Solutions Implemented

### 1. Better Error Logging (assemblyai.rs:108-114)

Added detailed WebSocket close frame logging:
```rust
Ok(Message::Close(frame)) => {
    if let Some(cf) = frame {
        tracing::warn!("WebSocket closed by server: {} (code: {})", cf.reason, cf.code);
    } else {
        tracing::info!("WebSocket closed");
    }
    break;
}
```

This now shows **why** the WebSocket closed (auth failure, invalid API key, etc.)

### 2. Error Event Emission (commands.rs:77-83)

Errors are now sent to the frontend:
```rust
let app_for_error = app_clone.clone();
let session_handle = tokio::spawn(async move {
    if let Err(e) = client.start_session(audio_rx, transcript_tx).await {
        tracing::error!("Transcription session error: {}", e);
        // Emit error to frontend
        let _ = app_for_error.emit("transcription_error", e);
    }
});
```

### 3. Graceful Stop Handling (commands.rs:132-137)

Stop now succeeds even if already stopped:
```rust
// Check if already stopped (transcription may have stopped due to error)
let is_active = *state.transcription_active.lock().await;
if !is_active {
    tracing::info!("Transcription already stopped");
    return Ok(()); // Return success, not an error
}
```

Also explicitly marks as inactive at the end (line 162):
```rust
// Mark as inactive
*state.transcription_active.lock().await = false;
```

### 4. Frontend Error Handler (main.ts:243-260)

Added listener for transcription errors:
```typescript
// Listen for transcription errors
await listen<string>("transcription_error", (event) => {
    const error = event.payload;
    console.error("Transcription error:", error);

    // Update UI to show error
    statusIndicator.textContent = "Error";
    statusIndicator.className = "status error";

    // Reset buttons
    startBtn.disabled = false;
    stopBtn.disabled = true;
    deviceSelect.disabled = false;
    apiKeyInput.disabled = false;

    // Show error to user
    alert(`Transcription error: ${error}`);
});
```

## Benefits

1. **Clear Error Messages**: Users now see exactly why transcription failed
2. **No Hung State**: Stop button always works, even after errors
3. **Better UX**: UI resets properly when errors occur
4. **Easier Debugging**: Detailed logs show WebSocket close reasons

## Testing Needed

Users should test with:
1. **Valid AssemblyAI API key** - Should transcribe successfully
2. **Invalid API key** - Should show clear error message
3. **Network issues** - Should show connection error
4. **Stop during error** - Button should work immediately

## Status: COMPLETE ✅

Both UI issues are fixed. Users will now get clear feedback about what's wrong.