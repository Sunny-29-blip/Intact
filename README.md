# Intact — Tenant Inspection Evidence Engine

## Problem

Tenants frequently face unfair security deposit deductions at move-out due to subjective condition assessments and disorganized photo records. **Intact** is a tenant-side move-in/move-out inspection app that pairs before-and-after area photographs, uses an automated visual comparison (Google Gemini, called only from the server) to describe visible changes as damage, Normal wear or unclear, and compiles a dated record the tenant can share with the owner through a read-only link.

## Features

- Email and password signup with no email confirmation; the user picks a role (tenant or owner) and goes straight to their dashboard. Login, logout, persistent session, a neutral wrong-credentials message, and independent show/hide on each password field.
- Tenants: add a flat or house (name, address, contract start and end dates, contract file), see contract status, link to an owner property with a join code, and switch report sharing on or off.
- Owners: add a property (name, address, owner name, evidence documents), get a join code, see linked tenants with contract dates and report status, and open a tenant's report only when the tenant has shared it.
- Report (`/report`): pick a property, name an area, add move-in and move-out photos (drag and drop, click, or camera on mobile), then "Check for differences". Findings appear as plain cards (what changed, issue type, condition, confidence as High / Medium / Low, notes) with Accept / Reject / Clear. Small numbered markers sit on the move-out photo.
- Profile: edit name, phone and address; tenants edit their flats, owners their properties; email and role are read-only.
- Public read-only shared report at `/report/[token]` (printable, not indexed), and a landing page with an example, how it works and limits.

## How it works

1. Photos are resized in the browser, hashed with SHA-256 and uploaded to the private `inspection-photos` bucket under the user's own folder; the server records the photo row.
2. "Check for differences" calls `POST /api/comparisons`. The server checks the session and ownership, downloads both photos from private storage and sends them to Gemini in JSON mode with a 45-second timeout.
3. The response is validated with Zod. Malformed output, timeouts and missing photos return a friendly `{ error: { code, message } }` and the comparison is marked failed.
4. Valid findings are saved to `findings`; the tenant's Accept / Reject / Clear decisions are saved with `PATCH /api/findings/[id]`.
5. Photos are shown through short-lived signed URLs only.

## Architecture

- `src/app` — App Router pages and `api/*` route handlers. Every route returns `{ data }` or `{ error: { code, message } }`.
- `src/middleware.ts` — refreshes the Supabase session, redirects logged-out users and keeps tenants and owners on their own pages.
- `src/lib/supabase/server.ts` (server-only) — cookie-based client plus an admin client for the few server tasks that need it.
- `src/lib/gemini.ts`, `src/lib/env.ts` (server-only) — Gemini call and environment validation.
- `supabase/*.sql` — tables, RLS policies and private buckets.

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19, TypeScript)
- **Styling & Design System**: Tailwind CSS (document aesthetic: warm off-white paper, ink typography, semantic status tokens)
- **Database & Storage**: Supabase (PostgreSQL with Row Level Security, private object storage for photos)
- **Authentication**: Supabase Auth via `@supabase/ssr` (Email & Password, server session validation)
- **AI / Computer Vision Comparison**: Google Gemini Flash (`@google/genai` SDK, server-only structured JSON mode with Zod validation)
- **Schema Validation**: Zod
- **Deployment**: Vercel

## Backend Architecture & API

The Intact backend is built on Supabase (PostgreSQL with Row Level Security, Auth, and Storage) and Next.js 15 Server Route Handlers. All multimodal AI comparisons are executed server-side via Google Gemini (`gemini-2.5-flash`).

