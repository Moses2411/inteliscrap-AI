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

// Warm the on-device model after first paint. The model is downloaded once when
// the device has connectivity, cached by the service worker, and then reused
// offline forever — so every later scan is instant and works with no data.
// A failure is retryable: we retry on reconnect (and on every launch).
const warmVision = () => {
  void warmUpVision();
};

// Start the one-time download shortly after the shell paints so it does not
// compete with the first render.
window.setTimeout(warmVision, 600);
// If the first attempt failed because the device was offline, try again the
// moment it reconnects.
window.addEventListener("online", warmVision);
