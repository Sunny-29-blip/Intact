import { z } from "zod";

/**
 * Validation schema for creating a new property.
 */
export const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(255, "Property name is too long"),
  address: z.string().trim().max(500, "Address is too long").optional().nullable(),
  tenancy_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tenancy start must be a valid date (YYYY-MM-DD)"),
  tenancy_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tenancy end must be a valid date (YYYY-MM-DD)")
    .optional()
    .nullable(),
  lease_notes: z.string().max(2000, "Lease notes are too long").optional().nullable(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

/**
 * Validation schema for recording an uploaded photo.
 */
export const createPhotoSchema = z.object({
  inspection_id: z.string().uuid("Invalid inspection ID"),
  area: z.string().trim().min(1, "Area is required").max(100, "Area name is too long"),
  storage_path: z.string().trim().min(1, "Storage path is required"),
  sha256: z.string().trim().length(64, "SHA-256 hash must be exactly 64 characters"),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;
