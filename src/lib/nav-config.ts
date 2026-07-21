import { FileText, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Single source of truth for dashboard navigation.
export const navItems: NavItem[] = [
  { label: "Invoices", href: "/dashboard", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
