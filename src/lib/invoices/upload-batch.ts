import type { QuotaStatus } from "@/lib/billing/usage";

export type FileBatchSplit<T> = { toUpload: T[]; skipped: T[] };

/**
 * Caps a batch of files to the user's remaining Starter-quota slots before
 * any of them are sent to the server — closes the race where N parallel
 * upload requests each read "quota not yet reached" before any of their
 * writes land. Files beyond the remaining slots are skipped client-side
 * without spending a request or an LLM call.
 */
export function splitFilesByQuota<T>(
  files: readonly T[],
  quota: QuotaStatus,
): FileBatchSplit<T> {
  if (quota.unlimited) {
    return { toUpload: [...files], skipped: [] };
  }
  const remaining = quota.limit - quota.used;
  if (!Number.isFinite(remaining)) {
    return { toUpload: [...files], skipped: [] };
  }
  const slots = Math.max(0, remaining);
  return {
    toUpload: files.slice(0, slots),
    skipped: files.slice(slots),
  };
}
