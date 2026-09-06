-- Records how a PDF extraction was produced: "local_text" (pdf-inspector
-- extracted the text locally; only a cheap text-only LLM call was made),
-- "vision" (sent as a document/image block to a vision model — today's
-- original behavior), or "vision_fallback" (local extraction was tried but
-- its confidence was too low, so it re-ran through vision). Null for image
-- and HTML-body inputs, which this feature does not route.
alter table public.invoices
  add column extraction_method text;
