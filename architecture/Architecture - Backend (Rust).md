---
title: Architecture - Backend (Rust)
type: note
permalink: architecture/architecture-backend-rust
---

# Backend Architecture (Rust)

## Library Pattern
The backend uses a library pattern to avoid Windows naming conflicts:

### main.rs (src-tauri/src/main.rs)
Minimal entry point that delegates to the library:
```rust
fn main() {
    causal_lib::run()
}
```

### lib.rs (src-tauri/src/lib.rs)
Contains core application logic:
- Tauri builder configuration
- Command handlers with `#[tauri::command]`
- Plugin initialization
- Main `run()` function

## Crate Configuration (Cargo.toml)
- **Crate name**: `causal`
- **Library name**: `causal_lib` (avoids Windows conflicts)
- **Crate types**: `["staticlib", "cdylib", "rlib"]` for cross-platform

## Dependencies
- `tauri` (v2)
- `tauri-plugin-opener` (v2)
- `serde` with derive features
- `serde_json`

## Tauri Commands
Commands are Rust functions exposed to frontend:

1. **Define** with `#[tauri::command]` attribute
2. **Register** in `.invoke_handler(tauri::generate_handler![command_name])`
3. **Invoke** from frontend via `invoke("command_name", { args })`

### Example Command Flow
- **Rust** (lib.rs:3-5): `fn greet(name: &str) -> String`
- **TypeScript** (main.ts:9-11): `await invoke("greet", { name: "value" })`

## Plugins
- **tauri-plugin-opener**: Registered in lib.rs:10 for opening external resources
- Initialized via `.plugin(tauri_plugin_opener::init())`

## Build Configuration
- **Build script**: `src-tauri/build.rs`
- **Frontend dist**: `../dist` (relative to src-tauri)
- **Before build**: Runs `npm run build`
- **Before dev**: Runs `npm run dev`
