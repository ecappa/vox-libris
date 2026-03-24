"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function NavDocuments({
  items,
  selectedId,
  onSelect,
}: {
  items: {
    id: string
    name: string
    icon: React.ReactNode
  }[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Auteurs</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            className="group/menu-item relative"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.35,
              ease: EASE_OUT,
              delay: 0.06 * i,
            }}
          >
            <SidebarMenuButton
              isActive={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              tooltip={item.name}
            >
              {item.icon}
              <span>{item.name}</span>
            </SidebarMenuButton>
          </motion.li>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
