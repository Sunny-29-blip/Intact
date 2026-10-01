import { z } from "zod";

/**
 * Validation schema for creating a user profile.
 */
export const createProfileSchema = z.object({
  role: z.enum(["tenant", "owner"], {
    errorMap: () => ({ message: "Role must be 'tenant' or 'owner'" }),
  }),
  display_name: z.string().trim().max(100, "Name is too long").optional().nullable(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

/**
 * Validation schema for updating user profile.
 */
export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name cannot be empty").max(100, "Name is too long").optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Validation schema for creating an owner property.
 */
export const createOwnerPropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(150, "Property name is too long"),
  address: z.string().trim().min(1, "Address is required").max(500, "Address is too long"),
  owner_name: z.string().trim().min(1, "Owner name is required").max(100, "Owner name is too long"),
  city: z.string().trim().max(100, "City is too long").optional().nullable(),
});

export type CreateOwnerPropertyInput = z.infer<typeof createOwnerPropertySchema>;

/**
 * Validation schema for updating an owner property.
 */
export const updateOwnerPropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(150, "Property name is too long").optional(),
  address: z.string().trim().min(1, "Address is required").max(500, "Address is too long").optional(),
  owner_name: z.string().trim().min(1, "Owner name is required").max(100, "Owner name is too long").optional(),
  city: z.string().trim().max(100, "City is too long").optional().nullable(),
});

export type UpdateOwnerPropertyInput = z.infer<typeof updateOwnerPropertySchema>;

/**
 * Validation schema for linking a tenant property to an owner property.
 */
export const linkTenancySchema = z.object({
  joinCode: z.string().trim().min(6, "Join code must be at least 6 characters").max(20, "Join code is too long"),
  propertyId: z.string().uuid("Invalid property ID"),
});

export type LinkTenancyInput = z.infer<typeof linkTenancySchema>;

/**
 * Validation schema for updating tenancy link sharing status.
 */
export const updateLinkShareSchema = z.object({
  shared: z.boolean(),
});

export type UpdateLinkShareInput = z.infer<typeof updateLinkShareSchema>;

/**
/**
 * Validation schema for issue types in findings.
 */
export const issueTypeSchema = z.enum(
  ["scratch", "crack", "stain", "hole", "missing_item", "mark", "other"],
  {
    errorMap: () => ({ message: "Invalid issue type" }),
  }
);

export type IssueTypeInput = z.infer<typeof issueTypeSchema>;

/**
 * Validation schema for creating a new tenant property.
 */
export const createPropertySchema = z
  .object({
    tenant_name: z.string().trim().min(1, "Your name is required").max(100, "Name is too long").optional().nullable(),
    name: z.string().trim().min(1, "Flat or house name is required").max(255, "Name is too long"),
    address: z.string().trim().min(1, "Address is required").max(500, "Address is too long").optional().nullable(),
    tenancy_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Contract start date must be a valid date (YYYY-MM-DD)"),
    tenancy_end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Contract valid until date must be a valid date (YYYY-MM-DD)")
      .optional()
      .nullable(),
    lease_notes: z.string().max(2000, "Lease notes are too long").optional().nullable(),
    is_quick_check: z.boolean().optional(),
  })
  .refine(
    (data) => !data.tenancy_end || !data.tenancy_start || data.tenancy_end > data.tenancy_start,
    {
      message: "Contract valid until date must be after contract start date",
      path: ["tenancy_end"],
    }
  );

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

/**
 * Validation schema for updating an existing tenant property.
 */
export const updatePropertySchema = z.object({
  tenant_name: z.string().trim().min(1, "Your name is required").max(100, "Name is too long").optional().nullable(),
  name: z.string().trim().min(1, "Flat or house name is required").max(255, "Name is too long").optional(),
  address: z.string().trim().min(1, "Address is required").max(500, "Address is too long").optional().nullable(),
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
  is_quick_check: z.boolean().optional(),
});

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

/**
 * Validation schema for registering an uploaded document.
 */
export const registerDocumentSchema = z.object({
  kind: z.enum(["property_evidence", "tenancy_contract"], {
    errorMap: () => ({ message: "Kind must be 'property_evidence' or 'tenancy_contract'" }),
  }),
  owner_property_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  storage_path: z.string().min(1, "Storage path is required"),
  original_name: z.string().min(1, "Original file name is required").max(255, "File name is too long"),
  mime_type: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"], {
    errorMap: () => ({ message: "Allowed file types: PDF, JPEG, PNG, WebP" }),
  }),
  size_bytes: z
    .number()
    .int()
    .positive("File cannot be empty")
    .max(10 * 1024 * 1024, "File size must not exceed 10 MB"),
  sha256: z.string().optional().nullable(),
});

export type RegisterDocumentInput = z.infer<typeof registerDocumentSchema>;

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
export const createPhotoSchema = registerPhotoSchema;
export type CreatePhotoInput = RegisterPhotoInput;

/**
 * Validation schema for triggering a comparison between move-in and move-out photos.
 */
export const createComparisonSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  area: z.string().trim().min(1, "Area name is required").max(100, "Area name is too long"),
});

export type CreateComparisonInput = z.infer<typeof createComparisonSchema>;

/**
 * Validation schema for updating a finding's decision (accept / dispute / pending).
 */
export const updateFindingDecisionSchema = z.object({
  decision: z.enum(["accepted", "disputed", "pending"], {
    errorMap: () => ({ message: "Decision must be 'accepted', 'disputed', or 'pending'" }),
  }),
  note: z.string().trim().max(500, "Note must not exceed 500 characters").optional().nullable(),
});

export type UpdateFindingDecisionInput = z.infer<typeof updateFindingDecisionSchema>;

/**
 * Validation schema for authentication (login/signup).
 */
export const authSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AuthInput = z.infer<typeof authSchema>;