### Core Backend Capabilities
- **Authentication & Roles**: Email/password authentication via Supabase Auth. User profiles determine role (`tenant` or `owner`). Middleware enforces route protection, unauthenticated redirects, and role isolation.
- **Contract Status Engine**: Shared helper (`lib/contract-status.ts`) calculates calendar-accurate tenancy duration ("Active", "Ends in N days", "Ended") without timezone drift.
- **Two-Photo Report Pipeline**: Move-in baseline and move-out departure photographs are resized in-browser, SHA-256 hashed, uploaded to private storage, and compared on the server with Gemini structured JSON output and Zod validation. Findings and tenant review decisions (Accepted / Rejected / Not reviewed) persist directly in Postgres.
- **Owner & Tenant Dashboards**: Tenants control private condition records and toggle report sharing per property. Owners manage join codes and access read-only condition reports (`/owner/reports/[linkId]`) only when shared by the tenant.
- **Security Boundaries**: Private storage buckets, server-only secret keys and Gemini tokens, time-limited signed URLs, and strict RLS policies.

For complete backend architecture, database schemas, and API documentation, see [`docs/backend.md`](docs/backend.md).

## Roles & Workflows

Intact supports two distinct roles with separate dashboards, field requirements, and strict server-enforced privacy boundaries:

- **Owner (`role: 'owner'`)**:
  - Adds properties via `/owner` ("+ Add property"):
    - **Property name** (required)
    - **Address** (required)
    - **Owner name** (required; prefilled from profile display name, editable)
    - **Documents related to the property** (required: 1 to 5 files, e.g., ownership proof, sale deed, property tax receipt)
  - Generates unique 8-character join codes (`/owner/properties/[id]`) for tenants.
  - Manages property evidence documents (View via 5-minute signed URLs, Add, Remove).
  - Views linked tenant entries and accesses read-only inspection reports only when explicitly shared by the tenant.
  - Has no direct access to tenant contracts, move-in/move-out baseline photos, or private dispute notes.

- **Tenant (`role: 'tenant'`)**:
  - Adds properties via `/properties` ("+ Add property"):
    - **Your name** (required; prefilled from profile, editable)
    - **Flat or house name** (required)
    - **Address** (required)
    - **Contract with the owner** (required: 1 active file, replacing old file on update)
    - **Contract start date & Contract valid until date** (both required; valid until must be after start date)
  - Manages tenancy contract with live expiration tracking ("Expires in N days" / "Expired").
  - Records move-in and move-out condition photos, reviews AI visual comparison findings, and controls report sharing.
  - Links to owner properties using the join code without exposing private documents.

## Private Documents & Privacy Model

- **Private Storage Bucket (`documents`)**: Files are uploaded to private, non-public Supabase object storage scoped to `{user_id}/{kind}/{parent_id}/{uuid}.{ext}`. Storage and database RLS ensure only the object's owner (`auth.uid()`) can select, insert, or delete.
- **Short-Lived Signed URLs**: Documents are never exposed publicly. Viewing any document generates a signed URL with a 5-minute expiry after explicit server-side ownership verification.
- **Strict Role Isolation**: Owners cannot read tenant contracts, and tenants cannot read owner property documents. Non-owners cannot access files by guessing IDs or paths.
- **AI Isolation**: Uploaded documents and contracts are **never sent to Google Gemini**. Gemini only ever receives move-in and move-out comparison photos.
- **Document Integrity & Storage Policy**: Client validates file format (PDF, JPEG, PNG, WebP) and 10 MB size limits, computes SHA-256 hashes via `crypto.subtle`, and stores original file names purely for escaped UI display.
- **Disclaimers & Verification**: Intact stores files privately for user archival purposes and does not make legal claims or verify document legality.
- **Lifecycle Cleanup**: Deleting an owner property or tenant property permanently deletes all related document objects from storage and cascades database deletions.

## Demo Accounts

For testing and evaluating Intact, 8 pre-configured demo accounts are provided with realistic tenancy and ownership records:

