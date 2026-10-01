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
 * Validation schema for updating an existing property.
 */
export const updatePropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(255, "Property name is too long").optional(),
  address: z.string().trim().max(500, "Address is too long").optional().nullable(),
  tenancy_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tenancy start must be a valid date (YYYY-MM-DD)")
    .optional(),
  tenancy_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tenancy end must be a valid date (YYYY-MM-DD)")
    .optional()
    .nullable(),
  lease_notes: z.string().max(2000, "Lease notes are too long").optional().nullable(),
});

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

/**
 * Validation schema for getting or creating an inspection.
 */
export const getOrCreateInspectionSchema = z.object({
  kind: z.enum(["move_in", "move_out"], {
    errorMap: () => ({ message: "Kind must be 'move_in' or 'move_out'" }),
  }),
});

export type GetOrCreateInspectionInput = z.infer<typeof getOrCreateInspectionSchema>;

/**
 * Validation schema for registering an uploaded photo.
 */
export const registerPhotoSchema = z.object({
  inspection_id: z.string().uuid("Invalid inspection ID").optional(),
  inspectionId: z.string().uuid("Invalid inspection ID").optional(),
  area: z.string().trim().min(1, "Area is required").max(100, "Area name is too long"),
  storage_path: z.string().trim().min(1, "Storage path is required").optional(),
  storagePath: z.string().trim().min(1, "Storage path is required").optional(),
  sha256: z.string().trim().length(64, "SHA-256 hash must be exactly 64 hex characters"),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
}).refine((data) => data.inspection_id || data.inspectionId, {
  message: "inspection_id or inspectionId is required",
  path: ["inspection_id"],
}).refine((data) => data.storage_path || data.storagePath, {
  message: "storage_path or storagePath is required",
  path: ["storage_path"],
});

export type RegisterPhotoInput = z.infer<typeof registerPhotoSchema>;

/**
 * Legacy schema alias for backward compatibility.
 */
export const createPhotoSchema = registerPhotoSchema;
export type CreatePhotoInput = RegisterPhotoInput;

/**
 * Validation schema for authentication (login/signup).
 */
export const authSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AuthInput = z.infer<typeof authSchema>;
