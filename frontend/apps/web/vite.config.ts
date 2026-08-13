import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mini-auth/auth-rn": fileURLToPath(new URL("../../packages/auth-rn/src/index.ts", import.meta.url)),
      "@mini-auth/auth-ui": fileURLToPath(new URL("../../packages/auth-ui/src/index.ts", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
});
