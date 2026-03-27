import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { LazyMotion, MotionConfig, domAnimation } from "motion/react"

import "./index.css"
import App from "./App.tsx"
import { AppAccessGate } from "@/components/app-access-gate.tsx"
import { FrontPage } from "./FrontPage.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"
import { VoxConfigProvider } from "@/components/vox-config-provider"

function Router() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  if (path === "/app" || path.startsWith("/app/")) {
    return (
      <ThemeProvider>
        <TooltipProvider>
          <AppAccessGate>
            <VoxConfigProvider>
              <App />
            </VoxConfigProvider>
          </AppAccessGate>
        </TooltipProvider>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <FrontPage />
    </ThemeProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Router />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>
)
