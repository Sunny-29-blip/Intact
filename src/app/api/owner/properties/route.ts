import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createOwnerPropertySchema } from "@/lib/validation";
import { generateJoinCode } from "@/lib/join-code";
import type { OwnerProperty } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to view owner properties", 401);
    }

    const adminSupabase = createAdminClient();

    // Verify user is an owner
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile && profile.role !== "owner") {
      return apiError("FORBIDDEN", "Only registered owner accounts can access this resource", 403);
    }

    // Fetch owner's properties
    const { data: properties, error: fetchError } = await adminSupabase
      .from("owner_properties")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("[GET /api/owner/properties] DB Error:", fetchError);
      return apiError("INTERNAL_ERROR", "Failed to retrieve properties", 500);
    }

    const propertyIds = (properties || []).map((p) => p.id);

    // Fetch linked tenants count for these properties
    let linkCounts: Record<string, number> = {};
    if (propertyIds.length > 0) {
      const { data: links } = await adminSupabase
        .from("tenancy_links")
        .select("owner_property_id")
        .in("owner_property_id", propertyIds);

      (links || []).forEach((link) => {
        linkCounts[link.owner_property_id] = (linkCounts[link.owner_property_id] || 0) + 1;
      });
    }

    const propertiesWithCount: OwnerProperty[] = (properties || []).map((p) => ({
      ...p,
      linked_tenants_count: linkCounts[p.id] || 0,
    }));

    return apiSuccess(propertiesWithCount);
  } catch (err) {
    console.error("[GET /api/owner/properties] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to load owner properties", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to register a property", 401);
    }

    const adminSupabase = createAdminClient();

    // Verify user role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile && profile.role !== "owner") {
      return apiError("FORBIDDEN", "Only registered owner accounts can register owner properties", 403);
    }

    const json = await request.json().catch(() => ({}));
    const validation = createOwnerPropertySchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid property fields", 400, validation.error.flatten().fieldErrors);
    }

    const { name, address, city } = validation.data;

    // Generate unique join code with retry
    let joinCode = "";
    let inserted = null;

    for (let attempts = 0; attempts < 5; attempts++) {
      joinCode = generateJoinCode(8);
      const { data, error } = await adminSupabase
        .from("owner_properties")
        .insert({
          owner_id: user.id,
          name,
          address: address || null,
          city: city || null,
          join_code: joinCode,
        })
        .select()
        .single();

      if (!error && data) {
        inserted = data;
        break;
      }
    }

    if (!inserted) {
      return apiError("INTERNAL_ERROR", "Could not generate unique property join code. Please try again.", 500);
    }

    return apiSuccess({
      ...inserted,
      linked_tenants_count: 0,
    }, 201);
  } catch (err) {
    console.error("[POST /api/owner/properties] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to register property", 500);
  }
}
