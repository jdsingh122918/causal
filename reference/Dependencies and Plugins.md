---
title: Dependencies and Plugins
type: note
permalink: reference/dependencies-and-plugins
---

# Dependencies and Plugins

## Frontend Dependencies (package.json)

### Production Dependencies
- `@tauri-apps/api` (v2) - Tauri API for frontend-backend communication
- `@tauri-apps/plugin-opener` (v2) - Plugin for opening external resources

### Development Dependencies
- `@tauri-apps/cli` (v2) - Tauri CLI tools
- `vite` (v6.0.3) - Frontend build tool and dev server
- `typescript` (~5.6.2) - TypeScript compiler

## Backend Dependencies (Cargo.toml)

### Main Dependencies
- `tauri` (v2) - Core Tauri framework
- `tauri-plugin-opener` (v2) - File/URL opener plugin
- `serde` (v1) with derive features - Serialization framework
- `serde_json` (v1) - JSON serialization

### Build Dependencies
- `tauri-build` (v2) - Tauri build-time code generation

## Currently Registered Plugins

### tauri-plugin-opener
- **Purpose**: Open files and URLs in default system applications
- **Registration**: `src-tauri/src/lib.rs:10`
- **Usage**: `.plugin(tauri_plugin_opener::init())`

## Adding New Plugins

### Frontend Plugin
1. Install via npm: `npm install @tauri-apps/plugin-[name]`
2. Import in TypeScript code as needed

### Backend Plugin
1. Add to `src-tauri/Cargo.toml`:
   ```toml
   tauri-plugin-[name] = "2"
   ```
2. Register in `src-tauri/src/lib.rs`:
   ```rust
   .plugin(tauri_plugin_[name]::init())
   ```
3. Update capabilities in `src-tauri/capabilities/default.json` if needed
