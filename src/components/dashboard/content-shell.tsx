import { Separator } from "@/components/ui/separator";

interface ContentShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// Standard page wrapper. Every dashboard page uses this — no custom headers.
export function ContentShell({
  title,
  description,
  actions,
  children,
}: ContentShellProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-[2px] text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <Separator />
      <div className="mt-5">{children}</div>
    </div>
  );
}
