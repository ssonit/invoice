# DASHBOARD — Claude Code Prompt
> Paste toàn bộ file này vào Claude Code. Chạy từng bước theo thứ tự.

---

## TRƯỚC KHI BẮT ĐẦU — HỎI NGƯỜI DÙNG

Trước khi chạy bất kỳ lệnh nào, làm theo thứ tự sau:

**1. Gợi ý tên project trước — không hỏi trống**

Dựa vào context cuộc trò chuyện (tên client, loại app, ngành nghề...),
tự tạo 2–3 gợi ý tên theo format `kebab-case` rồi hỏi xác nhận:

```
Tôi gợi ý tên project:
  1. [gợi-ý-1]   ← dựa theo tên client / ngành
  2. [gợi-ý-2]   ← dạng ngắn hơn
  3. [gợi-ý-3]   ← dạng generic fallback

Bạn chọn số mấy, hoặc nhập tên khác?
```

Ví dụ nếu context là "hotel management" → gợi ý: `hotel-admin`, `hotel-cms`, `hospitality-dashboard`
Ví dụ nếu context là "Y Hotel" → gợi ý: `yhotel-admin`, `yhotel-dashboard`, `yhotel-cms`
Ví dụ nếu context chung chung → gợi ý: `admin-dashboard`, `cms-panel`, `app-dashboard`

Tên hợp lệ: chỉ chữ thường, số, dấu gạch ngang. Không dấu cách, không ký tự đặc biệt.

**2. Hỏi package manager**

```
Package manager muốn dùng?
  1. pnpm  (recommended — nhanh nhất)
  2. npm
  3. yarn
  4. bun
```

Lưu câu trả lời vào 2 biến:
- `PROJECT_NAME` = tên người dùng xác nhận hoặc nhập
- `PKG` = package manager được chọn

Dùng 2 biến này xuyên suốt toàn bộ các bước bên dưới.

---

## STEP 1 — SCAFFOLD PROJECT

> ⚠️ CLI flags của `create-next-app` có thể thay đổi theo version.
> Trước khi chạy, kiểm tra flags hiện tại bằng:
> `npx create-next-app@latest --help`
> Nếu flag nào không còn tồn tại, bỏ qua và tiếp tục.

```bash
npx create-next-app@latest [PROJECT_NAME] \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-[PKG]

cd [PROJECT_NAME]
```

---

## STEP 2 — INIT SHADCN

> ⚠️ shadcn CLI cập nhật thường xuyên. Trước khi chạy, kiểm tra:
> `[PKG] dlx shadcn@latest --help`
> hoặc `npx shadcn@latest --help`
> Dùng đúng flags hiện có. Nếu `--template` hay `--yes` không còn,
> chạy interactive và chọn Next.js.

```bash
[PKG] dlx shadcn@latest init
```

Khi được hỏi: chọn Next.js, TypeScript, CSS variables.

---

## STEP 3 — ADD COMPONENTS

> ⚠️ Tên component có thể thay đổi giữa các version shadcn.
> Nếu lệnh báo lỗi "component not found", kiểm tra tên đúng bằng:
> `[PKG] dlx shadcn@latest search [tên-component]`
> rồi add từng cái một thay vì add hàng loạt.

```bash
[PKG] dlx shadcn@latest add \
  sidebar card badge button tooltip \
  dropdown-menu separator switch avatar \
  table breadcrumb command sheet \
  chart
```

---

## STEP 4 — ADD DEPENDENCIES

> ⚠️ Kiểm tra package name trên npmjs.com nếu install báo lỗi.
> `@fontsource-variable/inter` có thể đã đổi tên trong tương lai.

```bash
[PKG] add @fontsource-variable/inter recharts next-themes lucide-react zustand
```

---

## STEP 5 — APPLY DESIGN SYSTEM

Read `DESIGN-SYSTEM.md` in full before writing any code.
Apply every token, color, spacing, radius, and motion rule from that file exactly.
Do not deviate. Do not use defaults.

---

## STEP 6 — FILE STRUCTURE

Create this structure exactly:

