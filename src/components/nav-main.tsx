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
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    ragflowChatId?: string
  }[]
  onDashboard: () => void
  onOpenDialogue: (chatId: string) => void
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
                disabled={!item.ragflowChatId}
                className={!item.ragflowChatId ? "opacity-55" : ""}
                onClick={() => {
                  if (item.ragflowChatId) onOpenDialogue(item.ragflowChatId)
                }}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
