import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createPropertySchema } from "@/lib/validation";
import type { PropertyListItem } from "@/types/database";

function generateRefId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export async function GET(request: NextRequest) {
  const refId = generateRefId();
  try {
    const { searchParams } = new URL(request.url);
    const includeQuickCheck = searchParams.get("includeQuickCheck") === "true";

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    // Auto-create profile if missing
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { error: profErr } = await adminSupabase
        .from("profiles")
        .insert({ user_id: user.id, role: "tenant", display_name: null });
      if (profErr) {
        console.error(`[${refId}] [GET /api/properties] Auto-create profile notice:`, profErr);
      }
    }

    // Fetch user's properties with graceful fallback if column is_quick_check does not exist
    let properties: any[] | null = null;
    let propertiesError: any = null;

    if (!includeQuickCheck) {
      const qRes = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id)
        .neq("is_quick_check", true)
        .order("created_at", { ascending: false });

      if (qRes.error && qRes.error.code === "42703") {
        // column is_quick_check does not exist yet, fallback to all properties
        const fallbackRes = await supabase
          .from("properties")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        properties = fallbackRes.data;
        propertiesError = fallbackRes.error;
      } else {
        properties = qRes.data;
        propertiesError = qRes.error;
      }
    } else {
      const qRes = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      properties = qRes.data;
      propertiesError = qRes.error;
    }

    if (propertiesError) {
      console.error(`[${refId}] [GET /api/properties] Properties DB error:`, {
        code: propertiesError.code,
        message: propertiesError.message,
        details: propertiesError.details,
        hint: propertiesError.hint,
      });
      return apiError("DB_ERROR", `Failed to fetch properties. (ref ${refId})`, 500);
    }

    // If properties list is empty, return empty array immediately (empty state in UI)
    if (!properties || properties.length === 0) {
      return apiSuccess([]);
    }

    // Fetch inspections, documents, and tenancy links gracefully
    const [
      { data: inspections, error: inspectionsError },
      { data: contracts },
      { data: tenancyLinks },
    ] = await Promise.all([
      supabase
        .from("inspections")
        .select("id, property_id, kind, photos(count)")
        .eq("user_id", user.id),
      supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("kind", "tenancy_contract"),
      supabase
        .from("tenancy_links")
        .select(`
          id,
          tenant_property_id,
          owner_property_id,
          shared,
          owner_properties (
            id,
            name,
            address,
            city
          )
        `)
        .eq("tenant_id", user.id),
    ]);

    if (inspectionsError) {
      console.error(`[${refId}] [GET /api/properties] Inspections error:`, {
        code: inspectionsError.code,
        message: inspectionsError.message,
        details: inspectionsError.details,
        hint: inspectionsError.hint,
      });
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

    const contractsMap = new Map<string, any>();
    (contracts || []).forEach((c: any) => {
      if (c.property_id) {
        contractsMap.set(c.property_id, c);
      }
    });

    const linksMap = new Map<string, any>();
    (tenancyLinks || []).forEach((link: any) => {
      if (link.tenant_property_id) {
        linksMap.set(link.tenant_property_id, {
          link_id: link.id,
          owner_property_id: link.owner_property_id,
          name: link.owner_properties?.name || "Owner Property",
          shared: link.shared,
        });
      }
    });

    const enrichedProperties: PropertyListItem[] = (properties || []).map((prop) => {
      const counts = inspectionMap.get(prop.id) || { move_in: 0, move_out: 0 };
      const contract = contractsMap.get(prop.id) || null;
      const linkedOwner = linksMap.get(prop.id) || null;
      return {
        ...prop,
        move_in_count: counts.move_in,
        move_out_count: counts.move_out,
        contract,
        documents_missing: !contract,
        linked_owner_property: linkedOwner,
      };
    });

    return apiSuccess(enrichedProperties);
  } catch (err: any) {
    console.error(`[${refId}] [GET /api/properties] Unexpected error:`, {
      message: err?.message,
      name: err?.name,
    });
    return apiError("INTERNAL_ERROR", `An unexpected error occurred. (ref ${refId})`, 500);
  }
}

export async function POST(request: NextRequest) {
  const refId = generateRefId();
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

    // Auto-create missing profile for this user if it doesn't exist
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { error: profErr } = await adminSupabase
        .from("profiles")
        .insert({
          user_id: user.id,
          role: "tenant",
          display_name: input.tenant_name || null,
        });
      if (profErr) {
        console.error(`[${refId}] [POST /api/properties] Auto-create profile notice:`, profErr);
      }
    }

    // Insert property with authenticated user ID
    // Construct insert payload with backward compatibility if columns aren't migrated
    const insertPayload: Record<string, any> = {
      user_id: user.id,
      name: input.name,
      address: input.address || null,
      tenancy_start: input.tenancy_start,
      tenancy_end: input.tenancy_end || null,
      lease_notes: input.lease_notes || null,
    };

    if (input.tenant_name !== undefined) {
      insertPayload.tenant_name = input.tenant_name || null;
    }
    if (input.is_quick_check !== undefined) {
      insertPayload.is_quick_check = input.is_quick_check;
    }

    let { data: property, error: insertError } = await supabase
      .from("properties")
      .insert(insertPayload)
      .select()
      .single();

    // Fallback if tenant_name or is_quick_check column is missing in older DB schema
    if (insertError && (insertError.code === "PGRST204" || insertError.code === "42703")) {
      console.warn(`[${refId}] [POST /api/properties] Retrying insert without extra columns:`, insertError.message);
      delete insertPayload.tenant_name;
      delete insertPayload.is_quick_check;
      const retryRes = await supabase
        .from("properties")
        .insert(insertPayload)
        .select()
        .single();
      property = retryRes.data;
      insertError = retryRes.error;
    }

    if (insertError || !property) {
      console.error(`[${refId}] [POST /api/properties] Insert error:`, {
        code: insertError?.code,
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint,
      });
      return apiError(
        "DB_ERROR",
        `Something went wrong saving the property. Try again. (ref ${refId})`,
        500
      );
    }

    // Pre-create move_in and move_out inspection containers for the property
    const { error: inspError } = await supabase.from("inspections").insert([
      { user_id: user.id, property_id: property.id, kind: "move_in" },
      { user_id: user.id, property_id: property.id, kind: "move_out" },
    ]);

    if (inspError) {
      console.error(`[${refId}] [POST /api/properties] Inspection initialization error:`, {
        code: inspError.code,
        message: inspError.message,
        details: inspError.details,
        hint: inspError.hint,
      });
      // Non-fatal since property was created and inspections can be created on-demand
    }

    return apiSuccess(property, 201);
  } catch (err: any) {
    console.error(`[${refId}] [POST /api/properties] Unexpected error:`, {
      message: err?.message,
      name: err?.name,
    });
    return apiError(
      "INTERNAL_ERROR",
      `Something went wrong saving the property. Try again. (ref ${refId})`,
      500
    );
  }
}
