import "server-only";
import { ApiError as GenAiApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "@/lib/env";
import {
  COMPARE_SYSTEM_INSTRUCTION,
  buildComparisonPrompt,
  geminiComparisonResponseSchema,
  type GeminiComparisonResponse,
} from "@/lib/prompts/compare";

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return aiClient;
}

/**
 * Why a comparison failed, for choosing the user message:
 * - temporary: 429 / 500 / 503 / timeout
 * - setup: missing or invalid key, unknown model, bad request, other server faults
 * - invalid_output: the reply was not valid JSON or did not match the schema
 */
export type ComparisonErrorKind = "temporary" | "setup" | "invalid_output";

export class ComparisonError extends Error {
  kind: ComparisonErrorKind;
  stage: "config" | "call" | "parse" | "validate";
  status?: number;

  constructor(
    kind: ComparisonErrorKind,
    stage: ComparisonError["stage"],
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "ComparisonError";
    this.kind = kind;
    this.stage = stage;
    this.status = status;
  }
}

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
  isQuickCheck?: boolean;
  timeoutMs?: number;
  /** Short reference id used in server logs. */
  refId?: string;
}

/**
 * Response schema sent to Gemini. Uses only the widely supported subset
 * (type, properties, required, items, enum) — no min/max, nullable, anyOf,
 * $ref or additionalProperties. Zod validation still runs on the parsed reply.
 */
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          issue_type: {
            type: Type.STRING,
            enum: ["scratch", "crack", "stain", "hole", "missing_item", "mark", "other"],
          },
          classification: { type: Type.STRING, enum: ["damage", "wear", "unclear"] },
          severity: { type: Type.STRING, enum: ["minor", "moderate", "major"] },
          confidence: { type: Type.NUMBER, description: "A decimal from 0.0 to 1.0, not a percentage." },
          reasoning: { type: Type.STRING },
          bounding_box: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Exactly four numbers [ymin, xmin, ymax, xmax], each 0 to 1000, on Image 2. Omit if unsure.",
          },
        },
        required: ["description", "issue_type", "classification", "severity", "confidence", "reasoning"],
        propertyOrdering: [
          "description",
          "issue_type",
          "classification",
          "severity",
          "confidence",
          "reasoning",
          "bounding_box",
        ],
      },
    },
    overall_note: { type: Type.STRING },
  },
  required: ["findings"],
  propertyOrdering: ["findings", "overall_note"],
};

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logFailure(refId: string, model: string, attempt: string, err: unknown) {
  const status = err instanceof GenAiApiError ? err.status : err instanceof ComparisonError ? err.status : undefined;
  const name = err instanceof Error ? err.name : typeof err;
  // SDK messages carry the HTTP status text and Google's error details; never the key or image data.
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 600);
  const stage = err instanceof ComparisonError ? err.stage : "call";
  console.error(
    `[compare ${refId}] stage=${stage} model=${model} attempt=${attempt} status=${status ?? "-"} name=${name} message=${message}`
  );
}

function toComparisonError(err: unknown): ComparisonError {
  if (err instanceof ComparisonError) return err;
  if (err instanceof GenAiApiError) {
    const kind: ComparisonErrorKind = RETRYABLE_STATUS.has(err.status) ? "temporary" : "setup";
    return new ComparisonError(kind, "call", err.message, err.status);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new ComparisonError("setup", "call", message);
}

/**
 * Server-only helper that compares a move-in and a move-out photo with Gemini.
 * JSON mode with a response schema, Zod validation, a 45-second timeout per call,
 * one retry after 2 seconds on 429/500/503, one retry on malformed output, and an
 * optional GEMINI_FALLBACK_MODEL tried once if the primary model returns 404 or 503.
 */
export async function comparePhotosWithGemini(
  params: ComparePhotosParams
): Promise<GeminiComparisonResponse> {
  const refId = params.refId || "-";
  const timeoutMs = params.timeoutMs || 45000;

  let ai: GoogleGenAI;
  let primaryModel: string;
  try {
    ai = getAi();
    primaryModel = env.GEMINI_MODEL;
  } catch (err) {
    // env.ts names the missing variable only, never its value.
    const configErr = new ComparisonError("setup", "config", err instanceof Error ? err.message : "Config error");
    logFailure(refId, "-", "0", configErr);
    throw configErr;
  }
  const fallbackModel = env.GEMINI_FALLBACK_MODEL;

  const promptText = buildComparisonPrompt({
    area: params.area,
    propertyName: params.propertyName,
    tenancyMonths: params.tenancyMonths,
    tenancyStart: params.tenancyStart,
    tenancyEnd: params.tenancyEnd,
    leaseNotes: params.leaseNotes,
    isQuickCheck: params.isQuickCheck,
  });

  const runCall = async (model: string): Promise<GeminiComparisonResponse> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const responsePromise = ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              { text: "Image 1 — MOVE-IN baseline photo:" },
              {
                inlineData: {
                  mimeType: params.moveInMimeType || "image/jpeg",
                  data: params.moveInBase64,
                },
              },
              { text: "Image 2 — MOVE-OUT departure photo:" },
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
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new ComparisonError("temporary", "call", `Timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);
      const rawText = response.text;

      if (!rawText) {
        const reason = response.candidates?.[0]?.finishReason || response.promptFeedback?.blockReason || "unknown";
        throw new ComparisonError("invalid_output", "parse", `Empty response (reason: ${reason})`);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseError) {
        throw new ComparisonError(
          "invalid_output",
          "parse",
          `Reply was not valid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      const validation = geminiComparisonResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new ComparisonError(
          "invalid_output",
          "validate",
          `Reply failed schema validation: ${JSON.stringify(validation.error.flatten())}`.slice(0, 600)
        );
      }

      return validation.data;
    } catch (err) {
      throw toComparisonError(err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  let model = primaryModel;
  let usedFallback = false;
  let usedStatusRetry = false;
  let usedOutputRetry = false;

  for (let attempt = 1; ; attempt++) {
    try {
      return await runCall(model);
    } catch (raw) {
      const err = toComparisonError(raw);
      logFailure(refId, model, String(attempt), err);

      if (fallbackModel && !usedFallback && fallbackModel !== model && (err.status === 404 || err.status === 503)) {
        usedFallback = true;
        model = fallbackModel;
        continue;
      }
      if (!usedStatusRetry && err.status !== undefined && RETRYABLE_STATUS.has(err.status)) {
        usedStatusRetry = true;
        await sleep(2000);
        continue;
      }
      if (!usedOutputRetry && err.kind === "invalid_output") {
        usedOutputRetry = true;
        continue;
      }
      throw err;
    }
  }
}
