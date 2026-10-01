import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ linkId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { linkId } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const adminSupabase = createAdminClient();

    // 1. Verify owner role
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "owner") {
      return apiError("FORBIDDEN", "Only property owners can access owner condition reports", 403);
    }

    // 2. Fetch tenancy link, owner property, and strictly verify owner ownership AND shared === true
    const { data: link, error: linkError } = await adminSupabase
      .from("tenancy_links")
      .select(`
        id,
        owner_property_id,
        tenant_id,
        tenant_property_id,
        shared,
        created_at,
        owner_properties (
          id,
          owner_id,
          name,
          address,
          city
        )
      `)
      .eq("id", linkId)
      .maybeSingle();

    if (linkError || !link) {
      return apiError("NOT_FOUND", "Condition report not found", 404);
    }

    const ownerProp: any = link.owner_properties;
    if (!ownerProp || ownerProp.owner_id !== user.id || !link.shared) {
      // 404 if not owned by this owner OR if tenant turned sharing off
      return apiError("NOT_FOUND", "Condition report not found or sharing has been disabled by tenant", 404);
    }

    // 3. Load tenant property details (safe fields)
    const { data: tenantProperty } = await adminSupabase
      .from("properties")
      .select("id, name, address, tenant_name, tenancy_start, tenancy_end")
      .eq("id", link.tenant_property_id)
      .single();

    if (!tenantProperty) {
      return apiError("NOT_FOUND", "Associated property record not found", 404);
    }

    // 4. Fetch comparisons for tenant property
    const { data: comparisons } = await adminSupabase
      .from("comparisons")
      .select("*")
      .eq("property_id", tenantProperty.id)
      .order("created_at", { ascending: true });

    const compIds = (comparisons || []).map((c) => c.id);

    // 5. Fetch findings
    let findings: any[] = [];
    if (compIds.length > 0) {
      const { data: foundFindings } = await adminSupabase
        .from("findings")
        .select("*")
        .in("comparison_id", compIds)
        .order("created_at", { ascending: true });
      findings = foundFindings || [];
    }

    // 6. Fetch inspections & photos
    const { data: inspections } = await adminSupabase
      .from("inspections")
      .select("id, kind")
      .eq("property_id", tenantProperty.id);

    const inspIds = (inspections || []).map((i) => i.id);

    let photos: any[] = [];
    if (inspIds.length > 0) {
      const { data: foundPhotos } = await adminSupabase
        .from("photos")
        .select("*")
        .in("inspection_id", inspIds);
      photos = foundPhotos || [];
    }

    // 7. Generate 10-minute signed URLs (600 seconds) for photos
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => {
        let signedUrl = "";
        try {
          const { data: signedData } = await adminSupabase.storage
            .from("photos")
            .createSignedUrl(p.storage_path, 600);
          signedUrl = signedData?.signedUrl || "";
        } catch (e) {
          console.error("Failed to sign photo URL for owner view:", e);
        }
        return {
          ...p,
          signed_url: signedUrl,
        };
      })
    );

    // Group findings by comparison
    const findingsByComparison: Record<string, any[]> = {};
    findings.forEach((f) => {
      if (!findingsByComparison[f.comparison_id]) {
        findingsByComparison[f.comparison_id] = [];
      }
      // Human-readable confidence
      let confidenceWord = "Low";
      if (f.confidence >= 0.8) confidenceWord = "High";
      else if (f.confidence >= 0.5) confidenceWord = "Medium";

      // Human-readable decision
      let decisionWord = "Not reviewed";
      if (f.decision === "accepted") decisionWord = "Accepted";
      else if (f.decision === "disputed") decisionWord = "Rejected";

      findingsByComparison[f.comparison_id].push({
        ...f,
        confidence_word: confidenceWord,
        decision_word: decisionWord,
      });
    });

    const reportData = {
      link_id: link.id,
      shared_at: link.created_at,
      owner_property: {
        id: ownerProp.id,
        name: ownerProp.name,
        address: ownerProp.address,
        city: ownerProp.city,
      },
      tenant_property: {
        id: tenantProperty.id,
        name: tenantProperty.name,
        address: tenantProperty.address,
        tenant_name: tenantProperty.tenant_name || "Tenant",
        tenancy_start: tenantProperty.tenancy_start,
        tenancy_end: tenantProperty.tenancy_end,
      },
      comparisons: (comparisons || []).map((c) => ({
        id: c.id,
        area: c.area,
        status: c.status,
        created_at: c.created_at,
        findings: findingsByComparison[c.id] || [],
        move_in_photo: photosWithUrls.find((p) => p.id === c.move_in_photo_id) || null,
        move_out_photo: photosWithUrls.find((p) => p.id === c.move_out_photo_id) || null,
      })),
      photos: photosWithUrls,
    };

    const response = apiSuccess(reportData);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (err) {
    console.error("[GET /api/owner/reports/[linkId]] Error:", err);
    return apiError("INTERNAL_ERROR", "Failed to retrieve shared report", 500);
  }
}
