"use client"

import Link from "next/link"
import { Bell, Check, Languages, LogOut, Settings } from "lucide-react"

import { logout } from "@/app/dashboard/actions"
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n"
import { DASHBOARD_LOCALES } from "@/lib/dashboard/i18n"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function HeaderActions({ email, displayName }: { email: string; displayName: string }) {
  const { t, locale, setLocale } = useDashboardI18n()
  const initial = (displayName || email).charAt(0).toUpperCase()

  return (
    <div className="ml-auto flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.header.notifications}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Bell strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t.header.notifications}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t.header.noNotifications}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.header.settings}
        className="text-muted-foreground hover:text-foreground"
        nativeButton={false}
        render={<Link href="/dashboard/settings" />}
      >
        <Settings strokeWidth={1.75} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t.header.accountMenu}
              className="ml-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-zinc-700 text-sm font-medium text-zinc-100">
              {initial}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName || email}
              </p>
              {displayName ? (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{t.header.signedIn}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <Languages className="size-3.5" />
              {t.header.language}
            </DropdownMenuLabel>
            {DASHBOARD_LOCALES.map((option) => (
              <DropdownMenuItem key={option} onClick={() => setLocale(option)}>
                <span className="flex-1">{option === "en" ? "English" : "Tiếng Việt"}</span>
                {locale === option ? <Check className="size-3.5 text-[#E8FF47]" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
              <Settings />
              {t.header.settings}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => logout()}>
              <LogOut />
              {t.header.signOut}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
