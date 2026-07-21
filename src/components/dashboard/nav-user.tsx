"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { logout } from "@/app/dashboard/actions";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavUser({ email }: { email: string }) {
  const { isMobile } = useSidebar();
  const initial = email.charAt(0).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" tooltip={email} />}
          >
            <span className="flex aspect-square size-8 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-medium text-sidebar-accent-foreground">
              {initial}
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate text-[13px] font-medium">{email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            className="w-56"
          >
            <DropdownMenuItem variant="destructive" onClick={() => logout()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
