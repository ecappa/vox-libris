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

const navMain = [
  { title: "Mode Érudit", url: "#", icon: <BookOpenIcon /> },
  { title: "Mode Apprentissage", url: "#", icon: <GraduationCapIcon /> },
  { title: "Mode Jeune", url: "#", icon: <SparklesIcon /> },
  { title: "Corpus", url: "#", icon: <LibraryIcon /> },
  { title: "Recherche", url: "#", icon: <SearchIcon /> },
]

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
}

export function AppSidebar({
  selectedAuthorId,
  onSelectAuthor,
  ...props
}: AppSidebarProps) {
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
        <NavMain items={navMain} />
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
