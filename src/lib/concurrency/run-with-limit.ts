/**
 * Runs `worker` over `items` with at most `limit` calls in flight at once.
 * Results are returned in the same order as `items`, regardless of
 * completion order — matches how Trigger.dev's `batchTriggerAndWait` reports
 * batch results, so callers can zip results back to their inputs by index.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runLane(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]!, index);
    }
  }

  const laneCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: laneCount }, () => runLane()));
  return results;
}
