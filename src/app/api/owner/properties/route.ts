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

    // Fetch linked tenants and evidence document counts
    let docCounts: Record<string, number> = {};
    let tenantsByProperty: Record<string, any[]> = {};

    if (propertyIds.length > 0) {
      const [
        { data: links },
        { data: docs },
      ] = await Promise.all([
        adminSupabase
          .from("tenancy_links")
          .select("id, owner_property_id, tenant_id, tenant_property_id, shared, created_at")
          .in("owner_property_id", propertyIds),
        adminSupabase
          .from("documents")
          .select("owner_property_id")
          .eq("kind", "property_evidence")
          .in("owner_property_id", propertyIds),
      ]);

      (docs || []).forEach((doc) => {
        if (doc.owner_property_id) {
          docCounts[doc.owner_property_id] = (docCounts[doc.owner_property_id] || 0) + 1;
        }
      });

      const tenantIds = Array.from(new Set((links || []).map((l) => l.tenant_id)));
      const tenantPropIds = Array.from(new Set((links || []).map((l) => l.tenant_property_id)));

      let profilesMap: Record<string, string> = {};
      let tenantPropsMap: Record<string, any> = {};
      let comparisonsMap: Record<string, { areas: number; findings: number; hasPhotos: boolean }> = {};

      if (tenantIds.length > 0) {
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", tenantIds);

        (profiles || []).forEach((p) => {
          if (p.display_name) profilesMap[p.user_id] = p.display_name;
        });
      }

      if (tenantPropIds.length > 0) {
        const [
          { data: tenantProps },
          { data: comps },
          { data: photos },
          { data: findings },
        ] = await Promise.all([
          adminSupabase
            .from("properties")
            .select("id, name, tenant_name, tenancy_start, tenancy_end")
            .in("id", tenantPropIds),
          adminSupabase
            .from("comparisons")
            .select("id, property_id, area")
            .in("property_id", tenantPropIds),
          adminSupabase
            .from("photos")
            .select("id, property_id:inspections(property_id)")
            .in("inspections.property_id", tenantPropIds),
          adminSupabase
            .from("findings")
            .select("id, comparison_id, comparisons(property_id)")
            .limit(500),
        ]);

        (tenantProps || []).forEach((tp) => {
          tenantPropsMap[tp.id] = tp;
        });

        // Compute summary counts per tenant property
        (tenantPropIds || []).forEach((propId) => {
          const propComps = (comps || []).filter((c) => c.property_id === propId);
          const distinctAreas = new Set(propComps.map((c) => c.area)).size;
          const propFindings = (findings || []).filter(
            (f: any) => f.comparisons && f.comparisons.property_id === propId
          );
          comparisonsMap[propId] = {
            areas: distinctAreas,
            findings: propFindings.length,
            hasPhotos: (photos || []).length > 0,
          };
        });
      }

      (links || []).forEach((link) => {
        const tp = tenantPropsMap[link.tenant_property_id] || {};
        const stats = comparisonsMap[link.tenant_property_id] || { areas: 0, findings: 0, hasPhotos: false };
        const displayName = tp.tenant_name || profilesMap[link.tenant_id] || "Tenant";

        let reportStatus = "Not shared";
        if (!stats.hasPhotos && stats.areas === 0) {
          reportStatus = "Not started";
        } else if (link.shared) {
          const areaWord = stats.areas === 1 ? "area" : "areas";
          const findingWord = stats.findings === 1 ? "finding" : "findings";
          reportStatus = `Shared: ${stats.areas} ${areaWord}, ${stats.findings} ${findingWord}`;
        }

        // Strictly whitelisted fields only
        const whitelistedTenant = {
          link_id: link.id,
          tenant_name: displayName,
          tenancy_start: tp.tenancy_start || "—",
          tenancy_end: tp.tenancy_end || null,
          shared: link.shared,
          report_status: reportStatus,
          areas_count: stats.areas,
          findings_count: stats.findings,
        };

        if (!tenantsByProperty[link.owner_property_id]) {
          tenantsByProperty[link.owner_property_id] = [];
        }
        tenantsByProperty[link.owner_property_id].push(whitelistedTenant);
      });

      // Sort tenants by soonest contract end
      Object.keys(tenantsByProperty).forEach((key) => {
        tenantsByProperty[key].sort((a, b) => {
          if (!a.tenancy_end) return 1;
          if (!b.tenancy_end) return -1;
          return a.tenancy_end.localeCompare(b.tenancy_end);
        });
      });
    }

    const propertiesWithCount: any[] = (properties || []).map((p) => {
      const count = docCounts[p.id] || 0;
      const linkedTenants = tenantsByProperty[p.id] || [];
      return {
        ...p,
        linked_tenants_count: linkedTenants.length,
        linked_tenants: linkedTenants,
        documents_count: count,
        documents_missing: count === 0,
      };
    });

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

    const { name, address, owner_name, city } = validation.data;

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
          owner_name: owner_name || null,
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
      documents_count: 0,
      documents_missing: true,
    }, 201);
  } catch (err) {
    console.error("[POST /api/owner/properties] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to register property", 500);
  }
}
