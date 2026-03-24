import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

/** Courbe entrée (ease-out) — même famille que le reste du dashboard */
const EASE_OUT = [0.22, 1, 0.36, 1] as const
/** Courbe sortie — un peu plus marquée pour que la disparition se lise */
const EASE_IN = [0.4, 0, 0.2, 1] as const

function exitDurationSeconds(enterDurationMs: number) {
  const fromEnter = (enterDurationMs / 1000) * 0.5
  return Math.min(0.38, Math.max(0.24, fromEnter))
}

interface FadeInProps {
  children: React.ReactNode
  /** Delay before the enter transition starts (ms) */
  delay?: number
  /** Duration of the enter transition (ms) */
  duration?: number
  className?: string
  /** Change this value to re-trigger exit → enter */
  triggerKey?: string | number
  /**
   * Fires when the enter animation starts (after delay), matching the previous
   * CSS implementation (on becoming visible), for syncing child animations.
   */
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
  const presenceKey =
    triggerKey !== undefined ? String(triggerKey) : "fade-in-static"
  const exitSec = exitDurationSeconds(duration)
  const onEnteredRef = React.useRef(onEntered)
  React.useEffect(() => {
    onEnteredRef.current = onEntered
  }, [onEntered])

  /**
   * Motion’s onAnimationStart runs at t=0, not after transition.delay — sync
   * row-reveal and other children once the enter actually becomes visible.
   */
  React.useEffect(() => {
    if (!onEnteredRef.current) return
    const t = window.setTimeout(() => {
      onEnteredRef.current?.()
    }, delay + 16)
    return () => window.clearTimeout(t)
  }, [presenceKey, delay])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={presenceKey}
        className={cn(className)}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{
          opacity: 0,
          y: -12,
          transition: { duration: exitSec, ease: EASE_IN },
        }}
        transition={{
          opacity: {
            duration: duration / 1000,
            delay: delay / 1000,
            ease: EASE_OUT,
          },
          y: {
            duration: duration / 1000,
            delay: delay / 1000,
            ease: EASE_OUT,
          },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
