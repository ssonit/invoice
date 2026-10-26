import { describe, expect, it } from "vitest";
import {
  DASHBOARD_LOCALES,
  dashboardDictionaries,
  parseDashboardLocale,
} from "./i18n";
import { navItems, navGroups } from "@/lib/nav-config";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("parseDashboardLocale", () => {
  it("accepts supported locales", () => {
    expect(parseDashboardLocale("vi")).toBe("vi");
    expect(parseDashboardLocale("en")).toBe("en");
  });

  it("falls back to English for anything else", () => {
    expect(parseDashboardLocale(undefined)).toBe("en");
    expect(parseDashboardLocale(null)).toBe("en");
    expect(parseDashboardLocale("fr")).toBe("en");
    expect(parseDashboardLocale("")).toBe("en");
  });
});

describe("dashboard dictionaries", () => {
  it("has the same keys in every locale", () => {
    const [first, ...others] = DASHBOARD_LOCALES;
    const expected = leafPaths(dashboardDictionaries[first]).sort();
    for (const locale of others) {
      expect(leafPaths(dashboardDictionaries[locale]).sort()).toEqual(expected);
    }
  });

  it("has no empty strings", () => {
    for (const locale of DASHBOARD_LOCALES) {
      const entries = Object.entries(dashboardDictionaries[locale]);
      expect(entries.length).toBeGreaterThan(0);
      for (const path of leafPaths(dashboardDictionaries[locale])) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            dashboardDictionaries[locale],
          );
        expect(value, `${locale}:${path}`).not.toBe("");
      }
    }
  });

  it("uses the same {placeholders} in every locale", () => {
    const valueAt = (locale: (typeof DASHBOARD_LOCALES)[number], path: string) =>
      path
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          dashboardDictionaries[locale],
        ) as string;
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const [first, ...others] = DASHBOARD_LOCALES;
    for (const path of leafPaths(dashboardDictionaries[first])) {
      for (const locale of others) {
        expect(placeholders(valueAt(locale, path)), `${locale}:${path}`).toEqual(
          placeholders(valueAt(first, path)),
        );
      }
    }
  });

  it("translates every nav item and group", () => {
    for (const locale of DASHBOARD_LOCALES) {
      const { nav } = dashboardDictionaries[locale];
      for (const item of navItems) expect(nav.items[item.href], item.href).toBeTruthy();
      for (const group of navGroups) expect(nav.groups[group.label], group.label).toBeTruthy();
    }
  });
});
