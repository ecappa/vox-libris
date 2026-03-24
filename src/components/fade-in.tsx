import * as React from "react"
import { cn } from "@/lib/utils"

const EXIT_MS = 150

interface FadeInProps {
  children: React.ReactNode
  /** Delay before the enter transition starts (ms) */
  delay?: number
  /** Duration of the enter transition (ms) */
  duration?: number
  className?: string
  /** Change this value to re-trigger exit → enter */
  triggerKey?: string | number
  /** Fires once the wrapper becomes visible (after delay / exit), for syncing child CSS animations */
  onEntered?: () => void
}

export function FadeIn({
  children,
  delay = 0,
  duration = 500,
  className,
  triggerKey,
  onEntered,
}: FadeInProps) {
  const [visible, setVisible] = React.useState(false)
  const isInitial = React.useRef(true)
  const delayRef = React.useRef(delay)
  delayRef.current = delay
  const onEnteredRef = React.useRef(onEntered)
  onEnteredRef.current = onEntered

  React.useEffect(() => {
    let cancelled = false

    const enter = () => {
      if (!cancelled) {
        setVisible(true)
        onEnteredRef.current?.()
      }
    }

    if (isInitial.current) {
      isInitial.current = false
      const t = setTimeout(enter, delayRef.current + 16)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }

    setVisible(false)
    const t = setTimeout(enter, EXIT_MS + delayRef.current + 16)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey])

  return (
    <div
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transitionProperty: "opacity, transform",
        transitionTimingFunction: visible
          ? "cubic-bezier(0.22, 1, 0.36, 1)"
          : "ease-in",
        transitionDuration: visible ? `${duration}ms` : `${EXIT_MS}ms`,
      }}
    >
      {children}
    </div>
  )
}
