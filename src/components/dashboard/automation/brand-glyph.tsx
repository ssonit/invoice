import { resolveBrandGlyph } from "@/lib/automation/brand-glyph";

/**
 * Brand mark for an agent, or a letter tile when the icon set ships none.
 * Both render in the same 28px rounded tile so a mixed grid stays aligned.
 * The mark inherits the foreground token rather than its brand hex, so it
 * reads correctly in both themes and does not introduce a second accent.
 */
export function BrandGlyph({ name, slug }: { name: string; slug?: string }) {
  const glyph = slug ? resolveBrandGlyph(slug) : null;

  if (!glyph) {
    return (
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-muted font-mono text-[11px] font-medium uppercase text-muted-foreground"
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-muted">
      <svg role="img" aria-label={glyph.title} viewBox="0 0 24 24" className="size-4 fill-foreground">
        <path d={glyph.path} />
      </svg>
    </span>
  );
}
