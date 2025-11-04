import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AppProviders } from "./contexts/AppProviders";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
