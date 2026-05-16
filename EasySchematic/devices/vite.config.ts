import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import os from "os";

const cacheDir = path.join(os.tmpdir(), "vite-easyschematic-devices");

export default defineConfig({
  cacheDir,
  plugins: [react()],
  // Resolve TypeScript sources before .js so stale emitted .js shadows can't silently win.
  resolve: {
    extensions: [".mjs", ".mts", ".ts", ".tsx", ".js", ".jsx", ".json"],
  },
});
