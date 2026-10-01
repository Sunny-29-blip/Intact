import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { updateOwnerPropertySchema } from "@/lib/validation";
import type { OwnerLinkedTenant, OwnerPropertyDetail } from "@/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("UNAUTHORIZED", "You must be logged in to view property details", 401);
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch property and verify owner ownership
    const { data: property, error: propError } = await adminSupabase
      .from("owner_properties")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (propError || !property) {
      return apiError("NOT_FOUND", "Owner property not found", 404);
    }

    // 2. Fetch linked tenancy links
    const { data: links, error: linksError } = await adminSupabase
      .from("tenancy_links")
      .select("*")
      .eq("owner_property_id", id)
      .order("created_at", { ascending: false });

    if (linksError) {
      console.error("[GET /api/owner/properties/[id]] Links Error:", linksError);
    }

    const tenantIds = (links || []).map((l) => l.tenant_id);
    const tenantPropertyIds = (links || []).map((l) => l.tenant_property_id);

    // Fetch tenant profiles
    let profilesMap: Record<string, string> = {};
    if (tenantIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", tenantIds);

      (profiles || []).forEach((p) => {
        if (p.display_name) {
          profilesMap[p.user_id] = p.display_name;
        }
      });
    }

    // Fetch tenant property share tokens (only accessible if shared = true)
    let tenantPropsMap: Record<string, { share_token: string; name: string }> = {};
    if (tenantPropertyIds.length > 0) {
      const { data: tenantProps } = await adminSupabase
        .from("properties")
        .select("id, share_token, name")
        .in("id", tenantPropertyIds);

      (tenantProps || []).forEach((tp) => {
        tenantPropsMap[tp.id] = { share_token: tp.share_token, name: tp.name };
      });
    }

    // 3. Fetch attached property evidence documents
    const { data: documents, error: docsError } = await adminSupabase
      .from("documents")
      .select("*")
      .eq("owner_property_id", id)
      .eq("kind", "property_evidence")
      .order("created_at", { ascending: false });

    if (docsError) {
      console.error("[GET /api/owner/properties/[id]] Documents Error:", docsError);
    }

    const docList = documents || [];

    const linkedTenants = (links || []).map((link) => {
      const tp = tenantPropsMap[link.tenant_property_id];
      return {
        link_id: link.id,
        tenant_id: link.tenant_id,
        tenant_property_id: link.tenant_property_id,
        display_name: profilesMap[link.tenant_id] || "Tenant",
        property_name: tp?.name || "Rental Property",
        shared: link.shared,
        report_token: link.shared ? tp?.share_token || null : null,
        linked_at: link.created_at,
      };
    });

    const result: OwnerPropertyDetail = {
      ...property,
      linked_tenants_count: linkedTenants.length,
      linked_tenants: linkedTenants,
      documents: docList,
      documents_count: docList.length,
      documents_missing: docList.length === 0,
    };

    return apiSuccess(result);
  } catch (err) {
    console.error("[GET /api/owner/properties/[id]] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to load owner property detail", 500);
  }
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
      return apiError("UNAUTHORIZED", "You must be logged in to update this property", 401);
    }

    const json = await request.json().catch(() => ({}));
    const validation = updateOwnerPropertySchema.safeParse(json);

    if (!validation.success) {
      return apiError("VALIDATION_ERROR", "Invalid update payload", 400, validation.error.flatten().fieldErrors);
    }

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: existing, error: findError } = await adminSupabase
      .from("owner_properties")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (findError || !existing) {
      return apiError("NOT_FOUND", "Owner property not found", 404);
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("owner_properties")
      .update(validation.data)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/owner/properties/[id]] DB Error:", updateError);
      return apiError("INTERNAL_ERROR", "Failed to update owner property", 500);
    }

    return apiSuccess(updated);
  } catch (err) {
    console.error("[PATCH /api/owner/properties/[id]] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to update property", 500);
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
      return apiError("UNAUTHORIZED", "You must be logged in to delete this property", 401);
    }

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: existing, error: findError } = await adminSupabase
      .from("owner_properties")
      .select("id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (findError || !existing) {
      return apiError("NOT_FOUND", "Owner property not found", 404);
    }

    // Fetch and remove all documents from storage
    const { data: docs } = await adminSupabase
      .from("documents")
      .select("storage_path")
      .eq("owner_property_id", id);

    if (docs && docs.length > 0) {
      await adminSupabase.storage
        .from("documents")
        .remove(docs.map((d) => d.storage_path))
        .catch(() => {});
    }

    const { error: deleteError } = await adminSupabase
      .from("owner_properties")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[DELETE /api/owner/properties/[id]] DB Error:", deleteError);
      return apiError("INTERNAL_ERROR", "Failed to delete owner property", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/owner/properties/[id]] Unexpected:", err);
    return apiError("INTERNAL_ERROR", "Failed to delete property", 500);
  }
}
