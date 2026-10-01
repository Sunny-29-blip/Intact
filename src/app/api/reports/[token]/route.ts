import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import type {
  Property,
  PhotoWithUrl,
  ComparisonWithFindings,
  Finding,
} from "@/types/database";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    if (!token) {
      return apiError("INVALID_TOKEN", "Share token is required", 400);
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch property by share_token
    const { data: property, error: propError } = await adminSupabase
      .from("properties")
      .select("*")
      .eq("share_token", token)
      .single();

    if (propError || !property) {
      return apiError("NOT_FOUND", "Inspection report not found or invalid token", 404);
    }

    // 2. Fetch inspections
    const { data: inspections } = await adminSupabase
      .from("inspections")
      .select("*")
      .eq("property_id", property.id);

    const inspectionIds = (inspections || []).map((i) => i.id);

    // 3. Fetch photos & generate signed URLs
    let photosWithUrls: PhotoWithUrl[] = [];
    if (inspectionIds.length > 0) {
      const { data: photos } = await adminSupabase
        .from("photos")
        .select("*")
        .in("inspection_id", inspectionIds)
        .order("created_at", { ascending: true });

      if (photos && photos.length > 0) {
        photosWithUrls = await Promise.all(
          photos.map(async (p) => {
            const { data: signed } = await adminSupabase.storage
              .from("inspection-photos")
              .createSignedUrl(p.storage_path, 7200); // 2 hours
            return {
              ...p,
              signed_url: signed?.signedUrl || undefined,
            };
          })
        );
      }
    }

    // 4. Fetch comparisons & findings
    const { data: comparisons } = await adminSupabase
      .from("comparisons")
      .select("*")
      .eq("property_id", property.id);

    const comparisonIds = (comparisons || []).map((c) => c.id);

    let findings: Finding[] = [];
    if (comparisonIds.length > 0) {
      const { data: findingsData } = await adminSupabase
        .from("findings")
        .select("*")
        .in("comparison_id", comparisonIds)
        .order("created_at", { ascending: true });

      if (findingsData) findings = findingsData;
    }

    // Map findings into comparisons
    const findingsMap = new Map<string, Finding[]>();
    findings.forEach((f) => {
      const list = findingsMap.get(f.comparison_id) || [];
      list.push(f);
      findingsMap.set(f.comparison_id, list);
    });

    // Pair photos per comparison
    const moveInInsp = (inspections || []).find((i) => i.kind === "move_in");
    const moveOutInsp = (inspections || []).find((i) => i.kind === "move_out");

    const moveInPhotos = moveInInsp
      ? photosWithUrls.filter((p) => p.inspection_id === moveInInsp.id)
      : [];
    const moveOutPhotos = moveOutInsp
      ? photosWithUrls.filter((p) => p.inspection_id === moveOutInsp.id)
      : [];

    const comparisonsWithFindings: ComparisonWithFindings[] = (comparisons || []).map((c) => ({
      ...c,
      findings: findingsMap.get(c.id) || [],
      move_in_photo: moveInPhotos.find((p) => p.area === c.area) || null,
      move_out_photo: moveOutPhotos.find((p) => p.area === c.area) || null,
    }));

    return apiSuccess({
      property,
      photos: photosWithUrls,
      comparisons: comparisonsWithFindings,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/reports/[token]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to compile inspection report", 500);
  }
}
