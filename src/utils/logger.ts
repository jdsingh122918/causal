/**
 * Centralized logging utility with debug controls
 *
 * Usage:
 * - logger.debug('Module', 'Message', data) - Debug logs (can be disabled)
 * - logger.info('Module', 'Message', data) - Info logs (always shown)
 * - logger.warn('Module', 'Message', data) - Warning logs (always shown)
 * - logger.error('Module', 'Message', error) - Error logs (always shown)
 *
 * Control debug logging:
 * 1. Via localStorage: localStorage.setItem('causal_debug_enabled', 'true')
 * 2. Via environment variable: VITE_DEBUG_ENABLED=true
 * 3. Via browser console: window.enableDebugLogging() / window.disableDebugLogging()
 */

// Module emojis for visual identification
const MODULE_EMOJIS: Record<string, string> = {
  Intelligence: "🧠",
  Recordings: "🎤",
  Projects: "📁",
  Settings: "🔧",
  Security: "🔐",
  Analytics: "📊",
  Environment: "📊",
  Root: "🎯",
  SettingsPanel: "⚙️",
  SettingsDialog: "🎛️",
  IntelligenceGrid: "🧠",
  IntelligenceSidebar: "🧠",
  Financial: "💰",
  Competitive: "🏆",
  Risk: "⚠️",
  Sentiment: "😊",
  Summary: "📝",
  Debug: "🐛",
  Embeddings: "🔮",
  Generic: "💬",
};

// Check if debug logging is enabled
function isDebugEnabled(): boolean {
  // 1. Check localStorage (runtime control)
  const localStorageDebug = localStorage.getItem("causal_debug_enabled");
  if (localStorageDebug !== null) {
    return localStorageDebug === "true";
  }

  // 2. Check environment variable (build-time control)
  const envDebug = (import.meta as any).env?.VITE_DEBUG_ENABLED;
  if (envDebug !== undefined) {
    return envDebug === "true" || envDebug === "1";
  }

  // 3. Default to disabled in production, enabled in development
  return (import.meta as any).env?.DEV || false;
}

// Get emoji for module
function getModuleEmoji(module: string): string {
  return MODULE_EMOJIS[module] || MODULE_EMOJIS.Generic;
}

// Format log prefix
function formatPrefix(module: string): string {
  const emoji = getModuleEmoji(module);
  return `${emoji} [${module}]`;
}

// Logger class
class Logger {
  /**
   * Debug-level logging (can be disabled)
   * Use for detailed information useful during development/troubleshooting
   */
  debug(module: string, message: string, ...args: unknown[]): void {
    if (!isDebugEnabled()) return;

    const prefix = formatPrefix(module);
    if (args.length > 0) {
      console.log(prefix, message, ...args);
    } else {
      console.log(prefix, message);
    }
  }

  /**
   * Info-level logging (always shown)
   * Use for important information that should always be visible
   */
  info(module: string, message: string, ...args: unknown[]): void {
    const prefix = formatPrefix(module);
    if (args.length > 0) {
      console.info(prefix, message, ...args);
    } else {
      console.info(prefix, message);
    }
  }

  /**
   * Warning-level logging (always shown)
   * Use for potentially problematic situations
   */
  warn(module: string, message: string, ...args: unknown[]): void {
    const prefix = formatPrefix(module);
    if (args.length > 0) {
      console.warn(prefix, message, ...args);
    } else {
      console.warn(prefix, message);
    }
  }

  /**
   * Error-level logging (always shown)
   * Use for error conditions
   */
  error(module: string, message: string, ...args: unknown[]): void {
    const prefix = formatPrefix(module);
    if (args.length > 0) {
      console.error(prefix, message, ...args);
    } else {
      console.error(prefix, message);
    }
  }

  /**
   * Check if debug logging is currently enabled
   */
  isDebugEnabled(): boolean {
    return isDebugEnabled();
  }

  /**
   * Enable debug logging at runtime
   */
  enableDebug(): void {
    localStorage.setItem("causal_debug_enabled", "true");
    console.info(
      "✅ Debug logging enabled. Reload may be required for some modules.",
    );
  }

  /**
   * Disable debug logging at runtime
   */
  disableDebug(): void {
    localStorage.setItem("causal_debug_enabled", "false");
    console.info(
      "🔇 Debug logging disabled. Reload may be required for some modules.",
    );
  }
}

// Export singleton instance
export const logger = new Logger();

// Expose global controls for easy access from browser console
if (typeof window !== "undefined") {
  (window as any).enableDebugLogging = () => logger.enableDebug();
  (window as any).disableDebugLogging = () => logger.disableDebug();
  (window as any).isDebugEnabled = () => logger.isDebugEnabled();
}
