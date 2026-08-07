"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText } from "lucide-react"

import {
  isNavItemActive,
  navGroups,
  statusLabel,
  type NavStatus,
} from "@/lib/nav-config"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

function StatusBadge({ status }: { status: NavStatus }) {
  if (status === "live") return null
  return (
    <SidebarMenuBadge
      className={cn(
        "rounded-full border px-1.5 text-[10px] font-semibold tracking-wide",
        status === "beta"
          ? "border-[#E8FF47]/35 bg-[#E8FF47]/15 text-[#E8FF47]"
          : "border-white/15 bg-white/5 text-zinc-400"
      )}
    >
      {statusLabel[status]}
    </SidebarMenuBadge>
  )
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-white/5 data-[active=true]:bg-transparent"
              render={<Link href="/dashboard" />}
            >
              <span className="landing-brand-mark relative flex aspect-square size-8 items-center justify-center rounded-lg">
                <FileText className="size-4" strokeWidth={2.25} />
                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-zinc-100 ring-2 ring-[#0a0a0a]" />
              </span>
              <span className="font-[family-name:var(--font-outfit)] text-sm font-semibold tracking-tight">
                Invoice Reader
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label}>
            {index > 0 ? <SidebarSeparator className="mx-0 mb-2" /> : null}
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href)
                  const Icon = item.icon
                  const status = item.status ?? "live"

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={
                          status === "live"
                            ? item.label
                            : `${item.label} (${statusLabel[status]})`
                        }
                        className={cn(
                          "rounded-lg",
                          isActive &&
                            "bg-[#E8FF47]/12 text-[#E8FF47] data-[active=true]:bg-[#E8FF47]/12 data-[active=true]:text-[#E8FF47]"
                        )}
                        render={<Link href={item.href} />}
                      >
                        <Icon strokeWidth={1.75} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      <StatusBadge status={status} />
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
