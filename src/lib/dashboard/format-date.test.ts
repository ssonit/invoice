import { describe, expect, it } from "vitest";
import {
  INTL_LOCALE,
  dayKeyInTimeZone,
  formatCalendarDate,
  formatClockTime,
  formatShortMonth,
  previousDayKeyInTimeZone,
} from "./format-date";
import { inboxGroupLabel, inboxTimeLabel } from "@/lib/invoices";

describe("format-date", () => {
  it("formats calendar dates without timezone shift", () => {
    expect(formatCalendarDate({ year: 2026, month: 7, day: 1 })).toBe("Jul 1, 2026");
    expect(formatCalendarDate({ year: 2026, month: 7, day: 1 }, INTL_LOCALE.vi)).toContain("2026");
  });

  it("localizes short month names", () => {
    const july = new Date(Date.UTC(2026, 6, 1));
    expect(formatShortMonth(july)).toBe("Jul");
    expect(formatShortMonth(july, INTL_LOCALE.vi)).not.toBe("Jul");
  });

  it("renders clock time in the requested time zone", () => {
    const instant = new Date("2026-07-23T09:34:00.000Z");
    expect(formatClockTime(instant, "en-US", "UTC")).toBe("9:34 AM");
    expect(formatClockTime(instant, "en-US", "Asia/Ho_Chi_Minh")).toBe("4:34 PM");
  });

  it("computes day keys and the previous day per time zone", () => {
    const instant = new Date("2026-07-23T20:00:00.000Z");
    expect(dayKeyInTimeZone(instant, "UTC")).toBe("2026-07-23");
    expect(dayKeyInTimeZone(instant, "Asia/Ho_Chi_Minh")).toBe("2026-07-24");
    expect(previousDayKeyInTimeZone(instant, "Asia/Ho_Chi_Minh")).toBe("2026-07-23");
  });

  it("groups inbox labels by the viewer's day, not UTC's", () => {
    const now = "2026-07-23T20:00:00.000Z"; // already Jul 24 in Vietnam
    const options = { timeZone: "Asia/Ho_Chi_Minh" };
    expect(inboxGroupLabel("2026-07-23T18:00:00.000Z", now, options)).toBe("Today");
    expect(inboxGroupLabel("2026-07-23T05:00:00.000Z", now, options)).toBe("Yesterday");
    expect(inboxTimeLabel("2026-07-23T09:34:00.000Z", now, options)).toBe("Yesterday");
  });
});
