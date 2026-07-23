import { describe, expect, it } from "vitest";
import { findNavItem, isNavItemActive } from "./nav-config";

describe("isNavItemActive", () => {
  it("requires an exact match for the dashboard root", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/invoices", "/dashboard")).toBe(false);
  });

  it("matches nested routes by prefix", () => {
    expect(isNavItemActive("/dashboard/vendors", "/dashboard/vendors")).toBe(true);
    expect(isNavItemActive("/dashboard/vendors/123", "/dashboard/vendors")).toBe(true);
  });

  it("does not match an unrelated route that merely starts with the same string", () => {
    expect(isNavItemActive("/dashboard/vendors-extra", "/dashboard/vendors")).toBe(false);
  });
});

describe("findNavItem", () => {
  it("finds the nav item matching the current path", () => {
    expect(findNavItem("/dashboard/vendors")?.href).toBe("/dashboard/vendors");
  });

  it("returns undefined for a path with no match", () => {
    expect(findNavItem("/nowhere")).toBeUndefined();
  });

  it("picks the longest matching href when routes could nest", () => {
    // /dashboard/vendors/123 matches both "/dashboard" (if it were a prefix,
    // which it isn't per isNavItemActive) and "/dashboard/vendors" — longest wins.
    expect(findNavItem("/dashboard/vendors/123")?.href).toBe("/dashboard/vendors");
  });
});
