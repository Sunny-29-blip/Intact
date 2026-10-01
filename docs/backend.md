# Intact — Backend Architecture & Verification Document

## 1. Authentication & Roles

Intact uses **Supabase Auth** for email and password authentication, paired with a custom PostgreSQL `profiles` table that governs role-based access control.

### Roles
- **Tenant (`role: 'tenant'`)**: Creates and manages rental properties, records move-in baseline and move-out departure photographs, reviews automated visual comparison findings, disputes/accepts findings, and controls report sharing.
- **Owner (`role: 'owner'`)**: Registers owned properties, generates unique 8-character join codes for tenants, stores private property evidence documents, and views linked tenant inspection reports **only** when explicitly shared by the tenant.

### Profile Initialization & Role Immutability
- Profiles are stored in the `profiles` table (`user_id`, `role`, `display_name`, `created_at`).
- During registration via `/signup`, the user selects their role tab (*For tenants* or *For owners*).
- Profile creation is executed through `POST /api/profile` which inserts the role once. Subsequent client updates via `PATCH /api/profile` can only update the `display_name`, preventing client-side role escalation.
- If a user signs in without a pre-existing profile record, `GET /api/profile` auto-provisions a default `tenant` profile.

### Session Lifecycle & Route Protection
- **Middleware (`src/middleware.ts`)**:
  - Unauthenticated users attempting to access private routes (`/properties`, `/owner`, `/profile`, `/report`) are redirected to `/login?next=...`.
  - Authenticated sessions attempting to access `/login` or `/signup` are redirected to their respective role home (`/properties` or `/owner`).
  - Role isolation: Owners attempting to access `/properties` are redirected to `/owner`. Tenants attempting to access `/owner` are redirected to `/properties`.
  - API endpoints strictly verify role permissions server-side and return `401 Unauthorized` or `403 Forbidden` on role mismatches.

---

## 2. Database Schema & Data Models

| Table | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | `user_id` (uuid) | `auth.users(id)` | `role` ('tenant'/'owner'), `display_name` | User role and profile metadata. |
| `properties` | `id` (uuid) | `user_id -> auth.users` | `name`, `address`, `tenant_name`, `tenancy_start`, `tenancy_end`, `lease_notes`, `share_token`, `is_quick_check` | Tenant rental properties and standalone quick-check workspaces. |
| `owner_properties` | `id` (uuid) | `owner_id -> auth.users` | `name`, `address`, `city`, `owner_name`, `join_code` (unique) | Owner property records with join codes for tenant linking. |
| `tenancy_links` | `id` (uuid) | `owner_property_id -> owner_properties`, `tenant_id -> auth.users`, `tenant_property_id -> properties` | `shared` (boolean) | Bi-directional tenancy association with tenant-controlled sharing flag. |
| `documents` | `id` (uuid) | `user_id -> auth.users`, `owner_property_id -> owner_properties`, `property_id -> properties` | `kind` ('property_evidence' / 'tenancy_contract'), `storage_path`, `original_name`, `mime_type`, `size_bytes`, `sha256` | Private owner evidence files and tenant lease contracts. |
| `inspections` | `id` (uuid) | `user_id -> auth.users`, `property_id -> properties` | `kind` ('move_in' / 'move_out') | Inspection session containers. |
| `photos` | `id` (uuid) | `user_id -> auth.users`, `inspection_id -> inspections` | `area`, `storage_path`, `sha256`, `width`, `height` | Move-in baseline and move-out departure photographs. |
| `comparisons` | `id` (uuid) | `user_id -> auth.users`, `property_id -> properties`, `move_in_photo_id -> photos`, `move_out_photo_id -> photos` | `area`, `status` ('pending'/'complete'/'failed'), `error` | AI comparison job state and photo pairing per area. |
| `findings` | `id` (uuid) | `user_id -> auth.users`, `comparison_id -> comparisons` | `description`, `issue_type`, `classification`, `severity`, `confidence`, `box_ymin..xmax`, `reasoning`, `decision` ('pending'/'accepted'/'disputed'), `decision_note` | Physical differences identified between paired photos. |

---

