# Logging System Architecture and Implementation

**Date**: 2025-11-03
**Status**: ✅ Fully Implemented and Active
**Location**: `src-tauri/src/logging/`

## Overview

Causal uses a comprehensive structured logging system built on the Rust `tracing` ecosystem. The system provides platform-specific file logging with automatic rotation, privacy-first design, and environment-aware configurations.

## Architecture

### Components

The logging system consists of three main modules:

1. **`mod.rs`** - Core initialization and configuration
2. **`config.rs`** - Configuration structures and defaults
3. **`privacy.rs`** - Sensitive data redaction

### Technology Stack

```toml
tracing = "0.1"                                  # Core instrumentation
tracing-subscriber = "0.3"                       # Log collection & formatting
  features: ["env-filter", "json", "fmt", "ansi", "registry"]
tracing-appender = "0.2"                         # File rotation
dirs = "5.0"                                     # Platform-specific paths
```

## File Locations

### Platform-Specific Paths

**macOS:**
```
~/Library/Application Support/dev.fermatsolutions.causal/logs/causal.log
```

**Windows:**
```
%APPDATA%\dev.fermatsolutions.causal\logs\causal.log
```

**Linux:**
```
~/.local/share/dev.fermatsolutions.causal/logs/causal.log
```

### Log Rotation

- **Rotation Policy**: Daily (new file created each day)
- **File Naming**: `causal.log` (current), `causal.log.YYYY-MM-DD` (archived)
- **Implementation**: `RollingFileAppender` with `Rotation::DAILY`
- **Location**: `src-tauri/src/logging/mod.rs:16-20`

## Configuration Modes

### Development Mode (`cfg!(debug_assertions)`)

```rust
LoggingConfig {
    max_level: Level::DEBUG,
    enable_console: true,      // Pretty-printed to console
    enable_file: true,         // Also logged to file
    enable_json: false,        // Human-readable format
    privacy_mode: PrivacyMode::Full  // No redaction
}
```

**Output Format**: Pretty-printed text with colors, file locations, and line numbers

### Production Mode (Release builds)

```rust
LoggingConfig {
    max_level: Level::INFO,
    enable_console: false,     // No console output
    enable_file: true,         // File logging only
    enable_json: true,         // Structured JSON
    privacy_mode: PrivacyMode::Redacted  // PII redacted
}
```

**Output Format**: Structured JSON with spans, thread IDs, and metadata

## Privacy Features

### Privacy Modes

1. **`PrivacyMode::Full`** (Development)
   - Logs everything including sensitive data
   - For debugging only

2. **`PrivacyMode::Redacted`** (Production Default)
   - Redacts PII, API keys, and transcripts
   - Shows metadata only

3. **`PrivacyMode::Minimal`** (Future use)
   - Only errors and critical events
   - Maximum privacy

### Redaction Rules

Implemented in `privacy.rs:5-31`:

| Field Type | Example Fields | Redaction Strategy |
|------------|---------------|-------------------|
| API Keys | `api_key`, `*_key`, `key` | Show first 8 chars + "[REDACTED]" |
| Transcripts | `transcript`, `text`, `raw_text` | Show metadata: `[N chars, M words]` |
| Names (PII) | `name`, `project_name`, `device_name` | Truncate to 10 chars |
| Other | All other fields | No redaction |

**Example**:
```rust
// Input:  api_key="sk_1234567890abcdefghij"
// Output: api_key="sk_12345...[REDACTED]"

// Input:  transcript="Hello world, this is a test."
// Output: transcript="[30 chars, 6 words]"
```

## Log Levels and Filtering

### Module-Specific Filtering

Configured in `mod.rs:80-90`:

```rust
EnvFilter::new(
    "info,                      // Root level
    causal_lib=debug,          // Main app: DEBUG
    transcription=debug,       // Audio/transcription: DEBUG
    database=info,             // Database ops: INFO
    hyper=info,                // HTTP client: INFO only
    tokio=info,                // Async runtime: INFO only
    tungstenite=info,          // WebSocket: INFO only
    reqwest=info"              // HTTP client: INFO only
)
```

### Override via Environment

Users can override with `RUST_LOG`:
```bash
RUST_LOG=debug npm run tauri dev           # All DEBUG
RUST_LOG=transcription=trace npm run tauri dev  # Trace transcription only
```

## Integration

### Initialization

**Location**: `src-tauri/src/lib.rs:17-24`

```rust
pub fn run() {
    // Get platform-appropriate log directory
    let fallback_log_dir = logging::get_default_log_dir();

    // Create config with log directory
    let log_config = logging::LoggingConfig::default()
        .with_log_dir(fallback_log_dir);

    // Initialize logging system
    logging::init_logging(log_config)
        .expect("Failed to initialize logging");

    tracing::info!("Causal application starting");

    // ... rest of application setup
}
```

