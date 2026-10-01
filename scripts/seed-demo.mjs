#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// 1. Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: {
    transport: {
      WebSocket: class DummyWebSocket {
        constructor() {}
        addEventListener() {}
        removeEventListener() {}
      },
    },
  },
});

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const DEMO_PASSWORD = "IntactDemo#2026";
const DEMO_ASSETS_DIR = path.resolve(process.cwd(), "demo-assets");

// CLI arguments
const args = process.argv.slice(2);
const isReset = args.includes("--reset");
const isYes = args.includes("--yes");

// Helper: generate 1-page sample PDF
function createSamplePdf(text = "SAMPLE DOCUMENT - demo data") {
  const content = `BT /F1 24 Tf 50 700 Td (${text}) Tj ET`;
  const streamLen = Buffer.byteLength(content);
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  offsets[1] = pdf.length;
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  offsets[2] = pdf.length;
  pdf += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  offsets[3] = pdf.length;
  pdf += "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  offsets[4] = pdf.length;
  pdf += `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj\n`;
  offsets[5] = pdf.length;
  pdf += "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const xrefOffset = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf-8");
}

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

// -------------------------------------------------------------
// RESET MODE
// -------------------------------------------------------------
async function handleReset() {
  if (!isYes) {
    console.error("Error: --reset requires the --yes flag to confirm deletion.");
    process.exit(1);
  }

  console.log("Resetting all demo data...");

  // 1. Fetch all users with app_metadata.is_demo === true
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("Failed to list users:", listErr);
    process.exit(1);
  }

  const demoUsers = (users || []).filter((u) => u.app_metadata?.is_demo === true);
  console.log(`Found ${demoUsers.length} demo user(s) to remove.`);

  for (const user of demoUsers) {
    console.log(`- Removing demo user ${user.email} (${user.id})...`);

    // Clean up storage objects for this user
    for (const bucket of ["inspection-photos", "documents"]) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(user.id);
        if (files && files.length > 0) {
          // Recursively list and delete
          const pathsToDelete = [];
          for (const item of files) {
            if (item.id) {
              pathsToDelete.push(`${user.id}/${item.name}`);
            } else {
              // Directory
              const { data: subFiles } = await supabase.storage.from(bucket).list(`${user.id}/${item.name}`);
              (subFiles || []).forEach((sf) => pathsToDelete.push(`${user.id}/${item.name}/${sf.name}`));
            }
          }
          if (pathsToDelete.length > 0) {
            await supabase.storage.from(bucket).remove(pathsToDelete);
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Delete user from auth (cascades to DB tables)
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error(`  Failed to delete auth user ${user.id}:`, delErr.message);
    }
  }

  console.log("Demo reset complete.");
}

// -------------------------------------------------------------
// SEED MODE
// -------------------------------------------------------------
const COMPARE_SYSTEM_INSTRUCTION = `You are Intact AI, an objective, expert tenancy condition comparison specialist.
You inspect two photos of the same rental area:
Image 1 is the MOVE-IN baseline photo.
Image 2 is the MOVE-OUT departure photo.

Your task is to identify real, physical changes between move-in and move-out.

CRITICAL RULES:
1. Report ONLY real physical differences (things that are new, deteriorated, broken, or missing in Image 2 compared to Image 1).
2. IGNORE non-damage differences caused by camera angle, lighting, shadows, or moved portable tenant belongings.
3. CLASSIFICATION:
   - "damage": Accidental or neglectful damage (holes, gouges, burns, heavy stains, broken fixtures, cracks).
   - "wear": Expected gradual deterioration from ordinary reasonable residential use (light scuffs, minor paint fading).
   - "unclear": The visual difference cannot be determined with certainty.
4. ISSUE TYPE:
   - Assign "issue_type" to exactly one of: "scratch", "crack", "stain", "hole", "missing_item", "mark", "other".
5. DESCRIPTION:
   - Write ONE plain, simple sentence an ordinary tenant can easily understand without technical or legal jargon.
6. BOUNDING BOXES:
   - Provide a bounding box [ymin, xmin, ymax, xmax] coordinates normalized from 0 to 1000 on Image 2.
7. HONESTY:
   - If nothing meaningful has changed, return an empty findings array: "findings": [].`;

