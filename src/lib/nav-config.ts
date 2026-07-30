import {
  BarChart3,
  Bot,
  Download,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavStatus = "live" | "soon" | "beta"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  status?: NavStatus
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/** Dashboard navigation — live routes work; soon/beta open a placeholder page. */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "live",
      },
      {
        label: "Invoices",
        href: "/dashboard/invoices",
        icon: FileText,
        status: "live",
      },
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox, status: "live" },
      {
        label: "Automation",
        href: "/dashboard/automation",
        icon: Bot,
        status: "live",
      },
      {
        label: "Vendors",
        href: "/dashboard/vendors",
        icon: Users,
        status: "live",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        status: "live",
      },
      {
        label: "Exports",
        href: "/dashboard/exports",
        icon: Download,
        status: "live",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        status: "live",
      },
    ],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

/** Exact match for root dashboard; prefix match for nested routes (longest wins). */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function findNavItem(pathname: string): NavItem | undefined {
  const matches = navItems.filter((item) => isNavItemActive(pathname, item.href))
  return matches.sort((a, b) => b.href.length - a.href.length)[0]
}

export const statusLabel: Record<NavStatus, string> = {
  live: "",
  soon: "Soon",
  beta: "Beta",
}
