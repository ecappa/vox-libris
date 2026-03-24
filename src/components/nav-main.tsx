import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon } from "lucide-react"

export function NavMain({
  items,
  onDashboard,
  onOpenDialogue,
  onOpenRecherche,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    ragflowChatId?: string
    /** Entrée non branchée (ex. mode à venir) */
    comingSoon?: boolean
    /** Ouvre la vue recherche corpus (sans chat RAGFlow) */
    recherche?: boolean
    /** Ligne d’aide sous le titre (menu étendu) */
    subtitle?: string
  }[]
  onDashboard: () => void
  onOpenDialogue: (chatId: string) => void
  onOpenRecherche?: () => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Tableau de bord"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onClick={onDashboard}
            >
              <LayoutDashboardIcon />
              <span>Tableau de bord</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                disabled={Boolean(item.comingSoon)}
                className={
                  item.comingSoon
                    ? "opacity-50"
                    : !item.ragflowChatId
                      ? "opacity-80"
                      : undefined
                }
                onClick={() => {
                  if (item.recherche && onOpenRecherche && !item.comingSoon) {
                    onOpenRecherche()
                    return
                  }
                  if (item.ragflowChatId && !item.comingSoon) {
                    onOpenDialogue(item.ragflowChatId)
                  }
                }}
              >
                {item.icon}
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="leading-none">{item.title}</span>
                  {item.subtitle ? (
                    <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
