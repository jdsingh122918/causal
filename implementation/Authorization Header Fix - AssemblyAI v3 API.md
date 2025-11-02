---
title: Authorization Header Fix - AssemblyAI v3 API
type: note
permalink: implementation/authorization-header-fix-assembly-ai-v3-api
---

# Authorization Header Fix - AssemblyAI v3 API

## Date: 2025-10-30

## Problem Discovered
The WebSocket was rejecting connections with error:
```
WARN WebSocket closed by server: Unauthorized Connection: Missing Authorization header (code: 1008)
```

## Root Cause
The AssemblyAI v3 Universal-Streaming API requires the API key to be sent as an **HTTP Authorization header** during the WebSocket upgrade request, NOT as a query parameter.

## Previous Implementation (Wrong)
```rust
// API key in URL query string - doesn't work for v3
let url = format!(
    "{}?api_key={}&sample_rate={}&encoding=pcm_s16le",
    ASSEMBLYAI_WSS_URL, self.api_key, SAMPLE_RATE
);

let (ws_stream, _) = connect_async(&url).await?;
```

## New Implementation (Correct for v3)
```rust
// Build URL without API key
let url = format!(
    "{}?sample_rate={}&encoding=pcm_s16le",
    ASSEMBLYAI_WSS_URL, SAMPLE_RATE
);

// Create HTTP request with Authorization header
use tokio_tungstenite::tungstenite::http::Request;
let request = Request::builder()
    .uri(&url)
    .header("Authorization", &self.api_key)
    .body(())
    .map_err(|e| format!("Failed to build request: {}", e))?;

let (ws_stream, _) = connect_async(request).await?;
```

## Changes Made (assemblyai.rs:52-70)

1. Removed `api_key` from URL query parameters
2. Created proper HTTP Request with `.header("Authorization", &self.api_key)`
3. Passed Request object to `connect_async()` instead of plain URL string

## Testing
Users should now:
1. Enter a valid AssemblyAI API key from https://www.assemblyai.com/
2. Click "Start Recording"
3. The WebSocket should stay connected and transcripts should appear

## Expected Behavior
- ✅ WebSocket connects successfully
- ✅ "Session began: <session_id>" logged
- ✅ Transcripts appear in the UI as you speak
- ✅ No more "Missing Authorization header" error

## Status: COMPLETE ✅

The authentication method now matches the AssemblyAI v3 API requirements.