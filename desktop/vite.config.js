// Configure the Vite entry and output directory for the desktop web client.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true }
});
