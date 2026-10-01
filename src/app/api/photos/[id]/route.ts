import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError("INVALID_ID", "Photo ID is required", 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    // Verify ownership
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (photoError || !photo) {
      return apiError("NOT_FOUND", "Photo not found or unauthorized", 404);
    }

    // Remove from storage bucket
    const { error: removeError } = await supabase.storage
      .from("inspection-photos")
      .remove([photo.storage_path]);

    if (removeError) {
      console.error("[DELETE /api/photos/[id]] Storage removal error:", removeError);
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from("photos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[DELETE /api/photos/[id]] DB delete error:", deleteError);
      return apiError("DB_ERROR", "Failed to delete photo", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/photos/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