## 3. API Surface Reference

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | Authenticated | Retrieves the current user's profile and role. |
| `POST` | `/api/profile` | Authenticated | Initializes a user's role on signup (one-time insert). |
| `PATCH` | `/api/profile` | Authenticated | Updates the user's display name. |
| `GET` | `/api/properties` | Tenant | Lists the tenant's properties (filters out `is_quick_check` by default). |
| `POST` | `/api/properties` | Tenant / Owner (Quick check) | Creates a new tenant property or quick-check workspace. |
| `GET` | `/api/properties/[id]` | Tenant | Fetches property detail with inspections, photos, and active contract. |
| `PATCH` | `/api/properties/[id]` | Tenant | Updates property metadata. |
| `DELETE` | `/api/properties/[id]` | Tenant | Deletes property and cascades storage cleanup. |
| `GET` | `/api/owner/properties` | Owner | Lists owner properties with linked tenant summaries (whitelisted fields). |
| `POST` | `/api/owner/properties` | Owner | Creates owner property with unique join code. |
| `GET` | `/api/owner/properties/[id]` | Owner | Fetches owner property details and attached documents. |
| `PATCH` | `/api/owner/properties/[id]` | Owner | Updates owner property details. |
| `DELETE` | `/api/owner/properties/[id]` | Owner | Deletes owner property and its documents. |
| `GET` | `/api/owner/reports/[linkId]` | Owner | Fetches read-only tenant condition report if `shared = true`. |
| `POST` | `/api/links` | Tenant | Links a tenant property to an owner property via join code. |
| `PATCH` | `/api/links/[id]` | Tenant | Toggles report sharing (`shared: true / false`). |
| `DELETE` | `/api/links/[id]` | Tenant | Unlinks tenant property from owner. |
| `POST` | `/api/photos` | Authenticated | Registers an uploaded photo after client storage upload. |
| `DELETE` | `/api/photos/[id]` | Authenticated | Deletes an inspection photo. |
| `GET` | `/api/comparisons` | Authenticated | Fetches user's comparisons (or filtered by `propertyId`). |
| `POST` | `/api/comparisons` | Authenticated | Triggers server-side Gemini visual comparison on paired photos. |
| `PATCH` | `/api/findings/[id]` | Authenticated | Updates finding review decision (`accepted`, `disputed`, `pending`). |
| `POST` | `/api/documents` | Authenticated | Registers an uploaded document / contract. |
| `GET` | `/api/documents/[id]/url` | Authenticated | Generates a 5-minute signed URL for a private document. |
| `DELETE` | `/api/documents/[id]` | Authenticated | Deletes document and removes object from storage. |
| `GET` | `/api/reports/[token]` | Public (Unauthenticated) | Read-only inspection report served via unguessable share token. |

---

## 4. The Two-Photo Report Pipeline

```
[Browser Client]
  1. Select Move-In Photo & Move-Out Photo
  2. Canvas resize to max 1600px JPEG
  3. Compute SHA-256 via crypto.subtle
  4. Direct upload to Supabase Storage: 'inspection-photos/{user_id}/{property_id}/{kind}/{uuid}.jpg'
  5. POST /api/photos -> Creates database record linked to inspection
  6. Click "Check for differences" -> POST /api/comparisons
        │
        ▼
[Next.js Server API: POST /api/comparisons]
  1. Authenticate user & verify property ownership
  2. Retrieve latest move-in and move-out photos for target area
  3. Create/reset comparison row with status 'pending'
  4. Download both images from private bucket
  5. Convert to Base64 buffers
  6. Invoke Google Gemini Flash via @google/genai SDK (server-side only):
     - Model: gemini-2.5-flash
     - System instructions: Objectivity, ignore lighting/perspective, classify damage/wear/unclear, assign issue_type, plain-language description
     - Mode: Structured JSON mode with Zod schema validation
     - Timeout: 45 seconds, 1x automatic retry on malformed JSON
  7. Parse & validate findings with Zod
  8. Insert findings rows into PostgreSQL database (status: 'pending')
  9. Update comparison status to 'complete' (or 'failed' with error)
 10. Generate 1-hour signed URLs for photo rendering
 11. Return ComparisonWithFindings to client
        │
        ▼
[Browser Client: /report Dashboard]
  1. Renders plain-language summary (e.g. "3 differences found: 1 damage, 1 normal wear, 1 unclear.")
  2. Displays Move-Out photo with numbered square markers linked with finding cards
  3. Displays finding cards: title, issue tag, condition label, confidence (High/Medium/Low), reasoning
  4. Tenant clicks Accept / Reject (with optional note) / Clear
  5. Triggers PATCH /api/findings/[id] -> Updates decision in database
  6. Findings and decisions persist across page refresh and logouts
```

---

## 5. Security & Access Control Boundaries

1. **Storage Isolation**:
   - `inspection-photos` and `documents` buckets are strictly **private**.
   - Storage RLS policies restrict all operations to objects prefixed with `{auth.uid()}/...`.
   - Access to photos and documents is granted exclusively via short-lived, time-limited signed URLs generated by the server after verifying database ownership.
2. **Role Boundaries**:
   - Owners cannot access tenant photos, contract files, or dispute notes unless the tenant explicitly links the property and enables `shared = true`.
   - Tenants cannot access owner evidence documents.
   - Non-owners cannot access other users' data by guessing UUIDs or paths.
3. **AI Isolation**:
   - Gemini API keys remain strictly on the server (`server-only` import).
   - Only move-in and move-out comparison photos are transmitted to Gemini.
   - Private documents (contracts, deeds, tax receipts) are **never sent to Gemini**.
