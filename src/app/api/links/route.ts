import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { linkTenancySchema } from "@/lib/validation";
import type { TenantLinkedOwnerProperty } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to view tenancy links", 401);
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const adminSupabase = createAdminClient();

    let query = adminSupabase
      .from("tenancy_links")
      .select(`
        id,
        owner_property_id,
        tenant_property_id,
        shared,
        created_at,
        owner_properties (
          id,
          name,
          address,
          city
        )
      `)
      .eq("tenant_id", user.id);

    if (propertyId) {
      query = query.eq("tenant_property_id", propertyId);
    }

    const { data: links, error: linksError } = await query.order("created_at", { ascending: false });

    if (linksError) {
      console.error("[GET /api/links] DB Error:", linksError);
      return apiError("INTERNAL_ERROR", "Failed to retrieve tenancy links", 500);
    }

    const formatted: TenantLinkedOwnerProperty[] = (links || []).map((l: any) => ({
      link_id: l.id,
      owner_property_id: l.owner_property_id,
      tenant_property_id: l.tenant_property_id,
      name: l.owner_properties?.name || "Owner Property",
      address: l.owner_properties?.address || null,
      city: l.owner_properties?.city || null,
      shared: l.shared,
      linked_at: l.created_at,
    }));

    return apiSuccess(formatted);
  } catch (err) {
    console.error("[GET /api/links] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to load tenancy links", 500);
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
      return apiError("UNAUTHORIZED", "You must be logged in to link a property", 401);
    }

    const json = await request.json().catch(() => ({}));
    const validation = linkTenancySchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid join code format", 400, validation.error.flatten().fieldErrors);
    }

    const { joinCode, propertyId } = validation.data;
    const adminSupabase = createAdminClient();

    // 1. Verify tenant owns the tenant property
    const { data: tenantProp, error: propError } = await adminSupabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (propError || !tenantProp) {
      return apiError("NOT_FOUND", "Tenant property record not found", 404);
    }

    // 2. Look up owner property by join code (case-insensitive)
    const { data: ownerProp, error: ownerPropError } = await adminSupabase
      .from("owner_properties")
      .select("id, name, address, city")
      .ilike("join_code", joinCode.trim())
      .maybeSingle();

    if (ownerPropError || !ownerProp) {
      return apiError("NOT_FOUND", "Code not recognised", 404);
    }

    // 3. Upsert tenancy link
    const { data: link, error: linkError } = await adminSupabase
      .from("tenancy_links")
      .upsert(
        {
          owner_property_id: ownerProp.id,
          tenant_id: user.id,
          tenant_property_id: propertyId,
          shared: false,
        },
        { onConflict: "owner_property_id,tenant_id" }
      )
      .select()
      .single();

    if (linkError) {
      console.error("[POST /api/links] Insert Error:", linkError);
      return apiError("INTERNAL_ERROR", "Failed to link tenancy", 500);
    }

    const result: TenantLinkedOwnerProperty = {
      link_id: link.id,
      owner_property_id: ownerProp.id,
      tenant_property_id: propertyId,
      name: ownerProp.name,
      address: ownerProp.address,
      city: ownerProp.city,
      shared: link.shared,
      linked_at: link.created_at,
    };

    return apiSuccess(result, 201);
  } catch (err) {
    console.error("[POST /api/links] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to process tenancy link", 500);
  }
}
