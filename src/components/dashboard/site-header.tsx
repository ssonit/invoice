"use client"

import { usePathname } from "next/navigation"

import { findNavItem, statusLabel } from "@/lib/nav-config"
import { HeaderActions } from "@/components/dashboard/header-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export function SiteHeader({ email }: { email: string }) {
  const pathname = usePathname()
  const item = findNavItem(pathname)
  const title = item?.label ?? "Dashboard"
  const status = item?.status ?? "live"

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/80 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="flex items-center gap-2">
            <BreadcrumbPage className="text-[13px] font-medium text-foreground">
              {title}
            </BreadcrumbPage>
            {status !== "live" ? (
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  status === "beta"
                    ? "border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {statusLabel[status]}
              </span>
            ) : null}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <HeaderActions email={email} />
    </header>
  )
}
