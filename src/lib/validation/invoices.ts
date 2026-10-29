import { z } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Form fields arrive as strings; blank means "no value".
const blankToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (label: string, max: number) =>
  z.preprocess(
    blankToNull,
    z.string().trim().max(max, `${label} is too long`).nullable(),
  );

const optionalDate = (label: string) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .refine(isRealDate, `${label} must be a valid date (YYYY-MM-DD)`)
      .nullable(),
  );

const optionalMoney = (label: string) =>
  z.preprocess(
    (v) => {
      const blank = blankToNull(v);
      if (typeof blank === "string") return Number(blank.replace(/,/g, ""));
      return blank;
    },
    z
      .number(`${label} must be a number`)
      .finite(`${label} must be a number`)
      .nullable(),
  );

const currencySchema = z.preprocess(
  (v) => {
    const blank = blankToNull(v);
    return typeof blank === "string" ? blank.trim().toUpperCase() : blank;
  },
  z
    .string()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code, e.g. USD")
    .nullable(),
);

const invoiceIdSchema = z.string().uuid("Invalid invoice id");

export const updateInvoiceSchema = z.object({
  id: invoiceIdSchema,
  vendor: optionalText("Vendor", 200),
  invoice_number: optionalText("Invoice number", 100),
  amount: optionalMoney("Amount"),
  currency: currencySchema,
  issue_date: optionalDate("Invoice date"),
  due_date: optionalDate("Due date"),
  tax: optionalMoney("Tax"),
  // Only supplied when the user explicitly saves a new extraction preview.
  line_items: z.array(z.object({
    description: z.string().max(4000),
    quantity: z.number().finite().nullable(),
    unit_price: z.number().finite().nullable(),
    amount: z.number().finite().nullable(),
  })).max(1000).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const INVOICE_REVIEW_STATUS = {
  APPROVED: "approved",
  REVIEW: "review",
} as const;

export const setInvoiceReviewSchema = z.object({
  id: invoiceIdSchema,
  status: z.enum([INVOICE_REVIEW_STATUS.APPROVED, INVOICE_REVIEW_STATUS.REVIEW]),
});

export type SetInvoiceReviewInput = z.infer<typeof setInvoiceReviewSchema>;

export const retryExtractionSchema = z.object({ id: invoiceIdSchema });

function parseWith<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  return { success: true, data: result.data };
}

export function parseUpdateInvoiceInput(input: unknown) {
  return parseWith(updateInvoiceSchema, input);
}

export function parseSetInvoiceReviewInput(input: unknown) {
  return parseWith(setInvoiceReviewSchema, input);
}

export function parseRetryExtractionInput(input: unknown) {
  return parseWith(retryExtractionSchema, input);
}

export function parseDeleteInvoiceInput(input: unknown) {
  return parseWith(retryExtractionSchema, input);
}
