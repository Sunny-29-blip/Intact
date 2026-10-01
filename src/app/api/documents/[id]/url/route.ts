import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
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
    // 5 minutes = 300 seconds
    const { data: signedData, error: signError } = await admin.storage
      .from("documents")
      .createSignedUrl(document.storage_path, 300);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: { code: "STORAGE_ERROR", message: "Failed to generate signed document URL" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        signedUrl: signedData.signedUrl,
      },
    });
  } catch (err) {
    console.error("GET /api/documents/[id]/url error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
      { status: 500 }
    );
  }
}
