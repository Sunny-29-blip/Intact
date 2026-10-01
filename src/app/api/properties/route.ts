import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createPropertySchema } from "@/lib/validation";
import type { PropertyListItem } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    // Fetch user's properties
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (propertiesError) {
      console.error("[GET /api/properties] DB error:", propertiesError);
      return apiError("DB_ERROR", "Failed to fetch properties", 500);
    }

    // Fetch inspections with photo counts
    const { data: inspections, error: inspectionsError } = await supabase
      .from("inspections")
      .select("id, property_id, kind, photos(count)")
      .eq("user_id", user.id);

    if (inspectionsError) {
      console.error("[GET /api/properties] Inspections error:", inspectionsError);
    }

    // Map photo counts per property
    const inspectionMap = new Map<string, { move_in: number; move_out: number }>();
    (inspections || []).forEach((insp) => {
      const current = inspectionMap.get(insp.property_id) || { move_in: 0, move_out: 0 };
      const photoCount = Array.isArray(insp.photos) && insp.photos[0] ? (insp.photos[0] as { count: number }).count : 0;
      if (insp.kind === "move_in") current.move_in = photoCount;
      if (insp.kind === "move_out") current.move_out = photoCount;
      inspectionMap.set(insp.property_id, current);
    });

    const enrichedProperties: PropertyListItem[] = (properties || []).map((prop) => {
      const counts = inspectionMap.get(prop.id) || { move_in: 0, move_out: 0 };
      return {
        ...prop,
        move_in_count: counts.move_in,
        move_out_count: counts.move_out,
      };
    });

    return apiSuccess(enrichedProperties);
  } catch (err) {
    console.error("[GET /api/properties] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

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

    const validation = createPropertySchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid property input",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const input = validation.data;

    // Insert property with authenticated user ID
    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        user_id: user.id,
        name: input.name,
        address: input.address || null,
        tenancy_start: input.tenancy_start,
        tenancy_end: input.tenancy_end || null,
        lease_notes: input.lease_notes || null,
      })
      .select()
      .single();

    if (insertError || !property) {
      console.error("[POST /api/properties] Insert error:", insertError);
      return apiError("DB_ERROR", "Failed to create property", 500);
    }

    // Pre-create move_in and move_out inspection containers for the property
    const { error: inspError } = await supabase.from("inspections").insert([
      { user_id: user.id, property_id: property.id, kind: "move_in" },
      { user_id: user.id, property_id: property.id, kind: "move_out" },
    ]);

    if (inspError) {
      console.error("[POST /api/properties] Inspection initialization error:", inspError);
      // Non-fatal since property was created and inspections can be created on-demand
    }

    return apiSuccess(property, 201);
  } catch (err) {
    console.error("[POST /api/properties] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
