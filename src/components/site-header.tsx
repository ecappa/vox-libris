import { motion } from "motion/react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AUTHORS } from "@/lib/authors"
import { cn } from "@/lib/utils"

const EASE_OUT = [0.22, 1, 0.36, 1] as const

interface SiteHeaderProps {
  selectedAuthorId: string
  onSelectAuthor: (id: string) => void
  /** Titre de la zone principale (hors chat) */
  pageTitle?: string
}

export function SiteHeader({
  selectedAuthorId,
  onSelectAuthor,
  pageTitle = "Tableau de bord",
}: SiteHeaderProps) {
  return (
    <motion.header
      className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <motion.h1
          className="text-base! font-medium"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.05 }}
        >
          {pageTitle}
        </motion.h1>
        {pageTitle === "Tableau de bord" ? (
          <div className="ml-auto flex items-center gap-1">
            {AUTHORS.map((author, i) => (
              <span key={author.id} className="flex items-center">
                {i > 0 && (
                  <span className="mx-1 text-xs text-muted-foreground/50">
                    ·
                  </span>
                )}
                <motion.button
                  type="button"
                  onClick={() => onSelectAuthor(author.id)}
                  layout
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    author.id === selectedAuthorId
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: EASE_OUT,
                    delay: 0.08 + i * 0.05,
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  {author.name.split(" ").pop()}
                </motion.button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.header>
  )
}
