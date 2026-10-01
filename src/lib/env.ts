import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().min(1, "GEMINI_MODEL is required").default("gemini-2.5-flash"),
  GEMINI_FALLBACK_MODEL: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

const readRaw = (): Record<keyof Env, string | undefined> => ({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || undefined,
});

/**
 * Validated lazily, one variable at a time, when it is first read. This keeps
 * `next build` working without secrets and means a missing Gemini key does not
 * break routes that never call Gemini. Error messages name the variable only.
 */
export const env = new Proxy({} as Env, {
  get(_target, prop) {
    if (typeof prop !== "string" || !(prop in envSchema.shape)) return undefined;
    const key = prop as keyof Env;
    const result = envSchema.shape[key].safeParse(readRaw()[key]);
    if (!result.success) {
      throw new Error(`Invalid or missing environment variable: ${key}`);
    }
    return result.data;
  },
});
