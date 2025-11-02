---
title: Configuration Files Reference
type: note
permalink: reference/configuration-files-reference
---

# Configuration Files Reference

## package.json
- Frontend dependencies and npm scripts
- Dependencies: `@tauri-apps/api`, `@tauri-apps/plugin-opener`
- DevDependencies: `@tauri-apps/cli`, `vite`, `typescript`

## tsconfig.json
- Strict TypeScript configuration
- Target: ES2020
- Module: ESNext with bundler resolution
- All strict and linting options enabled
- Includes only `src/` directory

## vite.config.ts
Located at project root. Key settings:
- `clearScreen: false` - Don't obscure Rust errors
- `server.port: 1420` - Required by Tauri
- `server.strictPort: true` - Fail if port unavailable
- `server.watch.ignored: ["**/src-tauri/**"]` - Don't watch Rust code

## src-tauri/tauri.conf.json
Tauri application configuration:
- **Product name**: `causal`
- **Identifier**: `dev.fermatsolutions.causal`
- **Build commands**: 
  - `beforeDevCommand: "npm run dev"`
  - `beforeBuildCommand: "npm run build"`
- **Dev URL**: `http://localhost:1420`
- **Frontend dist**: `../dist`
- **Window**: 800x600 pixels
- **CSP**: null (for development flexibility)
- **Bundle targets**: all platforms

## src-tauri/Cargo.toml
Rust crate configuration:
- Package name: `causal`
- Library name: `causal_lib` (note: different to avoid conflicts)
- Crate types: staticlib, cdylib, rlib
- Edition: 2021

## .claude/settings.local.json
Project-specific Claude Code permissions:
- Allows reading from `~/.config/` and `~/.claude/`
- Allows MCP and cat bash commands
