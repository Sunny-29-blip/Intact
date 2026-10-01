import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrCreateInspectionSchema } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: propertyId } = await params;
    if (!propertyId) {
      return apiError("INVALID_ID", "Property ID is required", 400);
    }

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

    const validation = getOrCreateInspectionSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid inspection input",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const { kind } = validation.data;

    // Verify property ownership
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("user_id", user.id)
      .single();

    if (propertyError || !property) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    // Check if inspection already exists
    const { data: existing, error: findError } = await supabase
      .from("inspections")
      .select("*")
      .eq("property_id", propertyId)
      .eq("kind", kind)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return apiSuccess(existing, 200);
    }

    // Otherwise create it
    const { data: newInspection, error: insertError } = await supabase
      .from("inspections")
      .insert({
        user_id: user.id,
        property_id: propertyId,
        kind,
      })
      .select()
      .single();

    if (insertError || !newInspection) {
      console.error("[POST /api/properties/[id]/inspections] Insert error:", insertError);
      return apiError("DB_ERROR", "Failed to create inspection", 500);
    }

    return apiSuccess(newInspection, 201);
  } catch (err) {
    console.error("[POST /api/properties/[id]/inspections] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
