import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { applyAppearance, loadAppearance } from "./lib/appearance";
import { AppearanceProvider } from "./lib/AppearanceProvider";
import "./index.css";

applyAppearance(loadAppearance());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </React.StrictMode>
);
