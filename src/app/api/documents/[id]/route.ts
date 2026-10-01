import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found or unauthorized" } },
        { status: 404 }
      );
    }

    const admin = createAdminClient();

    // Remove from storage
    await admin.storage.from("documents").remove([document.storage_path]).catch(() => {});

    // Delete row
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to delete document record" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("DELETE /api/documents/[id] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
      { status: 500 }
    );
  }
}
