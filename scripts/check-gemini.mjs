// Diagnose the Gemini setup without printing secrets.
// Usage: node --env-file=.env.local scripts/check-gemini.mjs
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallback = process.env.GEMINI_FALLBACK_MODEL;

console.log(`GEMINI_API_KEY: ${key ? "present" : "MISSING"}`);
console.log(`GEMINI_MODEL: ${process.env.GEMINI_MODEL ? "present" : "missing (default gemini-2.5-flash)"} -> ${model}`);
console.log(`GEMINI_FALLBACK_MODEL: ${fallback ? `present -> ${fallback}` : "not set (optional)"}`);
if (!key) process.exit(1);

const ai = new GoogleGenAI({ apiKey: key });
const names = [];
try {
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if ((m.supportedActions || []).includes("generateContent")) names.push(m.name.replace(/^models\//, ""));
  }
  console.log(`\nModels supporting generateContent (${names.length}):`);
  for (const n of names.sort()) console.log(`  ${n}`);
  for (const m of [model, fallback].filter(Boolean)) {
    console.log(`\n${m}: ${names.includes(m) ? "AVAILABLE" : "NOT in the list for this key"}`);
  }
} catch (err) {
  console.log(`\nmodels.list failed: status=${err?.status ?? "-"} name=${err?.name} message=${String(err?.message).slice(0, 300)}`);
}

try {
  const res = await ai.models.generateContent({
    model,
    contents: "Reply with the JSON {\"ok\": true}.",
    config: { responseMimeType: "application/json" },
  });
  console.log(`\nTest call to ${model}: OK (${(res.text || "").slice(0, 40)})`);
} catch (err) {
  console.log(`\nTest call to ${model} failed: status=${err?.status ?? "-"} name=${err?.name} message=${String(err?.message).slice(0, 300)}`);
  console.log("  403 / API_KEY_INVALID = wrong, deleted or restricted key; 404 = unknown model; 429 = quota.");
}
