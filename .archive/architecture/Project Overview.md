---
title: Project Overview
type: note
permalink: architecture/project-overview
---

# Causal - Project Overview

## Project Type
Tauri v2 desktop application with TypeScript/Vite frontend and Rust backend

## Key Identifiers
- **Package name**: `causal`
- **Bundle identifier**: `dev.fermatsolutions.causal`
- **Version**: 0.1.0

## Technology Stack
- **Frontend**: TypeScript (vanilla, no framework) + Vite
- **Backend**: Rust with Tauri v2
- **Build Tool**: Vite for frontend, Cargo for Rust
- **Dev Server**: Port 1420 (strict)

## Project Structure
```
/Users/jdsingh/Projects/AI/causal/
├── src/                    # Frontend TypeScript source
│   ├── main.ts            # Entry point
│   ├── styles.css         # Global styles
│   └── assets/            # Static assets
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Minimal entry (calls lib)
│   │   ├── lib.rs         # Core application logic
│   │   └── build.rs       # Build script
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── index.html             # HTML template
├── package.json           # Frontend dependencies
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite configuration
└── CLAUDE.md              # Development documentation
```

## Key Features
- Uses library pattern for Rust backend (`causal_lib`)
- Cross-platform compatible (staticlib, cdylib, rlib)
- Strict TypeScript configuration with full linting
- HMR configured for Tauri development
