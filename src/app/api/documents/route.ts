import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { registerDocumentSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const validation = registerDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const {
      kind,
      owner_property_id,
      property_id,
      storage_path,
      original_name,
      mime_type,
      size_bytes,
      sha256,
    } = validation.data;

    const admin = createAdminClient();

    // Verify parent ownership and path security
    if (kind === "property_evidence") {
      if (!owner_property_id) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "owner_property_id is required for property evidence" } },
          { status: 400 }
        );
      }

      // Check owner property ownership
      const { data: ownerProp, error: propErr } = await supabase
        .from("owner_properties")
        .select("id, owner_id")
        .eq("id", owner_property_id)
        .eq("owner_id", user.id)
        .single();

      if (propErr || !ownerProp) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Owner property not found or unauthorized" } },
          { status: 404 }
        );
      }

      // Verify path format {user_id}/property_evidence/{owner_property_id}/...
      const expectedPrefix = `${user.id}/property_evidence/${owner_property_id}/`;
      if (!storage_path.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid storage path structure" } },
          { status: 400 }
        );
      }

      // Check max 5 documents limit for owner property
      const { count, error: countErr } = await admin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("owner_property_id", owner_property_id);

      if (!countErr && count !== null && count >= 5) {
        return NextResponse.json(
          { error: { code: "LIMIT_EXCEEDED", message: "Maximum of 5 documents allowed per property" } },
          { status: 400 }
        );
      }
    } else if (kind === "tenancy_contract") {
      if (!property_id) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "property_id is required for tenancy contract" } },
          { status: 400 }
        );
      }

      // Check tenant property ownership
      const { data: tenantProp, error: propErr } = await supabase
        .from("properties")
        .select("id, user_id")
        .eq("id", property_id)
        .eq("user_id", user.id)
        .single();

      if (propErr || !tenantProp) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Tenant property not found or unauthorized" } },
          { status: 404 }
        );
      }

      // Verify path format {user_id}/tenancy_contract/{property_id}/...
      const expectedPrefix = `${user.id}/tenancy_contract/${property_id}/`;
      if (!storage_path.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid storage path structure" } },
          { status: 400 }
        );
      }

      // Exactly one active contract per tenant property: replace old contract if exists
      const { data: oldDocs } = await admin
        .from("documents")
        .select("id, storage_path")
        .eq("property_id", property_id)
        .eq("kind", "tenancy_contract");

      if (oldDocs && oldDocs.length > 0) {
        const oldPaths = oldDocs.map((d) => d.storage_path);
        await admin.storage.from("documents").remove(oldPaths).catch(() => {});
        const oldIds = oldDocs.map((d) => d.id);
        await admin.from("documents").delete().in("id", oldIds);
      }
    }

    // Insert new document record
    const { data: newDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        kind,
        owner_property_id: kind === "property_evidence" ? owner_property_id : null,
        property_id: kind === "tenancy_contract" ? property_id : null,
        storage_path,
        original_name,
        mime_type,
        size_bytes,
        sha256: sha256 || null,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to save document record" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: newDoc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/documents error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
      { status: 500 }
    );
  }
}
