# Debug Logging Control

This document explains how to control debug logging in the Causal application.

## Overview

The application uses a centralized logging system (`src/utils/logger.ts`) that provides granular control over debug output. Debug logging can be enabled or disabled at runtime without rebuilding the application.

## Log Levels

The logging system supports four levels:

- **DEBUG** (`logger.debug()`) - Detailed information for development/troubleshooting (can be disabled)
- **INFO** (`logger.info()`) - Important information (always shown)
- **WARN** (`logger.warn()`) - Warning messages (always shown)
- **ERROR** (`logger.error()`) - Error messages (always shown)

## Controlling Debug Logging

### Method 1: Browser Console (Easiest)

Open the browser DevTools console and use these global functions:

```javascript
// Enable debug logging
window.enableDebugLogging()

// Disable debug logging
window.disableDebugLogging()

// Check current status
window.isDebugEnabled()
```

**Note**: Changes take effect immediately for most modules. Some modules may require a page reload.

### Method 2: LocalStorage (Persistent)

Set the debug flag directly in localStorage:

```javascript
// Enable debug logging
localStorage.setItem('causal_debug_enabled', 'true')

// Disable debug logging
localStorage.setItem('causal_debug_enabled', 'false')

// Remove setting (reverts to default)
localStorage.removeItem('causal_debug_enabled')
```

Then reload the page for changes to take effect.

### Method 3: Environment Variable (Build-time)

Create a `.env` file in the project root:

```bash
# Enable debug logging in development
VITE_DEBUG_ENABLED=true

# Disable debug logging in production
VITE_DEBUG_ENABLED=false
```

This requires rebuilding the application:

```bash
npm run build
```

## Default Behavior

- **Development mode** (`npm run dev`): Debug logging is ENABLED by default
- **Production mode** (`npm run build`): Debug logging is DISABLED by default
- User preferences (localStorage) override environment settings

## Module Identification

Logs are prefixed with emojis for easy visual identification:

- 🧠 Intelligence
- 🎤 Recordings
- 📁 Projects
- 🔧 Settings
- 🔐 Security
- 📊 Analytics
- 🎯 Root
- ⚙️ SettingsPanel
- 🎛️ SettingsDialog
- 💰 Financial
- 🏆 Competitive
- ⚠️ Risk
- 😊 Sentiment
- 📝 Summary
- 💬 Generic

## Usage Examples

### In Code

```typescript
import { logger } from "@/utils/logger";

// Debug logging (respects debug flag)
logger.debug("MyModule", "Processing data", { count: 10 });

// Info logging (always shown)
logger.info("MyModule", "Operation completed successfully");

// Warning logging (always shown)
logger.warn("MyModule", "Deprecation warning", { oldApi: "v1" });

// Error logging (always shown)
logger.error("MyModule", "Failed to process request", error);
```

### Recommended Workflow

1. **Development**: Keep debug logging enabled to see detailed output
2. **Testing**: Disable debug logging to reduce console noise
3. **Production**: Debug logging is automatically disabled
4. **Debugging Issues**: Temporarily enable debug logging via browser console

## Implementation Details

### Files Updated

The following files have been updated to use the centralized logger:

**Contexts:**
- `src/contexts/SettingsContext.tsx`
- `src/contexts/IntelligenceContext.tsx`
- `src/contexts/RecordingsContext.tsx`
- `src/contexts/ProjectsContext.tsx`

**Components:**
- `src/components/panels/SettingsPanel.tsx`
- `src/components/dialogs/SettingsDialog.tsx`
- `src/components/intelligence/IntelligenceGrid.tsx`
- `src/components/intelligence/IntelligenceSidebar.tsx`
- All tile components in `src/components/intelligence/tiles/`

**Core:**
- `src/main.tsx`

### Logger API

```typescript
class Logger {
  // Debug logging (can be toggled off)
  debug(module: string, message: string, ...args: unknown[]): void

  // Info logging (always shown)
  info(module: string, message: string, ...args: unknown[]): void

  // Warning logging (always shown)
  warn(module: string, message: string, ...args: unknown[]): void

  // Error logging (always shown)
  error(module: string, message: string, ...args: unknown[]): void

  // Check debug status
  isDebugEnabled(): boolean

  // Enable debug logging
  enableDebug(): void

  // Disable debug logging
  disableDebug(): void
}
```

## Troubleshooting

### Debug logs not appearing?

1. Check if debug logging is enabled:
   ```javascript
   window.isDebugEnabled()
   ```

2. Enable debug logging:
   ```javascript
   window.enableDebugLogging()
   ```

3. Reload the page if necessary

### Too many logs in console?

Disable debug logging:
```javascript
window.disableDebugLogging()
```

### Want to filter logs by module?

Use browser DevTools console filtering:
- Chrome: Click the filter icon and enter text like `[Intelligence]`
- Firefox: Use the filter box and enter text like `[Intelligence]`

## Migration Guide

If you're adding new code with logging:

**Before (old approach):**
```typescript
console.log('🧠 [MyModule] Processing...');
console.error('Failed to process:', error);
```

**After (new approach):**
```typescript
import { logger } from "@/utils/logger";

logger.debug("MyModule", "Processing...");
logger.error("MyModule", "Failed to process:", error);
```

## Benefits

1. **Centralized Control**: Toggle all debug logging with one command
2. **Performance**: Debug logs are skipped entirely when disabled (not just hidden)
3. **Consistency**: Uniform log format across the application
4. **Flexibility**: Multiple control methods (localStorage, environment, runtime)
5. **Production-Ready**: Automatically disabled in production builds
