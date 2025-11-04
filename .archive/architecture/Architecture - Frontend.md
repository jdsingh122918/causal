---
title: Architecture - Frontend
type: note
permalink: architecture/architecture-frontend
---

# Frontend Architecture

## Entry Points
- **HTML Template**: `index.html` (project root)
- **TypeScript Entry**: `src/main.ts`
- **Styles**: `src/styles.css`

## Key Patterns
- Vanilla TypeScript (no framework)
- Uses Tauri API (`@tauri-apps/api`) to invoke backend commands
- Event-driven DOM interactions via `window.addEventListener("DOMContentLoaded")`

## Example: Invoking Rust Commands
```typescript
import { invoke } from "@tauri-apps/api/core";

// Call Rust command
const result = await invoke("greet", { name: "World" });
```

## Vite Configuration Highlights
- **Port**: 1420 (strict)
- **HMR Port**: 1421 (when using external host)
- **Clear Screen**: Disabled to show Rust errors
- **Watch Ignored**: `src-tauri/` directory
- **Build Output**: `dist/` directory

## TypeScript Configuration
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Enabled with all linting options
- **No Emit**: True (Vite handles bundling)
- Includes: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
