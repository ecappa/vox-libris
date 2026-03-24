import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { LazyMotion, MotionConfig, domAnimation } from "motion/react"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { VoxConfigProvider } from "@/components/vox-config-provider"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <TooltipProvider>
            <VoxConfigProvider>
              <App />
            </VoxConfigProvider>
          </TooltipProvider>
        </ThemeProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
)