```
src/
  app/
    layout.tsx                   ← ThemeProvider + Inter font
    globals.css                  ← design tokens from DESIGN-SYSTEM.md
    (dashboard)/
      layout.tsx                 ← Sidebar + Header shell
      page.tsx                   ← Overview page
      analytics/page.tsx
      users/page.tsx
      orders/page.tsx
      settings/page.tsx
  components/
    dashboard/
      sidebar.tsx
      sidebar-nav.tsx
      sidebar-user.tsx
      header.tsx
      breadcrumb-auto.tsx
      content-shell.tsx
    shared/
      stat-card.tsx
      data-table.tsx
      activity-feed.tsx
      chart-area.tsx
      chart-donut.tsx
      theme-toggle.tsx
      command-search.tsx
  lib/
    nav-config.ts
    utils.ts
```

---

## NAV CONFIG — `src/lib/nav-config.ts`

```ts
import {
  LayoutDashboard, BarChart3, Users,
  ShoppingCart, Package, Settings
} from "lucide-react"

export const navItems = [
  { label: "Overview",  href: "/dashboard",           icon: LayoutDashboard },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Users",     href: "/dashboard/users",     icon: Users },
  { label: "Orders",    href: "/dashboard/orders",    icon: ShoppingCart },
  { label: "Products",  href: "/dashboard/products",  icon: Package },
  { label: "Settings",  href: "/dashboard/settings",  icon: Settings },
]

export const navGroups = [
  { label: "Manage", items: [navItems[2], navItems[3], navItems[4]] },
  { label: "System",  items: [navItems[5]] },
]
```

All navigation driven from this file only. Never hardcode nav items in JSX.

---

## ROOT LAYOUT — `src/app/layout.tsx`

```tsx
import "@fontsource-variable/inter"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## DASHBOARD LAYOUT — `src/app/(dashboard)/layout.tsx`

```tsx
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-200 ease-in-out"
           style={{ marginLeft: "var(--sidebar-current-width)" }}>
        <Header />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}
