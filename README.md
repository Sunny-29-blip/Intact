# Intact — Tenancy Condition Inspection App

## Problem and Solution

Tenants frequently face unfair security deposit deductions at move-out due to subjective condition assessments and disorganized photo records. **Intact** is a tenancy condition inspection app that pairs before-and-after area photographs, uses Google Gemini to automatically compare visual changes (classifying differences as property damage, normal wear-and-tear, or unclear), and compiles an organized condition record shareable with landlords.

## Live Application

- **Live URL**: [https://intact-in.vercel.app](https://intact-in.vercel.app)
- **Demo Video**: *Demo video link will be added here.*
- **Screenshots**: *Application screenshots will be added here.*

---

## Features

- **Tenant Dashboard (`/properties`)**:
  - Register tenancy records with flat/house name, address, contract start date, and contract end date.
  - Upload and privately store tenancy agreements (PDF, JPEG, PNG, WebP).
  - Dynamic tenancy countdown and status tracking ("Active", "Ends in N days", "Ended").
  - Add baseline move-in photos and departure move-out photos organized by area/room.
  - Trigger automated AI comparisons between paired photos.
  - Review AI findings: accept findings, dispute findings with personal notes, or leave them pending.
  - Explicitly toggle condition report sharing with linked property owners.

- **Owner Portal (`/owner`)**:
  - Register properties with property name, address, owner name, and property evidence documents (e.g. sale deed, property tax receipt).
  - Generate unique 8-character join codes (`/owner/properties/[id]`) for tenants.
  - View linked tenant records and tenancy dates.
  - Access read-only condition reports (`/owner/reports/[linkId]`) only when shared by the tenant.

- **Two-Photo Report & Comparison (`/report`, `/properties/[id]/compare/[area]`)**:
  - Side-by-side inspection view of baseline move-in and departure move-out photographs.
  - Interactive visual bounding boxes overlaid on departure images.
  - Structured difference classifications: `damage`, `wear`, or `unclear`.
  - Issue categorization: `scratch`, `crack`, `stain`, `hole`, `missing_item`, `mark`, or `other`.
  - Severity indicators (`minor`, `moderate`, `major`) and AI confidence scores.

- **User Profile (`/profile`)**:
  - View authenticated account email, creation timestamp, and assigned role (`tenant` or `owner`).
  - Update profile display name, phone number, and address information.

- **Public & Shared Links (`/report/[token]`)**:
  - Read-only condition report view accessible via unique share token for dispute resolution.

---

## How the AI Is Used

All visual condition analysis is executed strictly on the server:

1. **Server Route Execution**: The client triggers analysis via `POST /api/comparisons`. The server route downloads the move-in and move-out images directly from private Supabase storage.
2. **Multimodal Gemini Pipeline**: Both images, along with tenancy duration context, area label, and lease notes, are sent to Google Gemini Flash (`gemini-2.5-flash`) using `@google/genai`.
3. **Structured JSON Mode & Zod Validation**: The model runs under system instructions tuned for objective physical differences and outputs structured JSON. The response is validated server-side using Zod (`geminiComparisonResponseSchema`), ensuring bounding box coordinates are clamped between 0 and 1000.
4. **Persistent Findings**: Validated differences are stored in PostgreSQL (`findings` table) linked to the comparison record.
5. **Tenant Review Decisions**: Tenants review each finding in the UI, marking decisions as accepted or disputed with an explanation note.
6. **Zero Client Leakage**: The Google Gemini API key (`GEMINI_API_KEY`) is stored strictly in server-side environment variables and is never transmitted to or accessible from the browser.

---

## Architecture & Technology Stack

The table below contrasts Intact's implementation against the suggested hackathon reference stack:

| Layer | Hackathon Suggested Stack | Intact Implementation | Architectural Rationale & Differences |
| :--- | :--- | :--- | :--- |
| **Frontend** | React (Vite + React Router) | React 19 via Next.js 15 App Router | **Differs from Vite**: Leverages Next.js App Router for unified routing, React 19 server components, and co-located server route handlers. |
| **Backend** | Node.js (Express) | Node.js via Next.js Route Handlers (`/api/*`) on Vercel Serverless | **Differs from Express**: Replaces a standalone Express server with serverless route handlers deployed on Vercel, providing zero-maintenance scaling and shared TypeScript types. |
| **Authentication** | Custom JWT / bcrypt | Supabase Auth (JWT sessions & `@supabase/ssr`) | **Differs from custom JWT/bcrypt**: Uses Supabase Auth for session tokens, secure password hashing, and cookie management rather than hand-rolled JWTs. |
| **Validation** | Zod | Zod (v3.24) | **Matches reference**: Used for all incoming API payloads, client forms, and Gemini JSON schema verification. |
| **Database** | PostgreSQL | Supabase PostgreSQL with Row Level Security (RLS) | **Matches PostgreSQL**: Uses managed PostgreSQL with database-level RLS policies to isolate tenant and owner data securely. |
| **Object Storage** | Cloud Storage | Supabase Private Storage Buckets | Provides private storage buckets (`inspection-photos`, `documents`) with access restricted via RLS and signed URLs. |
| **AI / Vision** | Google Gemini | Google Gemini Flash (`@google/genai` SDK) | **Matches reference**: Multimodal vision analysis executed server-side with `gemini-2.5-flash`. |

---

## Setup and Local Development

### 1. Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- A [Supabase](https://supabase.com) account and project
- A [Google AI Studio](https://aistudio.google.com) Gemini API key

### 2. Installation
```bash
git clone https://github.com/Sunny-29-blip/Intact.git
cd Intact
npm install
```

### 3. Database & Storage Setup
1. In your Supabase Project Dashboard, navigate to the **SQL Editor**.
2. Open [`supabase/full-setup.sql`](supabase/full-setup.sql), copy its entire contents, and execute it. This creates all tables (`profiles`, `properties`, `owner_properties`, `tenancy_links`, `inspections`, `photos`, `comparisons`, `findings`, `documents`, `watch_events`), indexes, RLS policies, and private storage buckets (`inspection-photos`, `documents`).
3. In **Authentication** → **Providers** → **Email**, disable **"Confirm email"** to allow instant account activation during evaluation.

### 4. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Provide the required variable values:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anonymous/publishable key
- `SUPABASE_SECRET_KEY` — Supabase service role secret key (server-only)
- `GEMINI_API_KEY` — Google Gemini API key (server-only)
- `GEMINI_MODEL` — Gemini model identifier (`gemini-2.5-flash`)
- `NEXT_PUBLIC_SHOW_DEMO_LOGIN` — `true` to show demo account autofill buttons on `/login`

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production Build
```bash
npm run build
```

---

## Roles & Privacy Model

Intact enforces strict separation between roles:

- **Tenants (`role: 'tenant'`)**:
  - Have full control over their properties, contracts, and photographs.
  - Can link to an owner's property using an 8-character join code.
  - Retain control of report visibility via an explicit "Share report" toggle.
- **Owners (`role: 'owner'`)**:
  - Manage properties and generate join codes for prospective or current tenants.
  - Upload ownership and tax documents visible only to themselves.
  - **Sharing Boundary**: Owners can see tenant photos, condition reports, and AI findings **only after the tenant explicitly shares the report**. Prior to sharing, the owner sees only the linked tenancy status ("Not shared") and cannot view baseline or departure photographs.

---

## Demo Accounts

For evaluation, 8 demo accounts are configured with realistic tenancies and condition records:

| Email | Role | Name | Property / Tenancy | What to Look At |
| :--- | :--- | :--- | :--- | :--- |
| `demo.owner1@example.com` | Owner | Meera Kulkarni | Sunrise Residency, Block B, Pune | Linked tenants, shared reports (Tenants 1 & 3), unshared status (Tenant 2) |
| `demo.owner2@example.com` | Owner | Rajesh Menon | Lakeview Apartments, Hyderabad | Linked tenants (Tenants 4 & 5), empty report statuses, property evidence docs |
| `demo.tenant1@example.com` | Tenant | Ananya Rao | Flat 4B, Sunrise Residency | "Ends in 20 days" alert, shared report, accepted/disputed AI findings |
| `demo.tenant2@example.com` | Tenant | Imran Sheikh | Flat 2A, Sunrise Residency | Active tenancy (9 months left), report NOT shared with owner, living room check |
| `demo.tenant3@example.com` | Tenant | Priya Nair | Flat 7C, Sunrise Residency | Active tenancy, report SHARED with owner, bathroom check (no differences) |
| `demo.tenant4@example.com` | Tenant | Karthik Reddy | Apartment 301, Lakeview | "Contract ended 10 days ago" notice, report not started |
| `demo.tenant5@example.com` | Tenant | Sneha Joshi | Apartment 204, Lakeview | Active tenancy, linked to Owner 2, no report started |
| `demo.tenant6@example.com` | Tenant | Arjun Patel | Room 12, Green Park PG | Independent active tenancy, NOT linked to any owner |

### Demo Credentials
- **Shared Password**: `IntactDemo#2026`
- **Demo Login**: When `NEXT_PUBLIC_SHOW_DEMO_LOGIN=true`, the `/login` page provides quick-fill buttons for demo credentials.

### Seeding and Resetting
- **Seed Demo Data**:
  ```bash
  npm run seed:demo
  ```
- **Reset Demo Data**:
  ```bash
  npm run seed:demo -- --reset --yes
  ```

*Notes on Demo Data*:
- Sample photos are placed in `demo-assets/`.
- Visual comparisons are executed through the live Gemini multimodal pipeline at seed time (never hardcoded).
- Tenancy dates and countdowns are calculated relative to the day the seed script is run.
- The demo password is public by design for reviewer testing.

---

## Security Architecture

- **Private Storage Buckets**: Storage buckets (`inspection-photos` and `documents`) are private. Direct public access is disabled.
- **Row Level Security (RLS)**: PostgreSQL tables and storage objects enforce RLS policies matching `auth.uid()`. Cross-user data leakage is blocked at the database engine level.
- **Server-Side Secret Isolation**: Secrets (`SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`) are kept in server environment variables and never exposed to browser bundles.
- **Time-Limited Signed URLs**: Inspection photos and contract documents are accessed exclusively via temporary signed URLs with 1-hour or 5-minute expiry limits.
- **Document Protection**: Tenancy contracts and property deeds are stored privately for user records and are never transmitted to Google Gemini.

---

## Limitations

- **Automated Comparison Nuances**: Computer vision models can occasionally produce false positives or misclassify lighting differences and minor perspective shifts.
- **Not Legal Advice**: Intact generates condition comparison records. It does not provide legal advice, determine security deposit deductions, or establish legal liability.
- **Cryptographic File Hashes**: SHA-256 hashes generated at upload prove that a file has not been modified since it was uploaded to the platform; they do not verify the external physical date when the photo was originally taken.
- **Email Verification**: Email verification is disabled in demo mode to allow frictionless testing.
