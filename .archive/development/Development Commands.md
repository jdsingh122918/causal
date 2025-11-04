---
title: Development Commands
type: note
permalink: development/development-commands
---

# Development Commands

## Frontend Development
- `npm run dev` - Start Vite dev server on port 1420
- `npm run build` - Type-check TypeScript and build frontend
- `npm run preview` - Preview production build

## Tauri Development
- `npm run tauri dev` - Run Tauri app in development mode (auto-runs `npm run dev`)
- `npm run tauri build` - Build production app bundle for all targets

## Type Checking & Testing
- `npx tsc --noEmit` - Type-check TypeScript without emitting files

## Important Notes
- The `tauri dev` command automatically executes `npm run dev` via `beforeDevCommand` in `src-tauri/tauri.conf.json`
- Vite dev server must run on port 1420 (strictPort: true)
- HMR port is 1421 when using external host
