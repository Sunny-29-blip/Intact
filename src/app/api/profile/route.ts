import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createProfileSchema, updateProfileSchema } from "@/lib/validation";
import type { Profile } from "@/types/database";

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
        role: "tenant",
        display_name: null,
      };

      const { data: created, error: insertError } = await adminSupabase
        .from("profiles")
        .insert(defaultProfile)
        .select()
        .single();

      if (insertError) {
        console.error("[GET /api/profile] Auto-create Error:", insertError);
        return apiError("INTERNAL_ERROR", "Failed to initialize profile", 500);
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

    // Insert only if row doesn't already exist (role cannot be changed afterwards)
    const { data: existing } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return apiSuccess({
        ...existing,
        email: user.email,
      });
    }

    const { data: inserted, error: insertError } = await adminSupabase
      .from("profiles")
      .insert({
        user_id: user.id,
        role,
        display_name: display_name || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/profile] Insert Error:", insertError);
      return apiError("INTERNAL_ERROR", "Failed to save profile role", 500);
    }

    return apiSuccess({
      ...inserted,
      email: user.email,
    }, 201);
  } catch (err) {
    console.error("[POST /api/profile] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to create profile", 500);
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

    const { display_name } = validation.data;
    const adminSupabase = createAdminClient();

    const { data: updated, error: updateError } = await adminSupabase
      .from("profiles")
      .update({ display_name })
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
