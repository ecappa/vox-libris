import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { ragflowProxy } from "./src/server/ragflow-proxy"

export default defineConfig({
  plugins: [react(), tailwindcss(), ragflowProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
