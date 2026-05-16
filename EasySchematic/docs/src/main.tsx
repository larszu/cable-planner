import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DocsApp from "./DocsApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>,
);
