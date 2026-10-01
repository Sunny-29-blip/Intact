import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateFindingDecisionSchema } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return apiError("INVALID_ID", "Finding ID is required", 400);
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

    const validation = updateFindingDecisionSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid finding decision input",
        400,
        validation.error.flatten().fieldErrors
      );
    }

    const { decision, note } = validation.data;

    // Verify ownership
    const { data: existing, error: findError } = await supabase
      .from("findings")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (findError || !existing) {
      return apiError("NOT_FOUND", "Finding not found or unauthorized", 404);
    }

    // Update decision
    const { data: updated, error: updateError } = await supabase
      .from("findings")
      .update({
        decision,
        decision_note: note || null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error("[PATCH /api/findings/[id]] Update error:", updateError);
      return apiError("DB_ERROR", "Failed to update finding decision", 500);
    }

    return apiSuccess(updated);
  } catch (err) {
    console.error("[PATCH /api/findings/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
