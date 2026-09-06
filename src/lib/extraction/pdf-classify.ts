import "server-only";

type PdfInspector = typeof import("@firecrawl/pdf-inspector");

export type PdfClassificationResult = {
  pdfType: string;
  // Non-null only when the PDF is confidently TextBased and extraction
  // produced non-empty content. Every other case — Scanned/ImageBased/Mixed,
  // an empty result, or a thrown error — returns null so the caller falls
  // back to sending the raw file to a vision model.
  markdown: string | null;
};

/**
 * Local, offline PDF classification + text extraction — no network call, no
 * LLM. Never throws: any failure from the native module is caught and
 * reported as an unclassifiable PDF (pdfType: "unknown", markdown: null) so
 * callers can treat it identically to a Scanned result.
 */
export async function classifyPdf(data: Buffer): Promise<PdfClassificationResult> {
  let classification: Awaited<ReturnType<PdfInspector["classifyPdfAsync"]>>;
  let extractPagesMarkdownAsync: PdfInspector["extractPagesMarkdownAsync"];
  try {
    const inspector = await import("@firecrawl/pdf-inspector");
    classification = await inspector.classifyPdfAsync(data);
    extractPagesMarkdownAsync = inspector.extractPagesMarkdownAsync;
  } catch (err) {
    console.error("PDF classification failed", err);
    return { pdfType: "unknown", markdown: null };
  }

  if (classification.pdfType !== "TextBased") {
    return { pdfType: classification.pdfType, markdown: null };
  }

  try {
    const { pages } = await extractPagesMarkdownAsync(data);
    const markdown = pages
      .map((page) => page.markdown)
      .join("\n\n")
      .trim();
    return { pdfType: classification.pdfType, markdown: markdown.length > 0 ? markdown : null };
  } catch (err) {
    console.error("PDF text extraction failed after TextBased classification", err);
    return { pdfType: classification.pdfType, markdown: null };
  }
}
