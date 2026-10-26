import "server-only";
import { cookies } from "next/headers";
import {
  DASHBOARD_LOCALE_COOKIE,
  dashboardDictionaries,
  parseDashboardLocale,
  type DashboardDictionary,
  type DashboardLocale,
} from "@/lib/dashboard/i18n";

/** Locale chosen in the dashboard language switcher (cookie), for Server Components. */
export async function getDashboardLocale(): Promise<DashboardLocale> {
  const store = await cookies();
  return parseDashboardLocale(store.get(DASHBOARD_LOCALE_COOKIE)?.value);
}

export async function getDashboardDictionary(): Promise<{
  locale: DashboardLocale;
  t: DashboardDictionary;
}> {
  const locale = await getDashboardLocale();
  return { locale, t: dashboardDictionaries[locale] };
}
