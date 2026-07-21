"use client";

import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-config";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

function currentTitle(pathname: string): string {
  const match = navItems.find((item) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href),
  );
  return match?.label ?? "Dashboard";
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="text-[13px] text-muted-foreground">
            Dashboard
          </BreadcrumbItem>
          <span className="text-muted-foreground">/</span>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-[13px] font-medium text-foreground">
              {currentTitle(pathname)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
