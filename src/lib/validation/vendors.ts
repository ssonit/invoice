import { z } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const vendorNameSchema = z
  .string()
  .trim()
  .min(1, "Vendor name is required")
  .max(200, "Vendor name is too long");

const vendorNotesSchema = z
  .string()
  .trim()
  .max(1000, "Notes are too long")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const createVendorSchema = z.object({
  name: vendorNameSchema,
  notes: vendorNotesSchema,
});

export const updateVendorSchema = z.object({
  id: z.string().uuid("Invalid vendor id"),
  name: vendorNameSchema,
  notes: vendorNotesSchema,
});

export const deleteVendorSchema = z.object({
  id: z.string().uuid("Invalid vendor id"),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type DeleteVendorInput = z.infer<typeof deleteVendorSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function parseCreateVendorInput(input: unknown): ValidationResult<CreateVendorInput> {
  const result = createVendorSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}

export function parseUpdateVendorInput(input: unknown): ValidationResult<UpdateVendorInput> {
  const result = updateVendorSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}

export function parseDeleteVendorInput(input: unknown): ValidationResult<DeleteVendorInput> {
  const result = deleteVendorSchema.safeParse(input);
  if (!result.success) return { success: false, error: firstIssue(result.error) };
  return { success: true, data: result.data };
}