```

---

## SIDEBAR — `src/components/dashboard/sidebar.tsx`

**Behavior:**
- Fixed left, full height, does not scroll with content
- Two states: expanded `240px` | collapsed `56px` (icon-only)
- State stored in zustand, persisted to localStorage key `"sidebar-open"`
- Toggle: `PanelLeftClose` / `PanelLeftOpen` icon — top right of sidebar
- Transition: `width 200ms ease` via CSS variable `--sidebar-current-width`
- On state change, update `document.documentElement.style.setProperty("--sidebar-current-width", ...)`

**Expanded shows:**
- Top: small logo icon + `"AppName"` text `text-[13px] font-semibold text-white`
- Nav groups from `navGroups` config via `sidebar-nav.tsx`
- Bottom: `sidebar-user.tsx` component

**Collapsed shows:**
- Logo icon only
- Icons only, no labels
- Each icon wrapped in shadcn `Tooltip` (`side="right"`) with label

**Mobile:**
- Hidden `md:hidden`
- `Sheet` component triggered by hamburger in Header

**Visual (from DESIGN-SYSTEM.md):**
- `bg-black border-r border-[#242424]`
- No shadow

---

## SIDEBAR NAV — `src/components/dashboard/sidebar-nav.tsx`

Renders nav items from config.
Active state: match `usePathname()`.

Nav item classes:
- Default:  `flex items-center gap-[6px] px-[10px] py-[6px] rounded-[10px] text-[13px] text-[#999999] transition-colors duration-150 cursor-pointer`
- Hover:    `hover:bg-[#1a1a1a] hover:text-white`
- Active:   `bg-[#242424] text-white font-medium`

Section label:
- `text-[11px] text-[#555555] uppercase tracking-widest px-[10px] mb-[4px]`

Icon: `size-[15px]`

---

## SIDEBAR USER — `src/components/dashboard/sidebar-user.tsx`

Bottom of sidebar. `border-t border-[#242424] pt-3`.

- Expanded: Avatar + Name `text-[13px] text-white font-medium` + Role `text-[12px] text-[#999999]`
- Collapsed: Avatar only

Click opens shadcn `DropdownMenu`:
- My Profile
- Account Settings
- Billing & Plans
- `Separator`
- Dark Mode — label left + `Switch` right — row `bg-[#1a1a1a] rounded-[8px]`
- `Separator`
- Sign Out — `text-red-400`

---

## HEADER — `src/components/dashboard/header.tsx`

`h-11 border-b border-[#e5e7eb] bg-white px-5 flex items-center justify-between`

Left:
- Mobile: `Menu` icon → opens sidebar Sheet
- `breadcrumb-auto.tsx`

Right (`flex items-center gap-[6px]`):
- Search `Button` variant ghost size sm → opens `command-search.tsx`
- Bell icon `Button` variant ghost size sm + `Badge` count `3`
- Avatar → same dropdown as sidebar-user

---

## BREADCRUMB — `src/components/dashboard/breadcrumb-auto.tsx`

```tsx
"use client"
// usePathname() → split by "/" → capitalize → shadcn Breadcrumb
// /dashboard/users → Dashboard / Users
// text-[13px]
```

---

## CONTENT SHELL — `src/components/dashboard/content-shell.tsx`

```tsx
interface ContentShellProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}
```

Renders:
- Page header: `flex items-start justify-between mb-5`
  - Left: `h1` title `text-[15px] font-semibold text-[#1b1b1b] tracking-tight`
  - Left: `p` description `text-[13px] text-[#4b5563] mt-[2px]`
  - Right: actions slot
- `Separator` below header
- `div` children `mt-5`

All pages MUST use this. Never add custom page headers.

---

## OVERVIEW PAGE — `src/app/(dashboard)/page.tsx`

Use `ContentShell` title="Overview".

Body: single Card với text "Welcome" — placeholder only.
Không có stats, charts, hay data table.
Nội dung thật sẽ được thêm sau theo yêu cầu từng project.

---

## SHARED COMPONENTS — `src/components/shared/`

> **Ưu tiên shadcn built-in blocks trước** — kiểm tra trước khi tự build.
> Chỉ tự build khi shadcn không có sẵn hoặc block không phù hợp yêu cầu.

### Cách kiểm tra shadcn có sẵn không

```bash
# Tìm block
[PKG] dlx shadcn@latest search [tên]

# Xem code trước khi add
[PKG] dlx shadcn@latest view [tên-block]

# Add nếu phù hợp
[PKG] dlx shadcn@latest add [tên-block]
```

### Mapping component → shadcn block

| Cần làm | Tìm trước | Fallback nếu không có |
|---------|-----------|----------------------|
| Stat cards | `search dashboard` → xem `dashboard-01` | Tự build `stat-card.tsx` |
| Data table | `search table` → xem `data-table` | Tự build generic table |
| Area chart | `search chart` → xem `chart-area-interactive` | Tự build với recharts |
| Donut chart | `search chart` → xem `chart-pie-donut` | Tự build với recharts |
| Activity feed | `search feed` | Thường tự build — shadcn chưa có |
| Command search | `search command` → đã add ở STEP 3 | Dùng shadcn CommandDialog |
| Theme toggle | `search theme` | Tự build với next-themes |

### Khi tự build — áp dụng token từ DESIGN-SYSTEM.md

```
Stat card:
  border border-[#e5e7eb] rounded-[14px] p-4 shadow-none
  Title:  text-[12px] text-[#4b5563] font-medium uppercase tracking-wide
  Value:  text-2xl font-semibold text-[#1b1b1b] tracking-tight mt-3
  Change up:   text-[12px] text-emerald-600 + TrendingUp size-[12px]
  Change down: text-[12px] text-red-500 + TrendingDown size-[12px]
  Icon:   p-[6px] bg-[#f4f4f4] rounded-[8px] size-[15px]

Data table (tự build):
  divide-y divide-[#e5e7eb] — không có outer border
  Header: bg-[#f9f9f9] text-[12px] text-[#4b5563] uppercase tracking-wide font-medium
  Row:    text-[13px] text-[#1b1b1b] hover:bg-[#f9f9f9] transition-colors duration-150
  Cell:   px-3 py-2

Badge status:
  Active:    bg-emerald-50 text-emerald-700 border border-emerald-200
  Pending:   bg-amber-50   text-amber-700   border border-amber-200
  Cancelled: bg-red-50     text-red-600     border border-red-200
  All:       text-[11px] font-medium rounded-[8px] px-2 py-[2px]

Activity feed:
  divide-y divide-[#e5e7eb] — không có card wrapper
  Item: py-3 flex items-start gap-3
  Avatar: h-7 w-7 rounded-full bg-[#f4f4f4] text-[11px] font-medium
  Text:   text-[13px] text-[#1b1b1b]
  Time:   text-[12px] text-[#4b5563]

Chart wrapper (nếu tự build):
  border border-[#e5e7eb] rounded-[14px] p-4
  Title: text-[13px] font-semibold text-[#1b1b1b] mb-4
  Height: 280px
```

---

## PLACEHOLDER PAGES

Each must compile without errors. Use `ContentShell` + single Card "Coming soon".

```
analytics/page.tsx  → title="Analytics"
users/page.tsx      → title="Users"
orders/page.tsx     → title="Orders"
settings/page.tsx   → title="Settings"
```

---

## [OPTIONAL] MOBILE BOTTOM NAV — floating pill style

> Chỉ build phần này nếu người dùng yêu cầu.
> Hỏi: "Bạn có muốn thêm bottom navigation dạng floating pill cho mobile không?"
> Nếu có → build. Nếu không → bỏ qua toàn bộ section này.

**File:** `src/components/dashboard/mobile-bottom-nav.tsx`

**Behavior:**
- Chỉ hiện trên mobile: `flex md:hidden`
- Fixed bottom, horizontally centered: `fixed bottom-5 left-1/2 -translate-x-1/2`
- Không full width — pill width tự co theo số icon: `w-fit`
- Floating above content: `z-50`
- Hỏi người dùng muốn những icon nào — không tự quyết định
  Ví dụ gợi ý: Home, History, Favorites, Globe, Camera, Sparkle, Upload
- Active icon: icon fill đậm hơn hoặc background dot indicator
- Nav items lấy từ `navItems` config — không hardcode

**Visual:**
```
Container:
  bg-white/90 backdrop-blur-md
  border border-[#e5e7eb]
  rounded-full
  px-4 py-3
  shadow-[0_4px_24px_rgba(0,0,0,0.10)]
  flex items-center gap-1

Each icon button:
  w-9 h-9
  flex items-center justify-center
  rounded-full
  text-[#4b5563]
  hover:bg-[#f4f4f4]
  transition-colors duration-150

Active state:
  text-[#1b1b1b]
  bg-[#f4f4f4]

Icon size: size-[18px]
```

**Dark mode:**
```
bg-[#111111]/90 border-[#242424]
icon default: text-[#999999]
icon active:  text-white bg-[#242424]
```

**Usage — thêm vào `src/app/(dashboard)/layout.tsx`:**
```tsx
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav"

// Trong layout, sau thẻ <main>:
<MobileBottomNav />
```

**Rule:** Không hiện đồng thời với sidebar — sidebar ẩn khi bottom nav hiện (`md:hidden` cho bottom nav).

---

## RULES

### Setup
1. **Hỏi tên project và package manager TRƯỚC** — không tự đặt tên
2. Thay `[PROJECT_NAME]` bằng tên người dùng cung cấp xuyên suốt tất cả lệnh
3. Thay `[PKG]` bằng package manager được chọn (`pnpm` / `npm` / `yarn` / `bun`)
4. **Kiểm tra `--help` trước mỗi CLI command** — flags thay đổi theo version
5. Nếu CLI flag không còn tồn tại → bỏ qua, không báo lỗi, tiếp tục
6. Nếu component shadcn không tìm thấy → dùng `search` để tìm tên đúng

### Code
7. Read `DESIGN-SYSTEM.md` trước khi viết bất kỳ component nào
8. `"use client"` chỉ dùng khi có hooks hoặc browser APIs
9. `nav-config.ts` = single source of truth cho navigation
10. `ContentShell` bắt buộc cho mọi page — không ngoại lệ
11. `StatCard`, `DataTable`, `Charts` nhận props — không hardcode data bên trong
12. Không dùng `style={{}}` inline — Tailwind + CSS variables only
13. Không dùng raw hex trong `.tsx` — dùng CSS variable references
14. Zero TypeScript errors, zero ESLint warnings
15. Chạy QA checklist từ `DESIGN-SYSTEM.md` trước khi kết thúc
