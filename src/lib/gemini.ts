import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface GenerateStructuredJsonOptions<T extends z.ZodTypeAny> {
  prompt: string;
  schema: T;
  systemInstruction?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Server-only helper to generate structured, JSON-validated output from Gemini.
 * Uses the model specified in GEMINI_MODEL (defaults to gemini-2.5-flash).
 * Includes timeout protection, JSON parsing, and Zod schema validation.
 */
export async function generateStructuredJson<T extends z.ZodTypeAny>({
  prompt,
  schema,
  systemInstruction,
  model = env.GEMINI_MODEL,
  timeoutMs = 15000,
}: GenerateStructuredJsonOptions<T>): Promise<z.infer<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const responsePromise = ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`));
      });
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Empty response received from Gemini API");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse Gemini response as JSON: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    const validationResult = schema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new Error(
        `Gemini response failed schema validation: ${JSON.stringify(
          validationResult.error.flatten().fieldErrors
        )}`
      );
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw error;
    }
    throw new Error(
      `Gemini generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
