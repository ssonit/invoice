import Link from "next/link"
import {
  CheckCircle2,
  Mail,
  ScanLine,
  Table2,
} from "lucide-react"

import { BrandLogo } from "@/components/landing/brand-logo"

const features = [
  {
    icon: Mail,
    title: "Forward & forget",
    desc: "Send invoices to your inbox address.",
  },
  {
    icon: ScanLine,
    title: "AI extraction",
    desc: "Vendor, amount, dates - read automatically.",
  },
  {
    icon: Table2,
    title: "One clean list",
    desc: "Every invoice, searchable in one place.",
  },
]

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0a0a0a] lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="auth-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />

      <Link href="/" className="relative z-10 inline-flex w-fit transition-opacity hover:opacity-90">
        <BrandLogo />
      </Link>

      <div className="relative z-10 flex flex-col gap-8">
        <div>
          <h2 className="max-w-md font-[family-name:var(--font-outfit)] text-3xl font-semibold leading-tight tracking-tight text-zinc-50 xl:text-4xl">
            Your invoices,{" "}
            <span className="bg-linear-to-r from-[#E8FF47] to-[#34d399] bg-clip-text text-transparent">
              read for you.
            </span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Forward an email or drop a PDF. We pull out every field and keep it
            all in one tidy dashboard.
          </p>
        </div>

        <div className="auth-float auth-scan relative w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
              Invoice
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E8FF47]/25 bg-[#E8FF47]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#E8FF47]">
              <CheckCircle2 className="size-3" />
              Extracted
            </span>
          </div>
          <dl className="mt-5 flex flex-col gap-3">
            {[
              ["Vendor", "Acme Cloud Ltd."],
              ["Amount", "1,284.00 USD"],
              ["Issued", "2026-07-14"],
              ["Due", "2026-08-13"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-xs text-zinc-500">{k}</dt>
                <dd className="font-mono text-xs text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <ul className="relative z-10 flex flex-col gap-4">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <li key={f.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E8FF47]/12 text-[#E8FF47]">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-100">{f.title}</p>
                <p className="text-xs text-zinc-500">{f.desc}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