| Email | Role | Name | Tenancy / Property | What to Look At |
| :--- | :--- | :--- | :--- | :--- |
| `demo.owner1@example.com` | Owner | Meera Kulkarni | Sunrise Residency, Block B, Pune | Linked tenants, shared reports (Tenants 1 & 3), not shared status (Tenant 2) |
| `demo.owner2@example.com` | Owner | Rajesh Menon | Lakeview Apartments, Hyderabad | Linked tenants (Tenants 4 & 5), empty report statuses, property evidence |
| `demo.tenant1@example.com` | Tenant | Ananya Rao | Flat 4B, Sunrise Residency | Ends in 20 days notice, shared report with owner, reviewed AI findings (accepted/rejected) |
| `demo.tenant2@example.com` | Tenant | Imran Sheikh | Flat 2A, Sunrise Residency | Active contract (9 months remaining), report NOT shared with owner, living room check |
| `demo.tenant3@example.com` | Tenant | Priya Nair | Flat 7C, Sunrise Residency | Active contract, shared report with owner, bathroom check (clean/no differences) |
| `demo.tenant4@example.com` | Tenant | Karthik Reddy | Apartment 301, Lakeview | Contract ended 10 days ago notice, linked to Owner 2, report not started |
| `demo.tenant5@example.com` | Tenant | Sneha Joshi | Apartment 204, Lakeview | Active contract, linked to Owner 2, report not started |
| `demo.tenant6@example.com` | Tenant | Arjun Patel | Room 12, Green Park PG | Active independent tenancy, NOT linked to any owner |

### Shared Demo Password
```text
IntactDemo#2026
```

### Seeding and Resetting Demo Data
- **Seed Demo Accounts & Comparison Data**:
  ```bash
  npm run seed:demo
  ```
- **Reset Demo Accounts & Clean Storage**:
  ```bash
  npm run seed:demo -- --reset --yes
  ```

### Important Notes
- **Sample Photos**: All condition comparison photos in demo accounts are genuine sample property photos placed in `public/assets/`.
- **Real AI Pipeline**: The condition analysis and findings are generated by the real Google Gemini multimodal comparison pipeline at seed time (never hardcoded or faked).
- **Relative Dates**: All tenancy start dates and expiration countdowns are dynamically calculated relative to the date the seed script is run.
- **Public Demo Password**: The demo password is public by design to allow instant evaluation by judges and testers.

## Setup

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd intact
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure the Database & Storage in Supabase**:
   - Open your Supabase Project Dashboard.
   - Navigate to the **SQL Editor**.
   - Run these files in order (each is safe to re-run except where noted in the file): `supabase/schema.sql`, `supabase/roles.sql`, `supabase/report.sql`, `supabase/documents.sql`, `supabase/fix-properties.sql`, `supabase/fix-final.sql`.
   - In Authentication settings, turn off "Confirm email" so signup goes straight to the dashboard.

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env.local
   ```
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` and optionally `GEMINI_MODEL` and `NEXT_PUBLIC_SHOW_DEMO_LOGIN` in `.env.local`. Never commit this file.

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Exposed to Client |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable / Anon API Key | Yes |
| `SUPABASE_SECRET_KEY` | Supabase Service Role / Secret Key | No (Server only) |
| `GEMINI_API_KEY` | Google Gemini API Key | No (Server only) |
| `GEMINI_MODEL` | Gemini Model ID (Recommended: `gemini-2.5-flash`) | No (Server only) |

## Security notes

- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser. `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are read only in `server-only` modules.
- Protected API routes check the session (and role on owner routes) and validate input with Zod.
- Owners can read a tenant's report only through a tenancy link the tenant has shared.
- Both storage buckets are private; photos and documents are served with short-lived signed URLs.
- Row Level Security is enabled on every table.

## Limitations

- Automated comparison can be wrong. Not legal advice.
- A file hash shows a file has not changed since upload, not when it was taken.
- Email addresses are not verified in this demo.

## Deployment

- **Live URL**: [https://intact-in.vercel.app](https://intact-in.vercel.app)
- **Vercel Project**: [https://vercel.com/puttusrinivasulu29-4065/intact](https://vercel.com/puttusrinivasulu29-4065/intact)

Deployed on Vercel with automated GitHub integration and serverless environment variable encryption.

## Screenshots

*Screenshots: add here.*

## Demo Video

*Demo video link*
[https://drive.google.com/drive/folders/1p866xlBg3FUQoOqUmZ5GuYdoAn120-bI?usp=sharing]
