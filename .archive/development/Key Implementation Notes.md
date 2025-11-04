---
title: Key Implementation Notes
type: note
permalink: development/key-implementation-notes
---

# Key Implementation Notes

## Critical Details

### Library Pattern (Rust)
The backend uses a library pattern where:
- `main.rs` is minimal and only calls `causal_lib::run()`
- All application logic lives in `lib.rs`
- Library is named `causal_lib` (different from crate name `causal`)
- This avoids Windows-specific naming conflicts (see Cargo issue #8519)

### Crate Types
Multiple crate types for cross-platform compatibility:
- `staticlib` - Static library for linking
- `cdylib` - Dynamic library for C-compatible interfaces
- `rlib` - Rust library for Rust code

### Vite Configuration
- `clearScreen: false` - Essential for seeing Rust compilation errors
- `strictPort: true` - Tauri requires consistent port numbering
- Ignores `src-tauri/` in watch mode to prevent rebuild loops

### TypeScript Strictness
All strict options enabled:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

### Window Configuration
- Default size: 800x600 pixels
- Title: "causal"
- Can be modified in `src-tauri/tauri.conf.json`

### CSP (Content Security Policy)
Set to `null` for development flexibility. Should be configured properly for production.

## Common Patterns

### Adding a New Tauri Command
1. Add function with `#[tauri::command]` in `src-tauri/src/lib.rs`
2. Register in `.invoke_handler(tauri::generate_handler![existing_cmd, new_cmd])`
3. Call from frontend: `await invoke("new_cmd", { args })`

### Frontend-Backend Communication
- Uses `invoke()` from `@tauri-apps/api/core`
- Async/await pattern
- Type-safe with TypeScript interfaces
- Serialization handled by serde_json

### Development Workflow
1. Run `npm run tauri dev` (auto-starts both frontend and backend)
2. Make changes to either frontend (src/) or backend (src-tauri/src/)
3. Frontend hot-reloads via Vite HMR
4. Backend requires restart (Ctrl+C and re-run)
