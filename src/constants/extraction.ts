// Confidence below which an extraction is flagged for manual review
// (`needs_review`), and below which a local text-only extraction escalates
// to the full vision model instead of being trusted as-is.
export const EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD = 0.7;
