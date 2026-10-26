"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Settled<T> = { key: string; data: T | null }

type ReportRpcState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T }

/**
 * Calls a Supabase RPC (RLS-scoped, browser client) once `enabled` is true and
 * re-calls when `args` change. `parse` must be a stable (module-level)
 * validator that returns null for a malformed payload. Malformed payloads and
 * RPC errors are logged and surface as `status: "error"` — never the raw error.
 */
export function useReportRpc<T>({
  fn,
  args,
  parse,
  enabled,
}: {
  fn: string
  args: Record<string, string | number | null>
  parse: (payload: unknown) => T | null
  enabled: boolean
}): ReportRpcState<T> & { retry: () => void } {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const argsKey = JSON.stringify(args)
  const requestKey = `${argsKey}:${attempt}`

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    createClient()
      .rpc(fn, JSON.parse(argsKey))
      .then(({ data, error }) => {
        if (cancelled) return
        const parsed = error ? null : parse(data)
        if (!parsed) console.error(`Failed to load ${fn}`, error ?? "malformed payload")
        setSettled({ key: requestKey, data: parsed })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, fn, argsKey, requestKey, parse])

  const retry = () => setAttempt((n) => n + 1)

  if (!settled || settled.key !== requestKey) return { status: "loading", retry }
  if (!settled.data) return { status: "error", retry }
  return { status: "ready", data: settled.data, retry }
}
