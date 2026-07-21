"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { navItems } from "@/lib/nav-config";
import { SidebarContent } from "./sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export function Header({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-5">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="flex size-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-[18px]" strokeWidth={1.75} />
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] border-nav-border p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent email={email} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

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
