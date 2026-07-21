import { Receipt } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUser } from "./sidebar-user";

// Static sidebar content, reused by the fixed desktop rail and the mobile Sheet.
export function SidebarContent({
  email,
  onNavigate,
}: {
  email: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-nav-bg px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-[10px]">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-nav-active text-nav-text">
          <Receipt className="size-[15px]" strokeWidth={1.75} />
        </span>
        <span className="text-[14px] font-semibold text-nav-text">Invoice Reader</span>
      </div>

      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarNav onNavigate={onNavigate} />
      </div>

      <SidebarUser email={email} />
    </div>
  );
}

// Fixed left rail on desktop.
export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-nav-border md:block">
      <div className="fixed inset-y-0 left-0 w-[240px]">
        <SidebarContent email={email} />
      </div>
    </aside>
  );
}
