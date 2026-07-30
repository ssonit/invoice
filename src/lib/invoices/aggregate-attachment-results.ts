import type { ProcessExtractionResult, SavedInvoiceSummary } from "./process-extraction";

/**
 * One attachment's outcome from `tasks.batchTriggerAndWait`: either the task
 * run completed (whatever processExtraction decided) or the task itself
 * failed after exhausting its own retries. Declared locally rather than
 * imported from @trigger.dev/sdk's TaskRunResult so this stays a plain
 * function, testable with object literals and no SDK types involved.
 */
export type AttachmentTaskRun =
  | { ok: true; output: ProcessExtractionResult }
  | { ok: false; error: unknown };

/** Pulls the invoices actually saved out of a batch of attachment task runs. */
export function aggregateAttachmentResults(
  runs: readonly AttachmentTaskRun[],
): SavedInvoiceSummary[] {
  const saved: SavedInvoiceSummary[] = [];
  for (const run of runs) {
    if (!run.ok) continue;
    if (run.output.saved) saved.push(run.output.invoice);
  }
  return saved;
}
