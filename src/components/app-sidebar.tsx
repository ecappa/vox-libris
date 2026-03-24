import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  MessageSquareTextIcon,
  BookOpenIcon,
  GraduationCapIcon,
  SparklesIcon,
  LibraryIcon,
  SearchIcon,
  Settings2Icon,
  CircleHelpIcon,
  BookMarkedIcon,
  ScrollTextIcon,
  FeatherIcon,
} from "lucide-react"
import { useVoxPublicConfig } from "@/components/vox-config-provider"

const navSecondary = [
  { title: "Réglages", url: "#", icon: <Settings2Icon /> },
  { title: "Aide", url: "#", icon: <CircleHelpIcon /> },
]

const user = {
  name: "Lecteur",
  email: "lecteur@vox-libris.fr",
  avatar: "",
}

const authorItems = [
  { id: "victor-hugo", name: "Victor Hugo", icon: <FeatherIcon /> },
  { id: "emile-zola", name: "Émile Zola", icon: <ScrollTextIcon /> },
  { id: "jules-verne", name: "Jules Verne", icon: <BookMarkedIcon /> },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedAuthorId: string
  onSelectAuthor: (id: string) => void
  onDashboard: () => void
  onOpenDialogue: (chatId: string) => void
}

export function AppSidebar({
  selectedAuthorId,
  onSelectAuthor,
  onDashboard,
  onOpenDialogue,
  ...props
}: AppSidebarProps) {
  const { assistants } = useVoxPublicConfig()
  const erudit = assistants.find((a) => /érudit/i.test(a.label))
  const jeune = assistants.find((a) => /jeune/i.test(a.label))

  const navMain = [
    {
      title: "Mode Érudit",
      url: "#",
      icon: <BookOpenIcon />,
      ragflowChatId: erudit?.id,
    },
    {
      title: "Mode Apprentissage",
      url: "#",
      icon: <GraduationCapIcon />,
      comingSoon: true as const,
    },
    {
      title: "Mode Jeune",
      url: "#",
      icon: <SparklesIcon />,
      ragflowChatId: jeune?.id,
    },
    { title: "Corpus", url: "#", icon: <LibraryIcon /> },
    { title: "Recherche", url: "#", icon: <SearchIcon /> },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#" className="flex items-center gap-2">
                <MessageSquareTextIcon className="size-5! text-primary" />
                <span
                  className="text-lg"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Vox Libris
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          onDashboard={onDashboard}
          onOpenDialogue={onOpenDialogue}
        />
        <NavDocuments
          items={authorItems}
          selectedId={selectedAuthorId}
          onSelect={onSelectAuthor}
        />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
