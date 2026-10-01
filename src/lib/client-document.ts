import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { Document, DocumentKind } from "@/types/database";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadDocumentParams {
  userId: string;
  kind: DocumentKind;
  parentId: string; // owner_property_id or property_id
  file: File;
  onProgress?: (status: string) => void;
}

/**
 * Validates document type & size, computes SHA-256 via Web Crypto,
 * uploads directly to Supabase private 'documents' bucket,
 * and registers metadata via POST /api/documents.
 */
export async function uploadAndRegisterDocument({
  userId,
  kind,
  parentId,
  file,
  onProgress,
}: UploadDocumentParams): Promise<Document> {
  // 1. Client-side validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      `File type "${file.type || "unknown"}" is not supported. Please upload a PDF, JPEG, PNG, or WebP document.`
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Document exceeds the 10 MB maximum size limit.");
  }

  if (file.size === 0) {
    throw new Error("File is empty.");
  }

  onProgress?.(`Computing cryptographic checksum for ${file.name}...`);

  // 2. Compute SHA-256
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // 3. Determine extension
  let ext = "pdf";
  if (file.type === "image/jpeg") ext = "jpg";
  else if (file.type === "image/png") ext = "png";
  else if (file.type === "image/webp") ext = "webp";
  else if (file.type === "application/pdf") ext = "pdf";
  else {
    const parts = file.name.split(".");
    if (parts.length > 1) {
      ext = parts.pop()?.toLowerCase() || "bin";
    }
  }

  const docUuid = crypto.randomUUID();
  // Path format: {user_id}/{kind}/{parent_id}/{uuid}.{ext}
  const storagePath = `${userId}/${kind}/${parentId}/${docUuid}.${ext}`;

  onProgress?.(`Uploading ${file.name} to secure private storage...`);

  // 4. Upload to Supabase Storage bucket 'documents'
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  onProgress?.(`Registering ${file.name} document record...`);

  // 5. Register with backend API
  const registeredDoc = await api.registerDocument({
    kind,
    owner_property_id: kind === "property_evidence" ? parentId : null,
    property_id: kind === "tenancy_contract" ? parentId : null,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
    size_bytes: file.size,
    sha256,
  });

  return registeredDoc;
}
