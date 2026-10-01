import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { registerPhotoSchema } from "@/lib/validation";
import type { PhotoWithUrl } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return apiError("INVALID_JSON", "Invalid JSON body", 400);
    }

    const validation = registerPhotoSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid photo registration input",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const input = validation.data;
    const inspectionId = input.inspection_id || input.inspectionId!;
    const storagePath = input.storage_path || input.storagePath!;

    // Verify inspection ownership
    const { data: inspection, error: inspectionError } = await supabase
      .from("inspections")
      .select("id, property_id, kind, user_id")
      .eq("id", inspectionId)
      .eq("user_id", user.id)
      .single();

    if (inspectionError || !inspection) {
      return apiError("NOT_FOUND", "Inspection not found or unauthorized", 404);
    }

    // Strict Security Check: Ensure storagePath starts with {user_id}/{property_id}/{kind}/
    const expectedPrefix = `${user.id}/${inspection.property_id}/${inspection.kind}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return apiError(
        "INVALID_STORAGE_PATH",
        `Storage path must follow convention: ${expectedPrefix}{filename}`,
        400
      );
    }

    // Insert photo record
    const { data: photo, error: insertError } = await supabase
      .from("photos")
      .insert({
        user_id: user.id,
        inspection_id: inspectionId,
        area: input.area,
        storage_path: storagePath,
        sha256: input.sha256,
        width: input.width || null,
        height: input.height || null,
      })
      .select()
      .single();

    if (insertError || !photo) {
      console.error("[POST /api/photos] Insert error:", insertError);
      return apiError("DB_ERROR", "Failed to register photo", 500);
    }

    // Generate signed URL for response
    const { data: signedData } = await supabase.storage
      .from("inspection-photos")
      .createSignedUrl(storagePath, 3600);

    const result: PhotoWithUrl = {
      ...photo,
      signed_url: signedData?.signedUrl || undefined,
    };

    return apiSuccess(result, 201);
  } catch (err) {
    console.error("[POST /api/photos] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
