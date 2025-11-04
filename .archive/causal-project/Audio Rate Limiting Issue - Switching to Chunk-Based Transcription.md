---
title: Audio Rate Limiting Issue - Switching to Chunk-Based Transcription
type: note
permalink: causal-project/audio-rate-limiting-issue-switching-to-chunk-based-transcription
tags:
- issue
- audio
- assemblyai
- transcription
- solution
---

# Audio Rate Limiting Issue - Switching to Chunk-Based Transcription

## Problem Discovered
When testing the real-time streaming transcription, we discovered that AssemblyAI was rejecting connections with error code 3005: "Audio Transmission Rate Exceeded: Received 545.08625 sec. audio in 190.294165 sec"

This means we were sending audio approximately 3x faster than real-time (545 seconds of audio in 190 seconds of wallclock time).

## Root Cause
The issue was in the resampling logic in `audio.rs`. We were creating a new resampler instance on every audio callback, which caused incorrect timing and produced too much output data. The ratio matched exactly: we were resampling from 48kHz to 16kHz (a 3:1 ratio) and sending 3x faster.

## Attempted Fixes
1. **Tried to use a persistent resampler**: Attempted to create a single `FastFixedIn` resampler and reuse it across callbacks, but ran into Rust trait object issues (Resampler trait is not dyn-compatible).

2. **Tried to send 48kHz audio directly**: Changed the sample rate parameter to 48kHz to avoid resampling entirely, but this approach was not completed due to compilation errors from leftover code.

## Final Solution: Chunk-Based Transcription
User requested to switch from real-time streaming to chunk-based transcription:
- Accumulate audio data for a configurable duration (default 30 seconds)
- Send the accumulated chunk to AssemblyAI
- Process and display results

This approach:
- Avoids the rate-limiting issue completely
- Is simpler to implement
- Works better for many use cases
- Allows env variable configuration for chunk duration

## Implementation Status
Currently implementing the chunk-based approach. Files to modify:
- `src-tauri/src/transcription/audio.rs` - Update to accumulate audio in chunks
- `src-tauri/src/transcription/assemblyai.rs` - Switch to batch API instead of streaming
- Configuration for chunk duration via env variable

## Key Learnings
- AssemblyAI's streaming API enforces real-time audio transmission rates strictly
- Creating new resamplers on every callback is incorrect - they maintain internal state
- Rust's `Resampler` trait cannot be used as a trait object (not dyn-compatible)
- Chunk-based processing is often simpler and more reliable than real-time streaming