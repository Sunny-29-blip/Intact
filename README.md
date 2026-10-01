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

## Architecture

Intact uses a secure server-centric architecture. Tenant interactions (managing properties, uploading move-in/move-out photos, initiating comparisons) are executed via authenticated Next.js Server Actions and Route Handlers governed by PostgreSQL Row Level Security (RLS) policies. Photos are stored securely in a private Supabase Storage bucket with strict user-scoped access rules. When comparisons are triggered, a server-only worker fetches the matching move-in and move-out photos, calculates visual diffs using Google Gemini with structured JSON output, and persists normalized bounding-box findings. Read-only landlord reports are served via unique, unguessable share tokens accessed through privileged server clients without exposing private user accounts.

## Roles

Intact supports two distinct roles with separate dashboards and strict server-enforced boundaries:

- **Tenant (`role: 'tenant'`)**: Records move-in and move-out condition photos, reviews AI comparison findings, manages deposit dispute justifications, and controls when to share read-only inspection reports. Tenants link to owner properties using an 8-character join code without revealing private account details.
- **Owner (`role: 'owner'`)**: Registers rental properties to generate unique, unambiguous 8-character join codes (`/owner`). Owners can view linked tenant entries and access read-only inspection reports once explicitly shared by the tenant (`/report/[token]`). Owners have no direct database access to tenant photos or private tenancy records.

Database migrations for roles and tenancy links are defined in [`supabase/roles.sql`](supabase/roles.sql).

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
