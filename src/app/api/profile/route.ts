import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createProfileSchema, updateProfileSchema } from "@/lib/validation";
import type { Profile, UserRole } from "@/types/database";

function newRefId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function logStage(refId: string, route: string, stage: string, err: { code?: string; message?: string } | null) {
  console.error(`[profile ${refId}] ${route} stage=${stage} code=${err?.code ?? "-"} message=${err?.message ?? "-"}`);
}

/** Role chosen at signup (stored in user metadata), used only when no profile row exists yet. */
function signupRole(user: { user_metadata?: Record<string, unknown> }): UserRole {
  return user.user_metadata?.role === "owner" ? "owner" : "tenant";
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to access your profile", 401);
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch user profile
    const { data: profile, error: fetchError } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[GET /api/profile] DB Error:", fetchError);
      return apiError("INTERNAL_ERROR", "Failed to retrieve user profile", 500);
    }

    // If profile row doesn't exist yet, create default tenant profile
    if (!profile) {
      const defaultProfile: Omit<Profile, "created_at"> = {
        user_id: user.id,
        role: signupRole(user),
        display_name: null,
      };

      // ignoreDuplicates: if a concurrent request created the row first, keep it as is.
      const { error: insertError } = await adminSupabase
        .from("profiles")
        .upsert(defaultProfile, { onConflict: "user_id", ignoreDuplicates: true });

      const { data: created, error: readError } = insertError
        ? { data: null, error: insertError }
        : await adminSupabase.from("profiles").select("*").eq("user_id", user.id).single();

      if (insertError || readError || !created) {
        const refId = newRefId();
        logStage(refId, "GET", insertError ? "insert" : "read", insertError || readError);
        return apiError("INTERNAL_ERROR", "Failed to initialize profile", 500, undefined, refId);
      }

      return apiSuccess({
        ...created,
        email: user.email,
      });
    }

    return apiSuccess({
      ...profile,
      email: user.email,
    });
  } catch (err) {
    console.error("[GET /api/profile] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to load profile", 500);
  }
}

export async function POST(request: NextRequest) {
  const refId = newRefId();
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to initialize a profile", 401);
    }

    const json = await request.json().catch(() => ({}));
    const validation = createProfileSchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid profile parameters", 400, validation.error.flatten().fieldErrors);
    }

    const { role, display_name } = validation.data;
    const adminSupabase = createAdminClient();

    // user_id always comes from the session. ignoreDuplicates keeps an existing row
    // (and its role) unchanged; role cannot be changed after the profile exists.
    const { error: upsertError } = await adminSupabase
      .from("profiles")
      .upsert(
        { user_id: user.id, role, display_name: display_name || null },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (upsertError) {
      logStage(refId, "POST", "upsert", upsertError);
      return apiError("INTERNAL_ERROR", "Failed to save profile role", 500, undefined, refId);
    }

    const { data: saved, error: readError } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (readError || !saved) {
      logStage(refId, "POST", "read", readError);
      return apiError("INTERNAL_ERROR", "Failed to save profile role", 500, undefined, refId);
    }

    return apiSuccess({
      ...saved,
      email: user.email,
    }, 201);
  } catch (err) {
    logStage(refId, "POST", "unexpected", { message: err instanceof Error ? err.message : String(err) });
    return apiError("INTERNAL_ERROR", "Failed to create profile", 500, undefined, refId);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to update your profile", 401);
    }

    const json = await request.json().catch(() => ({}));
    const validation = updateProfileSchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid profile input", 400, validation.error.flatten().fieldErrors);
    }

    // Only send fields the client provided; empty strings are stored as null.
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(validation.data)) {
      if (value !== undefined) updates[key] = value === "" ? null : value;
    }
    if (Object.keys(updates).length === 0) {
      return apiError("VALIDATION_ERROR", "Nothing to update", 400);
    }
    const adminSupabase = createAdminClient();

    const { data: updated, error: updateError } = await adminSupabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/profile] DB Error:", updateError);
      return apiError("INTERNAL_ERROR", "Failed to update profile", 500);
    }

    return apiSuccess({
      ...updated,
      email: user.email,
    });
  } catch (err) {
    console.error("[PATCH /api/profile] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to update profile", 500);
  }
}
