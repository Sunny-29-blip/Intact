# Intact — Tenant Inspection Evidence Engine

## Problem

Tenants frequently face unfair security deposit deductions at move-out due to subjective condition assessments and disorganized photo records. **Intact** is a tenant-side move-in/move-out inspection app that pairs before-and-after area photographs, uses Google Gemini to automatically compare and classify visual changes (as property damage, normal wear-and-tear, or unclear), and compiles an indisputable, timestamped evidence report shareable with landlords via a read-only link.

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

Database migrations for roles and documents are defined in [`supabase/roles.sql`](supabase/roles.sql) and [`supabase/documents.sql`](supabase/documents.sql).

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
   - Copy and execute the contents of [`supabase/schema.sql`](supabase/schema.sql) to create all required tables, foreign keys, indexes, Row Level Security policies, and the private storage bucket.

4. **Configure Environment Variables**:
   ```bash
   cp .env.example .env.local
   ```
   Provide your Supabase URL, publishable key, service role key, and Gemini API key in `.env.local`.

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

## Deployment

- **Live URL**: [https://intact-in.vercel.app](https://intact-in.vercel.app)
- **Vercel Project**: [https://vercel.com/puttusrinivasulu29-4065/intact](https://vercel.com/puttusrinivasulu29-4065/intact)

Deployed on Vercel with automated GitHub integration and serverless environment variable encryption.

## Screenshots

*Screenshots will be captured as features are built.*

## Demo Video

*Demo video link will be added here.*