### Instrumentation Coverage

The logging system is actively used across **11 files** with **97 tracing calls**:

| Module | Log Calls | Purpose |
|--------|-----------|---------|
| `transcription/assemblyai.rs` | Most | WebSocket connection, message handling |
| `transcription/audio.rs` | High | Audio capture, device management |
| `transcription/commands.rs` | High | Command handlers, state changes |
| `transcription/buffer.rs` | Medium | Audio buffering operations |
| `transcription/summary.rs` | Medium | AI summarization |
| `transcription/enhancement.rs` | Low | AI enhancement |
| `transcription/refinement.rs` | Low | Text refinement |
| `database/commands.rs` | Medium | Database operations |
| `lib.rs` | Low | Application lifecycle |
| `logging/mod.rs` | Low | Logging system itself |

### Common Log Patterns

**Application Lifecycle**:
```rust
tracing::info!("Causal application starting");
tracing::info!(log_dir = %config.log_dir.display(), "Logging initialized");
```

**Transcription Flow**:
```rust
tracing::info!("Session began: {}", id);
tracing::debug!("Partial transcript: {}", text);
tracing::info!("Final transcript: {}", text);
```

**Error Handling**:
```rust
tracing::error!("Failed to connect: {}", error);
tracing::warn!("Device not found: {}", device_id);
```

**Performance Monitoring**:
```rust
tracing::debug!("Audio buffer size: {}", buffer.len());
tracing::debug!("Resample latency: {:?}", duration);
```

## Performance Impact

Based on the implementation plan (`docs/LOGGING_IMPLEMENTATION_PLAN.md`):

- **CPU Overhead**: +2-4% (negligible in practice)
- **Memory Usage**: +20-40 MB for buffers and subscribers
- **Disk Space**: ~100-500 MB/month depending on usage
- **I/O Impact**: Non-blocking file appender minimizes latency

## Advantages

1. **Structured Data**: JSON logs in production enable parsing and analysis
2. **Privacy-First**: Sensitive data automatically redacted
3. **Platform-Native**: Uses OS-appropriate directories
4. **Low Overhead**: Non-blocking I/O prevents performance impact
5. **Flexible Filtering**: Module-level control over verbosity
6. **Rotation**: Automatic daily rotation prevents disk exhaustion
7. **Development-Friendly**: Pretty console output with colors

## Usage Examples

### For Developers

**View logs during development**:
```bash
npm run tauri dev
# Logs appear in console (pretty-printed)
```

**View production logs**:
```bash
# macOS
tail -f ~/Library/Application\ Support/dev.fermatsolutions.causal/logs/causal.log

# Parse JSON logs
cat causal.log | jq '.fields.message'
```

**Debug specific module**:
```bash
RUST_LOG=transcription=trace npm run tauri dev
```

### For Users

Log files are stored locally and never transmitted over the network. Users can:
- View logs for troubleshooting
- Share logs with support (privacy mode redacts sensitive data)
- Clear logs by deleting files in log directory

## Future Enhancements

From the implementation plan:

1. **Phase 2**: OpenTelemetry integration for distributed tracing
2. **Phase 3**: Metrics collection (CPU, memory, transcription latency)
3. **Phase 4**: UI for viewing/exporting/clearing logs
4. **GDPR Compliance**: User consent and data retention policies

## Related Files

- `src-tauri/src/logging/mod.rs` - Core implementation
- `src-tauri/src/logging/config.rs` - Configuration
- `src-tauri/src/logging/privacy.rs` - Redaction logic
- `src-tauri/src/lib.rs:17-24` - Initialization
- `docs/LOGGING_IMPLEMENTATION_PLAN.md` - Implementation plan
- `src-tauri/Cargo.toml:51-55` - Dependencies

## Testing

Unit tests are included in the privacy module (`privacy.rs:60-86`):

```rust
#[test]
fn test_redact_api_key() { ... }

#[test]
fn test_redact_transcript() { ... }

#[test]
fn test_no_redaction_for_safe_fields() { ... }
```

Run tests:
```bash
cd src-tauri
cargo test logging
```

## Summary

The Causal logging system is production-ready with:
- ✅ Platform-specific file locations
- ✅ Daily log rotation
- ✅ Privacy-first redaction
- ✅ Development/production modes
- ✅ Comprehensive instrumentation (97 log points across 11 modules)
- ✅ Non-blocking I/O
- ✅ Structured JSON for production
- ✅ Environment-based configuration

The system provides excellent observability while respecting user privacy and maintaining low performance overhead.
