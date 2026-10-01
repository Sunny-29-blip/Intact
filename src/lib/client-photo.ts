import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { PhotoWithUrl } from "@/types/database";

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  sha256: string;
}

/**
 * Resizes an image file to max 1600px on the long side via HTML5 Canvas
 * and encodes to JPEG quality 0.8. Computes SHA-256 using Web Crypto API.
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  // Client validation
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files (JPEG, PNG, WebP, HEIC) are accepted");
  }

  const MAX_ORIGINAL_SIZE_MB = 10;
  if (file.size > MAX_ORIGINAL_SIZE_MB * 1024 * 1024) {
    throw new Error(`File exceeds maximum size of ${MAX_ORIGINAL_SIZE_MB}MB`);
  }

  return new Promise<ProcessedImage>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const MAX_DIM = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Unable to initialize image processing canvas");
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress and encode image"));
              return;
            }

            try {
              // Compute SHA-256 with Web Crypto API
              const arrayBuffer = await blob.arrayBuffer();
              const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const sha256 = hashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

              resolve({
                blob,
                width,
                height,
                sha256,
              });
            } catch (cryptoErr) {
              reject(cryptoErr);
            }
          },
          "image/jpeg",
          0.8
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for processing"));
    };

    img.src = objectUrl;
  });
}

export interface UploadPhotoParams {
  userId: string;
  propertyId: string;
  inspectionId: string;
  inspectionKind: "move_in" | "move_out";
  area: string;
  file: File;
  onProgress?: (status: string) => void;
}

/**
 * High-level helper:
 * 1. Resizes & digests photo in browser
 * 2. Uploads directly to Supabase storage bucket
 * 3. Registers metadata with POST /api/photos
 */
export async function uploadAndRegisterPhoto({
  userId,
  propertyId,
  inspectionId,
  inspectionKind,
  area,
  file,
  onProgress,
}: UploadPhotoParams): Promise<PhotoWithUrl> {
  onProgress?.("Optimizing image and computing cryptographic hash...");
  const processed = await processImageForUpload(file);

  const photoUuid = crypto.randomUUID();
  const storagePath = `${userId}/${propertyId}/${inspectionKind}/${photoUuid}.jpg`;

  onProgress?.("Uploading photo to secure storage...");
  const { error: uploadError } = await supabase.storage
    .from("inspection-photos")
    .upload(storagePath, processed.blob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  onProgress?.("Registering inspection record...");
  const registeredPhoto = await api.registerPhoto({
    inspection_id: inspectionId,
    area,
    storage_path: storagePath,
    sha256: processed.sha256,
    width: processed.width,
    height: processed.height,
  });

  return registeredPhoto;
}
