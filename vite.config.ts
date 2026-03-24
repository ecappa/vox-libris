import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { voxBackendGateway } from "./src/server/vox-backend-gateway"

export default defineConfig({
  plugins: [react(), tailwindcss(), voxBackendGateway()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