const geminiFindingSchema = z.object({
  description: z.string().min(1),
  issue_type: z.enum(["scratch", "crack", "stain", "hole", "missing_item", "mark", "other"]).catch("other").default("other"),
  classification: z.enum(["damage", "wear", "unclear"]),
  severity: z.enum(["minor", "moderate", "major"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional().default(""),
  bounding_box: z.array(z.number()).length(4).nullable().optional(),
});

const geminiComparisonSchema = z.object({
  findings: z.array(geminiFindingSchema).default([]),
  overall_note: z.string().nullish().transform((v) => v || ""),
});

async function runGeminiComparison(moveInBase64, moveOutBase64, area, propertyName, tenancyMonths) {
  if (!genAI) {
    console.warn("  [!] GEMINI_API_KEY is not set. Cannot run visual comparison pipeline.");
    return { findings: [] };
  }

  const promptText = `Analyze and compare these two condition photos for area "${area}" in property "${propertyName}". Tenancy duration: ~${tenancyMonths} month(s). Return findings strictly matching JSON schema.`;

  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: promptText },
          { inlineData: { mimeType: "image/jpeg", data: moveInBase64 } },
          { inlineData: { mimeType: "image/jpeg", data: moveOutBase64 } },
        ],
      },
    ],
    config: {
      systemInstruction: COMPARE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  const parsed = JSON.parse(response.text || "{}");
  return geminiComparisonSchema.parse(parsed);
}

async function getOrCreateDemoUser(email, role, displayName) {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let user = (users || []).find((u) => u.email === email);

  if (!user) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { is_demo: true },
      user_metadata: { display_name: displayName },
    });
    if (error || !created.user) {
      throw new Error(`Failed to create demo user ${email}: ${error?.message}`);
    }
    user = created.user;
  }

  // Ensure profile
  await supabase.from("profiles").upsert({
    user_id: user.id,
    role,
    display_name: displayName,
  });

  return user;
}

