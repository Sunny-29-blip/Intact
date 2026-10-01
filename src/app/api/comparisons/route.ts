import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createComparisonSchema } from "@/lib/validation";
import { comparePhotosWithGemini } from "@/lib/gemini";
import type {
  ComparisonWithFindings,
  PhotoWithUrl,
  Finding,
} from "@/types/database";

export const maxDuration = 60;

function calculateTenancyMonths(startDateStr: string, endDateStr?: string | null): number {
  try {
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date();
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const months = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
    return months;
  } catch {
    return 12;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return apiError("INVALID_QUERY", "propertyId query parameter is required", 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    // Verify property ownership
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("user_id", user.id)
      .single();

    if (propError || !property) {
      return apiError("NOT_FOUND", "Property not found or unauthorized", 404);
    }

    // Fetch all comparisons for this property
    const { data: comparisons, error: compError } = await supabase
      .from("comparisons")
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (compError) {
      console.error("[GET /api/comparisons] DB error:", compError);
      return apiError("DB_ERROR", "Failed to fetch comparisons", 500);
    }

    if (!comparisons || comparisons.length === 0) {
      return apiSuccess([]);
    }

    const comparisonIds = comparisons.map((c) => c.id);

    // Fetch findings for all comparisons
    const { data: findings, error: findingsError } = await supabase
      .from("findings")
      .select("*")
      .in("comparison_id", comparisonIds)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (findingsError) {
      console.error("[GET /api/comparisons] Findings error:", findingsError);
    }

    // Group findings by comparison_id
    const findingsMap = new Map<string, Finding[]>();
    (findings || []).forEach((f) => {
      const list = findingsMap.get(f.comparison_id) || [];
      list.push(f);
      findingsMap.set(f.comparison_id, list);
    });

    const result: ComparisonWithFindings[] = comparisons.map((c) => ({
      ...c,
      findings: findingsMap.get(c.id) || [],
    }));

    return apiSuccess(result);
  } catch (err) {
    console.error("[GET /api/comparisons] Unexpected error:", err);
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

    const validation = createComparisonSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid comparison request",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const { propertyId, area } = validation.data;

    // 1. Verify property ownership and details
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("user_id", user.id)
      .single();

    if (propError || !property) {
      return apiError("NOT_FOUND", "Property not found or unauthorized", 404);
    }

    // 2. Fetch move-in and move-out inspections
    const { data: inspections, error: inspError } = await supabase
      .from("inspections")
      .select("id, kind")
      .eq("property_id", propertyId)
      .eq("user_id", user.id);

    if (inspError || !inspections) {
      return apiError("DB_ERROR", "Failed to query property inspections", 500);
    }

    const moveInInsp = inspections.find((i) => i.kind === "move_in");
    const moveOutInsp = inspections.find((i) => i.kind === "move_out");

    if (!moveInInsp || !moveOutInsp) {
      return apiError(
        "MISSING_INSPECTION",
        "Property must have both Move-In and Move-Out inspection records configured",
        400
      );
    }

    // Find latest move-in photo for this area
    const { data: moveInPhotos } = await supabase
      .from("photos")
      .select("*")
      .eq("inspection_id", moveInInsp.id)
      .eq("area", area)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    // Find latest move-out photo for this area
    const { data: moveOutPhotos } = await supabase
      .from("photos")
      .select("*")
      .eq("inspection_id", moveOutInsp.id)
      .eq("area", area)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const moveInPhoto = moveInPhotos?.[0];
    const moveOutPhoto = moveOutPhotos?.[0];

    if (!moveInPhoto) {
      return apiError(
        "MISSING_PHOTO",
        `Move-in photo is missing for area: "${area}". Please upload a baseline photo first.`,
        400
      );
    }

    if (!moveOutPhoto) {
      return apiError(
        "MISSING_PHOTO",
        `Move-out photo is missing for area: "${area}". Please upload a departure photo to compare.`,
        400
      );
    }

    // 3. Create or reset the comparison row for that property and area
    const { data: existingComparison } = await supabase
      .from("comparisons")
      .select("id")
      .eq("property_id", propertyId)
      .eq("area", area)
      .eq("user_id", user.id)
      .maybeSingle();

    let comparisonId: string;

    if (existingComparison) {
      comparisonId = existingComparison.id;
      // Delete any older findings for it to prevent duplication
      await supabase
        .from("findings")
        .delete()
        .eq("comparison_id", comparisonId)
        .eq("user_id", user.id);

      // Reset comparison state
      await supabase
        .from("comparisons")
        .update({
          status: "pending",
          error: null,
          move_in_photo_id: moveInPhoto.id,
          move_out_photo_id: moveOutPhoto.id,
        })
        .eq("id", comparisonId)
        .eq("user_id", user.id);
    } else {
      const { data: newComparison, error: compInsertError } = await supabase
        .from("comparisons")
        .insert({
          user_id: user.id,
          property_id: propertyId,
          area,
          move_in_photo_id: moveInPhoto.id,
          move_out_photo_id: moveOutPhoto.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (compInsertError || !newComparison) {
        console.error("[POST /api/comparisons] Failed to initialize comparison:", compInsertError);
        return apiError("DB_ERROR", "Failed to initialize comparison record", 500);
      }
      comparisonId = newComparison.id;
    }

    // 4. Download both images from private bucket on the server
    const { data: moveInBlob, error: d1Err } = await supabase.storage
      .from("inspection-photos")
      .download(moveInPhoto.storage_path);

    const { data: moveOutBlob, error: d2Err } = await supabase.storage
      .from("inspection-photos")
      .download(moveOutPhoto.storage_path);

    if (d1Err || !moveInBlob || d2Err || !moveOutBlob) {
      const errMessage = "Failed to retrieve photo files from secure storage.";
      await supabase
        .from("comparisons")
        .update({ status: "failed", error: errMessage })
        .eq("id", comparisonId)
        .eq("user_id", user.id);
      return apiError("STORAGE_ERROR", errMessage, 500);
    }

    const moveInArrayBuffer = await moveInBlob.arrayBuffer();
    const moveOutArrayBuffer = await moveOutBlob.arrayBuffer();
    const moveInBase64 = Buffer.from(moveInArrayBuffer).toString("base64");
    const moveOutBase64 = Buffer.from(moveOutArrayBuffer).toString("base64");

    const tenancyMonths = calculateTenancyMonths(
      property.tenancy_start,
      property.tenancy_end
    );

    // 5. Send images and prompt to Gemini
    let geminiResponse;
    try {
      geminiResponse = await comparePhotosWithGemini({
        moveInBase64,
        moveOutBase64,
        area,
        propertyName: property.name,
        tenancyMonths,
        tenancyStart: property.tenancy_start,
        tenancyEnd: property.tenancy_end,
        leaseNotes: property.lease_notes,
        timeoutMs: 45000,
      });
    } catch (aiErr) {
      const friendlyMessage =
        aiErr instanceof Error
          ? aiErr.message.includes("timed out")
            ? "Visual comparison timed out. Please try again in a few moments."
            : "The AI comparison service is temporarily unavailable. Please try again."
          : "Visual comparison failed.";

      await supabase
        .from("comparisons")
        .update({
          status: "failed",
          error: friendlyMessage,
        })
        .eq("id", comparisonId)
        .eq("user_id", user.id);

      return apiError("AI_COMPARISON_FAILED", friendlyMessage, 500);
    }

    // 6. Process and clamp findings
    const findingsToInsert = (geminiResponse.findings || []).map((f) => {
      let box_ymin: number | null = null;
      let box_xmin: number | null = null;
      let box_ymax: number | null = null;
      let box_xmax: number | null = null;

      if (f.bounding_box && f.bounding_box.length === 4) {
        const rawYmin = clamp(Math.round(f.bounding_box[0]), 0, 1000);
        const rawXmin = clamp(Math.round(f.bounding_box[1]), 0, 1000);
        const rawYmax = clamp(Math.round(f.bounding_box[2]), 0, 1000);
        const rawXmax = clamp(Math.round(f.bounding_box[3]), 0, 1000);

        if (rawYmin < rawYmax && rawXmin < rawXmax) {
          box_ymin = rawYmin;
          box_xmin = rawXmin;
          box_ymax = rawYmax;
          box_xmax = rawXmax;
        }
      }

      return {
        user_id: user.id,
        comparison_id: comparisonId,
        description: f.description,
        classification: f.classification,
        severity: f.severity,
        confidence: Number(f.confidence.toFixed(2)),
        box_ymin,
        box_xmin,
        box_ymax,
        box_xmax,
        reasoning: f.reasoning || null,
        decision: "pending" as const,
      };
    });

    let insertedFindings: Finding[] = [];
    if (findingsToInsert.length > 0) {
      const { data: inserted, error: insertFindingsErr } = await supabase
        .from("findings")
        .insert(findingsToInsert)
        .select();

      if (insertFindingsErr) {
        console.error("[POST /api/comparisons] Findings insert error:", insertFindingsErr);
      } else if (inserted) {
        insertedFindings = inserted;
      }
    }

    // 7. Mark comparison complete
    const { data: finalComparison, error: compUpdateErr } = await supabase
      .from("comparisons")
      .update({
        status: "complete",
        error: null,
      })
      .eq("id", comparisonId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (compUpdateErr || !finalComparison) {
      return apiError("DB_ERROR", "Failed to finalize comparison", 500);
    }

    // Generate signed URLs for both photos
    const { data: moveInSign } = await supabase.storage
      .from("inspection-photos")
      .createSignedUrl(moveInPhoto.storage_path, 3600);

    const { data: moveOutSign } = await supabase.storage
      .from("inspection-photos")
      .createSignedUrl(moveOutPhoto.storage_path, 3600);

    const moveInPhotoWithUrl: PhotoWithUrl = {
      ...moveInPhoto,
      signed_url: moveInSign?.signedUrl || undefined,
    };

    const moveOutPhotoWithUrl: PhotoWithUrl = {
      ...moveOutPhoto,
      signed_url: moveOutSign?.signedUrl || undefined,
    };

    const responsePayload: ComparisonWithFindings = {
      ...finalComparison,
      findings: insertedFindings,
      move_in_photo: moveInPhotoWithUrl,
      move_out_photo: moveOutPhotoWithUrl,
    };

    return apiSuccess(responsePayload, 200);
  } catch (err) {
    console.error("[POST /api/comparisons] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred during comparison", 500);
  }
}
