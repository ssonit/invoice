import {
  siClaude,
  siCline,
  siCursor,
  siGooglegemini,
  type SimpleIcon,
} from "simple-icons";

export type BrandGlyph = { title: string; path: string; hex: string };

// Only the marks the icon set actually ships for our agents. Adding an agent
// with a mark means adding it here; brand-glyph.test.ts fails if a registry
// iconSlug has no entry.
const GLYPHS: Record<string, SimpleIcon> = {
  claude: siClaude,
  cline: siCline,
  cursor: siCursor,
  googlegemini: siGooglegemini,
};

export function resolveBrandGlyph(slug: string): BrandGlyph | null {
  const icon = GLYPHS[slug];
  if (!icon) return null;
  return { title: icon.title, path: icon.path, hex: icon.hex };
}
