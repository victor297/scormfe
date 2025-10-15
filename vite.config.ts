import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  server: {
    proxy: {
      "/api": {
        target: "https://scorm-test-qcso.onrender.com",
        changeOrigin: true,
        secure: false,
      },
      "/scorm-packages": {
        target: "https://scorm-test-qcso.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
