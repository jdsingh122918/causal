---
title: File Locations Quick Reference
type: note
permalink: reference/file-locations-quick-reference
---

# File Locations Quick Reference

## Frontend Files
- **Entry HTML**: `/index.html`
- **Entry TypeScript**: `/src/main.ts`
- **Styles**: `/src/styles.css`
- **Assets**: `/src/assets/`
- **Build Output**: `/dist/` (generated)

## Backend Files
- **Main Entry**: `/src-tauri/src/main.rs`
- **Core Logic**: `/src-tauri/src/lib.rs`
- **Build Script**: `/src-tauri/build.rs`
- **Capabilities**: `/src-tauri/capabilities/default.json`
- **Generated Schemas**: `/src-tauri/gen/schemas/`
- **Build Output**: `/src-tauri/target/`

## Configuration Files
- **Frontend Package**: `/package.json`
- **TypeScript Config**: `/tsconfig.json`
- **Vite Config**: `/vite.config.ts`
- **Rust Package**: `/src-tauri/Cargo.toml`
- **Tauri Config**: `/src-tauri/tauri.conf.json`
- **Git Ignore**: `/.gitignore`

## Documentation
- **Claude Instructions**: `/CLAUDE.md`
- **Project README**: `/README.md`

## Claude Code Settings
- **Local Settings**: `/.claude/settings.local.json`

## Key Line References
- Greet command definition: `src-tauri/src/lib.rs:3-5`
- Greet command invocation: `src/main.ts:9-11`
- Plugin registration: `src-tauri/src/lib.rs:10`
- Command handler registration: `src-tauri/src/lib.rs:11`
