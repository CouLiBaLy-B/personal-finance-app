import { StrictMode } from "react";
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
