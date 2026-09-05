import { describe, expect, it, vi } from "vitest";
import { runWithConcurrencyLimit } from "./run-with-limit";

describe("runWithConcurrencyLimit", () => {
  it("returns results in input order regardless of completion order", async () => {
    const worker = async (item: number) => {
      await new Promise((r) => setTimeout(r, item === 1 ? 20 : 5));
      return item * 10;
    };
    const results = await runWithConcurrencyLimit([1, 2, 3], 3, worker);
    expect(results).toEqual([10, 20, 30]);
  });

  it("never runs more than `limit` workers concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const worker = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    };
    await runWithConcurrencyLimit([1, 2, 3, 4, 5], 2, worker);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("passes the index of each item to the worker", async () => {
    const seen: number[] = [];
    await runWithConcurrencyLimit(["a", "b", "c"], 1, async (_item, index) => {
      seen.push(index);
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("returns an empty array for an empty input without calling the worker", async () => {
    const worker = vi.fn();
    const results = await runWithConcurrencyLimit([], 3, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it("still runs everything when limit exceeds the item count", async () => {
    const results = await runWithConcurrencyLimit([1, 2], 10, async (item) => item);
    expect(results).toEqual([1, 2]);
  });
});
