import { Receipt, Mail, ScanLine, Table2, CheckCircle2 } from "lucide-react";

const features = [
  { icon: Mail, title: "Forward & forget", desc: "Send invoices to your inbox address." },
  { icon: ScanLine, title: "AI extraction", desc: "Vendor, amount, dates — read automatically." },
  { icon: Table2, title: "One clean list", desc: "Every invoice, searchable in one place." },
];

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-nav-bg lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="auth-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-nav-active text-nav-text">
          <Receipt className="size-[15px]" strokeWidth={1.75} />
        </span>
        <span className="text-[14px] font-semibold text-nav-text">Invoice Reader</span>
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-nav-text">
            Your invoices, read for you.
          </h2>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-nav-muted">
            Forward an email or drop a PDF. We pull out every field and keep it
            all in one tidy dashboard.
          </p>
        </div>

        <div className="auth-float auth-scan relative w-full max-w-xs overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-nav-label">
              Invoice
            </span>
            <span className="inline-flex items-center gap-1 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-[2px] text-[11px] font-medium text-emerald-400">
              <CheckCircle2 className="size-3" />
              Extracted
            </span>
          </div>
          <dl className="mt-4 flex flex-col gap-2.5">
            {[
              ["Vendor", "Acme Cloud Ltd."],
              ["Amount", "1,284.00 USD"],
              ["Issued", "2026-07-14"],
              ["Due", "2026-08-13"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <dt className="text-[12px] text-nav-muted">{k}</dt>
                <dd className="font-mono text-[12px] text-nav-text">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <ul className="relative z-10 flex flex-col gap-4">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.title} className="flex items-start gap-3">
              <span className="mt-[2px] flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-nav-active text-nav-text">
                <Icon className="size-[15px]" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-nav-text">{f.title}</p>
                <p className="text-[12px] text-nav-muted">{f.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
