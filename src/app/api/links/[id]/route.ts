import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { updateLinkShareSchema } from "@/lib/validation";
import type { TenantLinkedOwnerProperty } from "@/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to update sharing settings", 401);
    }

    const json = await request.json().catch(() => ({}));
    const validation = updateLinkShareSchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid sharing payload", 400, validation.error.flatten().fieldErrors);
    }

    const { shared } = validation.data;
    const adminSupabase = createAdminClient();

    // Verify tenancy link ownership
    const { data: link, error: linkError } = await adminSupabase
      .from("tenancy_links")
      .select(`
        id,
        owner_property_id,
        tenant_property_id,
        shared,
        created_at,
        owner_properties (
          id,
          name,
          address,
          city
        )
      `)
      .eq("id", id)
      .eq("tenant_id", user.id)
      .maybeSingle();

    if (linkError || !link) {
      return apiError("NOT_FOUND", "Tenancy link not found", 404);
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("tenancy_links")
      .update({ shared })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/links/[id]] DB Error:", updateError);
      return apiError("INTERNAL_ERROR", "Failed to update sharing preference", 500);
    }

    const ownerProp: any = link.owner_properties;
    const result: TenantLinkedOwnerProperty = {
      link_id: updated.id,
      owner_property_id: updated.owner_property_id,
      tenant_property_id: updated.tenant_property_id,
      name: ownerProp?.name || "Owner Property",
      address: ownerProp?.address || null,
      city: ownerProp?.city || null,
      shared: updated.shared,
      linked_at: updated.created_at,
    };

    return apiSuccess(result);
  } catch (err) {
    console.error("[PATCH /api/links/[id]] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to update link", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to unlink", 401);
    }

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: existing, error: findError } = await adminSupabase
      .from("tenancy_links")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", user.id)
      .maybeSingle();

    if (findError || !existing) {
      return apiError("NOT_FOUND", "Tenancy link not found", 404);
    }

    const { error: deleteError } = await adminSupabase
      .from("tenancy_links")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[DELETE /api/links/[id]] DB Error:", deleteError);
      return apiError("INTERNAL_ERROR", "Failed to remove tenancy link", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/links/[id]] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to unlink property", 500);
  }
}
