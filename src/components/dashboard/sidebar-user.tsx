"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/dashboard/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarUser({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="border-t border-nav-border pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-[10px] rounded-[10px] px-[10px] py-[6px] text-left transition-colors duration-150 hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-nav-active text-[11px] font-medium text-nav-text">
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-nav-text">
            {email}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
