import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AUTHORS } from "@/lib/authors"
import { cn } from "@/lib/utils"

interface SiteHeaderProps {
  selectedAuthorId: string
  onSelectAuthor: (id: string) => void
}

export function SiteHeader({ selectedAuthorId, onSelectAuthor }: SiteHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base! font-medium">Tableau de bord</h1>
        <div className="ml-auto flex items-center gap-1">
          {AUTHORS.map((author, i) => (
            <span key={author.id} className="flex items-center">
              {i > 0 && (
                <span className="mx-1 text-xs text-muted-foreground/50">·</span>
              )}
              <button
                onClick={() => onSelectAuthor(author.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  author.id === selectedAuthorId
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {author.name.split(" ").pop()}
              </button>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
