import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updatePropertySchema } from "@/lib/validation";
import type {
  PropertyDetail,
  InspectionWithPhotos,
  PhotoWithUrl,
  Inspection,
  Photo,
} from "@/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
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

    // Fetch property with explicit ownership check
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (propertyError || !property) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    // Fetch or ensure both inspections exist
    let { data: inspections, error: inspectionsError } = await supabase
      .from("inspections")
      .select("*")
      .eq("property_id", id)
      .eq("user_id", user.id);

    if (inspectionsError) {
      console.error("[GET /api/properties/[id]] Inspections error:", inspectionsError);
      return apiError("DB_ERROR", "Failed to fetch inspections", 500);
    }

    const moveInExisting = inspections?.find((i) => i.kind === "move_in");
    const moveOutExisting = inspections?.find((i) => i.kind === "move_out");

    // Auto-create missing inspections if needed
    if (!moveInExisting) {
      const { data: newMoveIn } = await supabase
        .from("inspections")
        .insert({ user_id: user.id, property_id: id, kind: "move_in" })
        .select()
        .single();
      if (newMoveIn) inspections = [...(inspections || []), newMoveIn];
    }
    if (!moveOutExisting) {
      const { data: newMoveOut } = await supabase
        .from("inspections")
        .insert({ user_id: user.id, property_id: id, kind: "move_out" })
        .select()
        .single();
      if (newMoveOut) inspections = [...(inspections || []), newMoveOut];
    }

    const inspectionIds = (inspections || []).map((i) => i.id);

    // Fetch photos for these inspections
    let photos: Photo[] = [];
    if (inspectionIds.length > 0) {
      const { data: photoData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .in("inspection_id", inspectionIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (photosError) {
        console.error("[GET /api/properties/[id]] Photos error:", photosError);
      } else if (photoData) {
        photos = photoData;
      }
    }

    // Generate short-lived signed URLs for each photo from private bucket
    const photosWithUrls: PhotoWithUrl[] = await Promise.all(
      photos.map(async (photo) => {
        const { data: signedData, error: signError } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(photo.storage_path, 3600); // 1 hour

        if (signError) {
          console.error(`[GET /api/properties/[id]] Error signing URL for ${photo.storage_path}:`, signError);
        }

        return {
          ...photo,
          signed_url: signedData?.signedUrl || undefined,
        };
      })
    );

    // Group photos by inspection kind
    const moveInInsp = (inspections || []).find((i) => i.kind === "move_in");
    const moveOutInsp = (inspections || []).find((i) => i.kind === "move_out");

    const moveInPhotos = moveInInsp
      ? photosWithUrls.filter((p) => p.inspection_id === moveInInsp.id)
      : [];
    const moveOutPhotos = moveOutInsp
      ? photosWithUrls.filter((p) => p.inspection_id === moveOutInsp.id)
      : [];

    const moveInPayload: InspectionWithPhotos | null = moveInInsp
      ? {
          ...moveInInsp,
          photos: moveInPhotos,
        }
      : null;

    const moveOutPayload: InspectionWithPhotos | null = moveOutInsp
      ? {
          ...moveOutInsp,
          photos: moveOutPhotos,
        }
      : null;

    const detail: PropertyDetail = {
      ...property,
      inspections: {
        move_in: moveInPayload,
        move_out: moveOutPayload,
      },
      move_in_count: moveInPhotos.length,
      move_out_count: moveOutPhotos.length,
    };

    return apiSuccess(detail);
  } catch (err) {
    console.error("[GET /api/properties/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
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

    const validation = updatePropertySchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid property update input",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const input = validation.data;

    // Verify ownership
    const { data: existing, error: findError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (findError || !existing) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    // Update fields
    const { data: updated, error: updateError } = await supabase
      .from("properties")
      .update(input)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/properties/[id]] Update error:", updateError);
      return apiError("DB_ERROR", "Failed to update property", 500);
    }

    return apiSuccess(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
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

    // Verify ownership and fetch all photo storage paths
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (propertyError || !property) {
      return apiError("NOT_FOUND", "Property not found", 404);
    }

    // Fetch all photos under this property to remove from storage bucket
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id")
      .eq("property_id", id)
      .eq("user_id", user.id);

    const inspectionIds = (inspections || []).map((i) => i.id);
    if (inspectionIds.length > 0) {
      const { data: photos } = await supabase
        .from("photos")
        .select("storage_path")
        .in("inspection_id", inspectionIds)
        .eq("user_id", user.id);

      const storagePaths = (photos || []).map((p) => p.storage_path);

      if (storagePaths.length > 0) {
        const { error: removeError } = await supabase.storage
          .from("inspection-photos")
          .remove(storagePaths);

        if (removeError) {
          console.error("[DELETE /api/properties/[id]] Storage deletion error:", removeError);
        }
      }
    }

    // Delete property record from DB (cascades to inspections, photos, comparisons, findings)
    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[DELETE /api/properties/[id]] DB delete error:", deleteError);
      return apiError("DB_ERROR", "Failed to delete property", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
