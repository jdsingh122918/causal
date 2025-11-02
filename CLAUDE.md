# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri v2 desktop application with:
- **Frontend**: TypeScript + Vite (vanilla, no framework)
- **Backend**: Rust with Tauri
- **Identifier**: `dev.fermatsolutions.causal`

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Vite dev server (port 1420)
npm run build        # Type-check and build frontend
npm run preview      # Preview production build
```

### Tauri Development
```bash
npm run tauri dev    # Run Tauri app in development mode
npm run tauri build  # Build production app bundle
```

The `tauri dev` command automatically runs `npm run dev` as configured in `src-tauri/tauri.conf.json`.

### Testing & Type Checking
```bash
npx tsc --noEmit     # Type-check TypeScript without emitting files
```

## Architecture

### Frontend (src/)
- **Entry point**: `src/main.ts`
- **HTML template**: `index.html` at project root
- **Styles**: `src/styles.css`
- Uses Tauri API (`@tauri-apps/api`) to invoke backend commands
- Vite dev server runs on port 1420 with strict port enforcement
- HMR configured for Tauri development workflow

### Backend (src-tauri/)
- **Main entry**: `src-tauri/src/main.rs` (delegates to library)
- **Library code**: `src-tauri/src/lib.rs` (contains application logic)
- **Build script**: `src-tauri/build.rs`
- **Lib name**: `causal_lib` (to avoid Windows naming conflicts)

The Rust backend uses a library pattern:
- `main.rs` is minimal and calls `causal_lib::run()`
- `lib.rs` contains the Tauri builder, command handlers, and plugins
- Crate types: `["staticlib", "cdylib", "rlib"]` for cross-platform compatibility

### Tauri Commands
Commands are Rust functions exposed to the frontend via `#[tauri::command]`:
- Defined in `src-tauri/src/lib.rs`
- Registered with `.invoke_handler(tauri::generate_handler![command_name])`
- Called from frontend using `invoke("command_name", { args })`

Example: The `greet` command in `lib.rs:3-5` is invoked from `main.ts:9-11`

### Plugins
- `tauri-plugin-opener`: Registered in `lib.rs:10` for opening external resources

## Configuration Files

- **package.json**: Frontend dependencies and npm scripts
- **tsconfig.json**: Strict TypeScript config with ES2020 target
- **vite.config.ts**: Vite configured for Tauri (port 1420, ignores src-tauri)
- **src-tauri/tauri.conf.json**: Tauri app configuration (window size, bundle settings, build commands)
- **src-tauri/Cargo.toml**: Rust dependencies and crate configuration

## Key Implementation Notes

- TypeScript is configured with strict mode and all linting options enabled
- Vite's `clearScreen: false` prevents obscuring Rust compilation errors
- The frontend dist directory is `../dist` relative to `src-tauri/`
- Window dimensions: 800x600 (configurable in tauri.conf.json)
- CSP is set to null for development flexibility
