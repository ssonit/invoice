"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-config";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]">
      <p className="mb-[4px] px-[10px] text-[11px] uppercase tracking-widest text-nav-label">
        Menu
      </p>
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-[10px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors duration-150",
              isActive
                ? "bg-nav-active font-medium text-nav-text"
                : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
            )}
          >
            <Icon className="size-[15px] shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
