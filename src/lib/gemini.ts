import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  COMPARE_SYSTEM_INSTRUCTION,
  buildComparisonPrompt,
  geminiComparisonResponseSchema,
  type GeminiComparisonResponse,
} from "@/lib/prompts/compare";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface ComparePhotosParams {
  moveInBase64: string;
  moveInMimeType?: string;
  moveOutBase64: string;
  moveOutMimeType?: string;
  area: string;
  propertyName: string;
  tenancyMonths: number;
  tenancyStart: string;
  tenancyEnd?: string | null;
  leaseNotes?: string | null;
  timeoutMs?: number;
}

/**
 * Server-only helper to invoke Gemini multimodal visual comparison on move-in and move-out photos.
 * Implements 45-second timeout, JSON mode, Zod validation, and automated 1x retry on failure.
 */
export async function comparePhotosWithGemini(
  params: ComparePhotosParams
): Promise<GeminiComparisonResponse> {
  const timeoutMs = params.timeoutMs || 45000;
  const promptText = buildComparisonPrompt({
    area: params.area,
    propertyName: params.propertyName,
    tenancyMonths: params.tenancyMonths,
    tenancyStart: params.tenancyStart,
    tenancyEnd: params.tenancyEnd,
    leaseNotes: params.leaseNotes,
  });

  const runCall = async (): Promise<GeminiComparisonResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const responsePromise = ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: params.moveInMimeType || "image/jpeg",
                  data: params.moveInBase64,
                },
              },
              {
                inlineData: {
                  mimeType: params.moveOutMimeType || "image/jpeg",
                  data: params.moveOutBase64,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction: COMPARE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`Gemini visual comparison timed out after ${timeoutMs}ms`));
        });
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);
      const rawText = response.text;

      if (!rawText) {
        throw new Error("Received empty text response from Gemini API");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(
          `Failed to parse Gemini output as JSON: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        );
      }

      const validation = geminiComparisonResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new Error(
          `Gemini response failed schema validation: ${JSON.stringify(
            validation.error.flatten().fieldErrors
          )}`
        );
      }

      return validation.data;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Attempt 1
  try {
    return await runCall();
  } catch (firstError) {
    console.warn(
      "[Gemini] First comparison attempt failed, waiting 1500ms and retrying once...",
      firstError instanceof Error ? firstError.message : firstError
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Attempt 2 (Retry)
    try {
      return await runCall();
    } catch (secondError) {
      console.error(
        "[Gemini] Second comparison attempt failed:",
        secondError instanceof Error ? secondError.message : secondError
      );
      throw new Error(
        `Visual comparison failed: ${
          secondError instanceof Error ? secondError.message : "Service unavailable"
        }`
      );
    }
  }
}
