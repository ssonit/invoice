import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { dashboardDictionaries } from "@/lib/dashboard/i18n";
import { ExportsPanel } from "./exports-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dashboard/dashboard-i18n", async () => {
  const { dashboardDictionaries } = await import("@/lib/dashboard/i18n");
  return { useDashboardI18n: () => ({ t: dashboardDictionaries.en }) };
});

describe("export filters", () => {
  it("keeps filters available when the selected range or status has no matches", () => {
    const t = dashboardDictionaries.en.exports;
    const html = renderToStaticMarkup(createElement(ExportsPanel, {
      query: { range: 6, status: "review" }, count: 0,
    }));
    for (const label of [t.range6, t.range12, t.rangeAll, t.statusAll, t.statusReview, t.statusOk]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(t.emptyTitle);
    expect(html).not.toContain('href="/api/exports/invoices');
  });

  it("provides a download with the selected filters when matching invoices exist", () => {
    const html = renderToStaticMarkup(createElement(ExportsPanel, {
      query: { range: 12, status: "ok" }, count: 2,
    }));
    expect(html).toContain('href="/api/exports/invoices?range=12&amp;status=ok"');
    expect(html).not.toContain(dashboardDictionaries.en.exports.emptyTitle);
  });
});
