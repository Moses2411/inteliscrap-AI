import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { warmUpVision } from "./vision/visionEngine";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Warm the on-device model after first paint. It downloads once, is cached by
// the service worker, and is then reused offline. Never blocks the UI.
const warmVision = () => {
  void warmUpVision();
};

if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(warmVision);
} else {
  window.setTimeout(warmVision, 3000);
}