async function handleSeed() {
  console.log("=============================================================");
  console.log("INTACT — Seeding Demo Accounts & Real Comparison Data");
  console.log("=============================================================");

  // Check demo assets
  const expectedPairs = [
    { id: "01", name: "Bedroom north wall", in: "01-bedroom-in.jpg", out: "01-bedroom-out.jpg" },
    { id: "02", name: "Kitchen counter", in: "02-kitchen-in.jpg", out: "02-kitchen-out.jpg" },
    { id: "03", name: "Living room", in: "03-living-in.jpg", out: "03-living-out.jpg" },
    { id: "04", name: "Bathroom", in: "04-bathroom-in.jpg", out: "04-bathroom-out.jpg" },
  ];

  const availablePairs = [];
  const missingPairs = [];

  for (const pair of expectedPairs) {
    const inPath = path.join(DEMO_ASSETS_DIR, pair.in);
    const outPath = path.join(DEMO_ASSETS_DIR, pair.out);
    if (fs.existsSync(inPath) && fs.existsSync(outPath)) {
      availablePairs.push({
        ...pair,
        inBuffer: fs.readFileSync(inPath),
        outBuffer: fs.readFileSync(outPath),
      });
    } else {
      missingPairs.push(pair);
    }
  }

  if (missingPairs.length > 0) {
    console.log(`Note: Missing photo pairs in ${DEMO_ASSETS_DIR}:`);
    missingPairs.forEach((m) => console.log(`  - Pair ${m.id} (${m.name}): ${m.in} or ${m.out} not found`));
    console.log(`Proceeding to seed with available ${availablePairs.length} pair(s).`);
  } else {
    console.log(`All 4 photo pairs verified in ${DEMO_ASSETS_DIR}.`);
  }

  const now = new Date();
  const samplePdfBuffer = createSamplePdf("SAMPLE DOCUMENT - demo data");

  // 1. OWNER 1: Meera Kulkarni
  console.log("\n[1/8] Setting up Owner 1: Meera Kulkarni (demo.owner1@example.com)...");
  const owner1 = await getOrCreateDemoUser("demo.owner1@example.com", "owner", "Meera Kulkarni");
  
  let { data: owner1Props } = await supabase
    .from("owner_properties")
    .select("*")
    .eq("owner_id", owner1.id)
    .eq("name", "Sunrise Residency, Block B");

  let owner1Property = owner1Props?.[0];
  if (!owner1Property) {
    const { data: newOp } = await supabase
      .from("owner_properties")
      .insert({
        owner_id: owner1.id,
        name: "Sunrise Residency, Block B",
        address: "Baner Road, Indiranagar Area",
        city: "Pune",
        owner_name: "Meera Kulkarni",
        join_code: "SUNRISE-B1",
      })
      .select()
      .single();
    owner1Property = newOp;
  }

  // Upload sample PDF document for owner 1
  if (owner1Property) {
    const storagePath = `${owner1.id}/property_evidence/${owner1Property.id}/ownership_deed.pdf`;
    await supabase.storage.from("documents").upload(storagePath, samplePdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    await supabase.from("documents").upsert({
      user_id: owner1.id,
      kind: "property_evidence",
      owner_property_id: owner1Property.id,
      storage_path: storagePath,
      original_name: "ownership_deed_sample.pdf",
      mime_type: "application/pdf",
      size_bytes: samplePdfBuffer.length,
      sha256: crypto.createHash("sha256").update(samplePdfBuffer).digest("hex"),
    });
  }

  // 2. OWNER 2: Rajesh Menon
  console.log("\n[2/8] Setting up Owner 2: Rajesh Menon (demo.owner2@example.com)...");
  const owner2 = await getOrCreateDemoUser("demo.owner2@example.com", "owner", "Rajesh Menon");

  let { data: owner2Props } = await supabase
    .from("owner_properties")
    .select("*")
    .eq("owner_id", owner2.id)
    .eq("name", "Lakeview Apartments");

  let owner2Property = owner2Props?.[0];
  if (!owner2Property) {
    const { data: newOp } = await supabase
      .from("owner_properties")
      .insert({
        owner_id: owner2.id,
        name: "Lakeview Apartments",
        address: "Gachibowli Outer Ring Road",
        city: "Hyderabad",
        owner_name: "Rajesh Menon",
        join_code: "LAKEVIEW-H2",
      })
      .select()
      .single();
    owner2Property = newOp;
  }

  if (owner2Property) {
    const storagePath = `${owner2.id}/property_evidence/${owner2Property.id}/property_tax.pdf`;
    await supabase.storage.from("documents").upload(storagePath, samplePdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    await supabase.from("documents").upsert({
      user_id: owner2.id,
      kind: "property_evidence",
      owner_property_id: owner2Property.id,
      storage_path: storagePath,
      original_name: "property_tax_sample.pdf",
      mime_type: "application/pdf",
      size_bytes: samplePdfBuffer.length,
      sha256: crypto.createHash("sha256").update(samplePdfBuffer).digest("hex"),
    });
  }

  const comparisonSummary = [];

  // Helper to setup tenant property & run comparisons
  async function setupTenant({
    email,
    displayName,
    flatName,
    address,
    startDate,
    endDate,
    linkedOwnerProperty,
    isShared,
    photoPairsToSeed = [],
    setTenant1Decisions = false,
  }) {
    const user = await getOrCreateDemoUser(email, "tenant", displayName);

    let { data: existingProps } = await supabase
      .from("properties")
      .select("*")
      .eq("user_id", user.id)
      .eq("name", flatName);

    let property = existingProps?.[0];
    if (!property) {
      const { data: newProp } = await supabase
        .from("properties")
        .insert({
          user_id: user.id,
          tenant_name: displayName,
          name: flatName,
          address,
          tenancy_start: formatDate(startDate),
          tenancy_end: endDate ? formatDate(endDate) : null,
        })
        .select()
        .single();
      property = newProp;
    }

    if (!property) return;

    // Attach tenancy contract document
    const docPath = `${user.id}/tenancy_contract/${property.id}/contract.pdf`;
    await supabase.storage.from("documents").upload(docPath, samplePdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    await supabase.from("documents").upsert({
      user_id: user.id,
      kind: "tenancy_contract",
      property_id: property.id,
      storage_path: docPath,
      original_name: "tenancy_agreement_sample.pdf",
      mime_type: "application/pdf",
      size_bytes: samplePdfBuffer.length,
      sha256: crypto.createHash("sha256").update(samplePdfBuffer).digest("hex"),
    });

    // Link to owner property if applicable
    if (linkedOwnerProperty) {
      await supabase.from("tenancy_links").upsert(
        {
          owner_property_id: linkedOwnerProperty.id,
          tenant_id: user.id,
          tenant_property_id: property.id,
          shared: Boolean(isShared),
        },
        { onConflict: "owner_property_id,tenant_id" }
      );
    }

    // Ensure inspections
    let { data: inspList } = await supabase.from("inspections").select("*").eq("property_id", property.id);
    let moveInInsp = inspList?.find((i) => i.kind === "move_in");
    let moveOutInsp = inspList?.find((i) => i.kind === "move_out");

    if (!moveInInsp) {
      const { data: mi } = await supabase
        .from("inspections")
        .insert({ user_id: user.id, property_id: property.id, kind: "move_in" })
        .select()
        .single();
      moveInInsp = mi;
    }
    if (!moveOutInsp) {
      const { data: mo } = await supabase
        .from("inspections")
        .insert({ user_id: user.id, property_id: property.id, kind: "move_out" })
        .select()
        .single();
      moveOutInsp = mo;
    }

    // Seed photos and comparisons for specified pairs
    for (const pair of photoPairsToSeed) {
      const pairData = availablePairs.find((p) => p.id === pair.id);
      if (!pairData) continue;

      const area = pair.name;
      const inUuid = crypto.randomUUID();
      const outUuid = crypto.randomUUID();

      const inStoragePath = `${user.id}/${property.id}/move_in/${inUuid}.jpg`;
      const outStoragePath = `${user.id}/${property.id}/move_out/${outUuid}.jpg`;

      const inSha = crypto.createHash("sha256").update(pairData.inBuffer).digest("hex");
      const outSha = crypto.createHash("sha256").update(pairData.outBuffer).digest("hex");

      await supabase.storage.from("inspection-photos").upload(inStoragePath, pairData.inBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });
      await supabase.storage.from("inspection-photos").upload(outStoragePath, pairData.outBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

      // Insert photos
      const { data: inPhoto } = await supabase
        .from("photos")
        .insert({
          user_id: user.id,
          inspection_id: moveInInsp.id,
          area,
          storage_path: inStoragePath,
          sha256: inSha,
        })
        .select()
        .single();

      const { data: outPhoto } = await supabase
        .from("photos")
        .insert({
          user_id: user.id,
          inspection_id: moveOutInsp.id,
          area,
          storage_path: outStoragePath,
          sha256: outSha,
        })
        .select()
        .single();

      // Run Gemini Visual Comparison
      console.log(`  -> Running Gemini visual comparison for "${area}" (Pair ${pair.id})...`);
      const tenancyMonths = 18;
      const moveInBase64 = pairData.inBuffer.toString("base64");
      const moveOutBase64 = pairData.outBuffer.toString("base64");

      const geminiResult = await runGeminiComparison(
        moveInBase64,
        moveOutBase64,
        area,
        property.name,
        tenancyMonths
      );

      // Create comparison row
      const { data: comp } = await supabase
        .from("comparisons")
        .insert({
          user_id: user.id,
          property_id: property.id,
          area,
          move_in_photo_id: inPhoto?.id || null,
          move_out_photo_id: outPhoto?.id || null,
          status: "complete",
        })
        .select()
        .single();

      // Insert findings
      const findingsToInsert = geminiResult.findings.map((f) => ({
        user_id: user.id,
        comparison_id: comp.id,
        description: f.description,
        classification: f.classification,
        severity: f.severity,
        issue_type: f.issue_type || "other",
        confidence: Number(f.confidence.toFixed(2)),
        box_ymin: f.bounding_box ? Math.round(f.bounding_box[0]) : null,
        box_xmin: f.bounding_box ? Math.round(f.bounding_box[1]) : null,
        box_ymax: f.bounding_box ? Math.round(f.bounding_box[2]) : null,
        box_xmax: f.bounding_box ? Math.round(f.bounding_box[3]) : null,
        reasoning: f.reasoning || null,
        decision: "pending",
      }));

      let insertedFindings = [];
      if (findingsToInsert.length > 0) {
        const { data: ins } = await supabase.from("findings").insert(findingsToInsert).select();
        insertedFindings = ins || [];
      }

      // Record summary
      comparisonSummary.push({
        pairId: pair.id,
        area,
        tenant: displayName,
        findingsCount: insertedFindings.length,
        findings: insertedFindings.map((f) => `[${f.classification.toUpperCase()}] ${f.description}`),
      });

      // Tenant 1 decisions: accept some, reject one with note, leave one not reviewed
      if (setTenant1Decisions && insertedFindings.length > 0) {
        if (insertedFindings[0]) {
          await supabase
            .from("findings")
            .update({ decision: "accepted" })
            .eq("id", insertedFindings[0].id);
        }
        if (insertedFindings[1]) {
          await supabase
            .from("findings")
            .update({
              decision: "disputed",
              decision_note: "Pre-existing mark present before handover.",
            })
            .eq("id", insertedFindings[1].id);
        }
      }
    }
  }

  // 3. TENANT 1: Ananya Rao (ends in 20 days, linked to Owner 1, SHARED)
  console.log("\n[3/8] Setting up Tenant 1: Ananya Rao (demo.tenant1@example.com)...");
  const t1Start = new Date(now);
  t1Start.setMonth(t1Start.getMonth() - 18);
  const t1End = new Date(now);
  t1End.setDate(t1End.getDate() + 20);

  await setupTenant({
    email: "demo.tenant1@example.com",
    displayName: "Ananya Rao",
    flatName: "Flat 4B, Sunrise Residency",
    address: "Baner Road, Indiranagar Area, Pune",
    startDate: t1Start,
    endDate: t1End,
    linkedOwnerProperty: owner1Property,
    isShared: true,
    photoPairsToSeed: [
      { id: "01", name: "Bedroom north wall" },
      { id: "02", name: "Kitchen counter" },
    ],
    setTenant1Decisions: true,
  });

  // 4. TENANT 2: Imran Sheikh (ends in 9 months, linked to Owner 1, NOT shared)
  console.log("\n[4/8] Setting up Tenant 2: Imran Sheikh (demo.tenant2@example.com)...");
  const t2Start = new Date(now);
  t2Start.setMonth(t2Start.getMonth() - 3);
  const t2End = new Date(now);
  t2End.setMonth(t2End.getMonth() + 9);

  await setupTenant({
    email: "demo.tenant2@example.com",
    displayName: "Imran Sheikh",
    flatName: "Flat 2A, Sunrise Residency",
    address: "Baner Road, Indiranagar Area, Pune",
    startDate: t2Start,
    endDate: t2End,
    linkedOwnerProperty: owner1Property,
    isShared: false,
    photoPairsToSeed: [{ id: "03", name: "Living room" }],
  });

  // 5. TENANT 3: Priya Nair (active, linked to Owner 1, SHARED)
  console.log("\n[5/8] Setting up Tenant 3: Priya Nair (demo.tenant3@example.com)...");
  const t3Start = new Date(now);
  t3Start.setMonth(t3Start.getMonth() - 2);
  const t3End = new Date(now);
  t3End.setMonth(t3End.getMonth() + 10);

  await setupTenant({
    email: "demo.tenant3@example.com",
    displayName: "Priya Nair",
    flatName: "Flat 7C, Sunrise Residency",
    address: "Baner Road, Indiranagar Area, Pune",
    startDate: t3Start,
    endDate: t3End,
    linkedOwnerProperty: owner1Property,
    isShared: true,
    photoPairsToSeed: [{ id: "04", name: "Bathroom" }],
  });

  // 6. TENANT 4: Karthik Reddy (ended 10 days ago, linked to Owner 2, no photos)
  console.log("\n[6/8] Setting up Tenant 4: Karthik Reddy (demo.tenant4@example.com)...");
  const t4Start = new Date(now);
  t4Start.setMonth(t4Start.getMonth() - 12);
  const t4End = new Date(now);
  t4End.setDate(t4End.getDate() - 10);

  await setupTenant({
    email: "demo.tenant4@example.com",
    displayName: "Karthik Reddy",
    flatName: "Apartment 301, Lakeview",
    address: "Gachibowli Outer Ring Road, Hyderabad",
    startDate: t4Start,
    endDate: t4End,
    linkedOwnerProperty: owner2Property,
    isShared: false,
    photoPairsToSeed: [],
  });

  // 7. TENANT 5: Sneha Joshi (active, linked to Owner 2, no report)
  console.log("\n[7/8] Setting up Tenant 5: Sneha Joshi (demo.tenant5@example.com)...");
  const t5Start = new Date(now);
  t5Start.setMonth(t5Start.getMonth() - 1);
  const t5End = new Date(now);
  t5End.setMonth(t5End.getMonth() + 11);

  await setupTenant({
    email: "demo.tenant5@example.com",
    displayName: "Sneha Joshi",
    flatName: "Apartment 204, Lakeview",
    address: "Gachibowli Outer Ring Road, Hyderabad",
    startDate: t5Start,
    endDate: t5End,
    linkedOwnerProperty: owner2Property,
    isShared: false,
    photoPairsToSeed: [],
  });

  // 8. TENANT 6: Arjun Patel (active, UNLINKED)
  console.log("\n[8/8] Setting up Tenant 6: Arjun Patel (demo.tenant6@example.com)...");
  const t6Start = new Date(now);
  t6Start.setMonth(t6Start.getMonth() - 1);
  const t6End = new Date(now);
  t6End.setMonth(t6End.getMonth() + 11);

  await setupTenant({
    email: "demo.tenant6@example.com",
    displayName: "Arjun Patel",
    flatName: "Room 12, Green Park PG",
    address: "Koramangala 5th Block, Bengaluru",
    startDate: t6Start,
    endDate: t6End,
    linkedOwnerProperty: null,
    isShared: false,
    photoPairsToSeed: [],
  });

  console.log("\n=============================================================");
  console.log("SEEDED AI COMPARISON FINDINGS SUMMARY");
  console.log("=============================================================");
  if (comparisonSummary.length === 0) {
    console.log("No comparisons were seeded (missing demo photo assets).");
  } else {
    for (const item of comparisonSummary) {
      console.log(`\nPair ${item.pairId} — ${item.area} (${item.tenant}):`);
      console.log(`  Total Findings: ${item.findingsCount}`);
      if (item.findings.length === 0) {
        console.log("  No differences identified.");
      } else {
        item.findings.forEach((f) => console.log(`  - ${f}`));
      }
    }
  }
  console.log("\nDemo seeding successfully completed.");
}

// -------------------------------------------------------------
// MAIN ENTRYPOINT
// -------------------------------------------------------------
if (isReset) {
  handleReset().catch((err) => {
    console.error("Reset error:", err);
    process.exit(1);
  });
} else {
  handleSeed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
}
