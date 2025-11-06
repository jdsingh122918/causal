import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AppProviders } from "./contexts/AppProviders";
import "./styles.css";

// Debug logging for Windows compatibility issues
console.log("🚀 Frontend initialization starting...");
console.log("📊 Environment info:", {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  cookieEnabled: navigator.cookieEnabled,
  onLine: navigator.onLine,
  windowSize: `${window.innerWidth}x${window.innerHeight}`,
  devicePixelRatio: window.devicePixelRatio,
  url: window.location.href,
  timestamp: new Date().toISOString()
});

// Check for essential DOM elements
const rootElement = document.getElementById("root");
console.log("🎯 Root element check:", {
  found: !!rootElement,
  innerHTML: rootElement?.innerHTML?.length ?? 0,
  attributes: rootElement ? Array.from(rootElement.attributes).map(attr => `${attr.name}="${attr.value}"`).join(", ") : "none"
});

// Global error handlers
window.addEventListener("error", (event) => {
  console.error("❌ Global JavaScript error:", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error,
    timestamp: new Date().toISOString()
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("❌ Unhandled Promise rejection:", {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString()
  });
});

// Monitor document ready state
console.log("📄 Document ready state:", document.readyState);
document.addEventListener("readystatechange", () => {
  console.log("📄 Document ready state changed to:", document.readyState);
});

try {
  console.log("⚛️ Creating React root...");
  const root = ReactDOM.createRoot(rootElement!);

  console.log("🔄 Rendering React app...");
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </BrowserRouter>
    </React.StrictMode>
  );

  console.log("✅ React app render initiated successfully");
} catch (error) {
  console.error("❌ Failed to render React app:", {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });
}
