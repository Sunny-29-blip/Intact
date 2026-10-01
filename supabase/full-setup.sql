-- ==============================================================================
-- INTACT — Complete Database Schema, RLS Policies, & Storage Configuration
-- Safe to execute on a fresh Supabase project or existing database (idempotent)
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. TABLES
-- ==============================================================================

-- PROFILES (Role and user metadata)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant', 'owner')),
  display_name text,
  phone text,
  address_line text,
  city text,
  state text,
  pincode text,
  created_at timestamptz not null default now()
);

-- PROPERTIES (Tenant property records)
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_name text,
  name text not null,
  address text,
  tenancy_start date not null,
  tenancy_end date,
  lease_notes text,
  share_token uuid unique not null default gen_random_uuid(),
  is_quick_check boolean not null default false,
  created_at timestamptz not null default now()
);

-- OWNER PROPERTIES (Properties managed by landlords/owners)
create table if not exists public.owner_properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  city text,
  owner_name text,
  join_code text unique not null,
  created_at timestamptz not null default now()
);

-- TENANCY LINKS (Links tenant properties to owner properties)
create table if not exists public.tenancy_links (
  id uuid primary key default gen_random_uuid(),
  owner_property_id uuid not null references public.owner_properties(id) on delete cascade,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  tenant_property_id uuid not null references public.properties(id) on delete cascade,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_owner_property_tenant unique (owner_property_id, tenant_id)
);

-- INSPECTIONS (Move-in baseline and move-out containers)
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('move_in', 'move_out')),
  created_at timestamptz not null default now(),
  constraint uq_property_inspection_kind unique (property_id, kind)
);

-- PHOTOS (Condition photos for areas within inspections)
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  area text not null,
  storage_path text not null,
  sha256 text not null,
  width int,
  height int,
  created_at timestamptz not null default now()
);

-- COMPARISONS (Two-photo analysis records per area)
create table if not exists public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  area text not null,
  move_in_photo_id uuid references public.photos(id) on delete set null,
  move_out_photo_id uuid references public.photos(id) on delete set null,
  status text not null check (status in ('pending', 'complete', 'failed')) default 'pending',
  error text,
  created_at timestamptz not null default now()
);

-- FINDINGS (AI difference findings with bounding boxes and tenant decisions)
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  description text not null,
  classification text not null check (classification in ('damage', 'wear', 'unclear')),
  severity text not null check (severity in ('minor', 'moderate', 'major')),
  issue_type text default 'other',
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  box_ymin int check (box_ymin >= 0 and box_ymin <= 1000),
  box_xmin int check (box_xmin >= 0 and box_xmin <= 1000),
  box_ymax int check (box_ymax >= 0 and box_ymax <= 1000),
  box_xmax int check (box_xmax >= 0 and box_xmax <= 1000),
  reasoning text,
  decision text not null check (decision in ('pending', 'accepted', 'disputed')) default 'pending',
  decision_note text,
  created_at timestamptz not null default now()
);

-- DOCUMENTS (Contracts and owner evidence documents)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('property_evidence', 'tenancy_contract')),
  owner_property_id uuid references public.owner_properties(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  sha256 text,
  created_at timestamptz not null default now(),
  constraint chk_document_parent check (
    (kind = 'property_evidence' and owner_property_id is not null and property_id is null) or
    (kind = 'tenancy_contract' and property_id is not null and owner_property_id is null)
  )
);

-- WATCH EVENTS (Audit trail of report token views)
create table if not exists public.watch_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  viewer_ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 3. INDEXES
-- ==============================================================================

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_properties_user_id on public.properties(user_id);
create index if not exists idx_properties_share_token on public.properties(share_token);
create index if not exists idx_properties_is_quick_check on public.properties(is_quick_check);
create index if not exists idx_owner_properties_owner_id on public.owner_properties(owner_id);
create index if not exists idx_owner_properties_join_code on public.owner_properties(join_code);
create index if not exists idx_tenancy_links_owner_property_id on public.tenancy_links(owner_property_id);
create index if not exists idx_tenancy_links_tenant_id on public.tenancy_links(tenant_id);
create index if not exists idx_tenancy_links_tenant_property_id on public.tenancy_links(tenant_property_id);
create index if not exists idx_inspections_user_id on public.inspections(user_id);
create index if not exists idx_inspections_property_id on public.inspections(property_id);
create index if not exists idx_photos_user_id on public.photos(user_id);
create index if not exists idx_photos_inspection_id on public.photos(inspection_id);
create index if not exists idx_comparisons_user_id on public.comparisons(user_id);
create index if not exists idx_comparisons_property_id on public.comparisons(property_id);
create index if not exists idx_findings_user_id on public.findings(user_id);
create index if not exists idx_findings_comparison_id on public.findings(comparison_id);
create index if not exists idx_findings_issue_type on public.findings(issue_type);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_documents_owner_property_id on public.documents(owner_property_id);
create index if not exists idx_documents_property_id on public.documents(property_id);
create index if not exists idx_documents_kind on public.documents(kind);
create index if not exists idx_watch_events_property_id on public.watch_events(property_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.owner_properties enable row level security;
alter table public.tenancy_links enable row level security;
alter table public.inspections enable row level security;
alter table public.photos enable row level security;
alter table public.comparisons enable row level security;
alter table public.findings enable row level security;
alter table public.documents enable row level security;
alter table public.watch_events enable row level security;

-- Profiles RLS
drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile" on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (user_id = auth.uid());

-- Properties RLS
drop policy if exists "Users can select own properties" on public.properties;
create policy "Users can select own properties" on public.properties for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own properties" on public.properties;
create policy "Users can insert own properties" on public.properties for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own properties" on public.properties;
create policy "Users can update own properties" on public.properties for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own properties" on public.properties;
create policy "Users can delete own properties" on public.properties for delete to authenticated using (auth.uid() = user_id);

-- Owner Properties RLS
drop policy if exists "Owners can select own properties" on public.owner_properties;
create policy "Owners can select own properties" on public.owner_properties for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Owners can insert own properties" on public.owner_properties;
create policy "Owners can insert own properties" on public.owner_properties for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Owners can update own properties" on public.owner_properties;
create policy "Owners can update own properties" on public.owner_properties for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owners can delete own properties" on public.owner_properties;
create policy "Owners can delete own properties" on public.owner_properties for delete to authenticated using (owner_id = auth.uid());

-- Tenancy Links RLS
drop policy if exists "Tenants can select own links" on public.tenancy_links;
create policy "Tenants can select own links" on public.tenancy_links for select to authenticated using (tenant_id = auth.uid());
drop policy if exists "Tenants can insert own links" on public.tenancy_links;
create policy "Tenants can insert own links" on public.tenancy_links for insert to authenticated with check (tenant_id = auth.uid());
drop policy if exists "Tenants can update own links" on public.tenancy_links;
create policy "Tenants can update own links" on public.tenancy_links for update to authenticated using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
drop policy if exists "Tenants can delete own links" on public.tenancy_links;
create policy "Tenants can delete own links" on public.tenancy_links for delete to authenticated using (tenant_id = auth.uid());

-- Inspections RLS
drop policy if exists "Users can select own inspections" on public.inspections;
create policy "Users can select own inspections" on public.inspections for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own inspections" on public.inspections;
create policy "Users can insert own inspections" on public.inspections for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own inspections" on public.inspections;
create policy "Users can delete own inspections" on public.inspections for delete to authenticated using (auth.uid() = user_id);

-- Photos RLS
drop policy if exists "Users can select own photos" on public.photos;
create policy "Users can select own photos" on public.photos for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own photos" on public.photos;
create policy "Users can insert own photos" on public.photos for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own photos" on public.photos;
create policy "Users can delete own photos" on public.photos for delete to authenticated using (auth.uid() = user_id);

-- Comparisons RLS
drop policy if exists "Users can select own comparisons" on public.comparisons;
create policy "Users can select own comparisons" on public.comparisons for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own comparisons" on public.comparisons;
create policy "Users can insert own comparisons" on public.comparisons for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own comparisons" on public.comparisons;
create policy "Users can update own comparisons" on public.comparisons for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own comparisons" on public.comparisons;
create policy "Users can delete own comparisons" on public.comparisons for delete to authenticated using (auth.uid() = user_id);

-- Findings RLS
drop policy if exists "Users can select own findings" on public.findings;
create policy "Users can select own findings" on public.findings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own findings" on public.findings;
create policy "Users can insert own findings" on public.findings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own findings" on public.findings;
create policy "Users can update own findings" on public.findings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own findings" on public.findings;
create policy "Users can delete own findings" on public.findings for delete to authenticated using (auth.uid() = user_id);

-- Documents RLS
drop policy if exists "Users can select own documents" on public.documents;
create policy "Users can select own documents" on public.documents for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents" on public.documents for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents" on public.documents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents" on public.documents for delete to authenticated using (auth.uid() = user_id);

-- Watch Events RLS
drop policy if exists "Users can insert watch events" on public.watch_events;
create policy "Users can insert watch events" on public.watch_events for insert to anon, authenticated with check (true);
drop policy if exists "Property owners can view watch events" on public.watch_events;
create policy "Property owners can view watch events" on public.watch_events for select to authenticated using (
  exists (select 1 from public.properties where properties.id = watch_events.property_id and properties.user_id = auth.uid())
);

-- ==============================================================================
-- 5. STORAGE BUCKETS & POLICIES
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-photos',
  'inspection-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: inspection-photos
drop policy if exists "Users can view their own photos storage" on storage.objects;
create policy "Users can view their own photos storage" on storage.objects for select to authenticated using (
  bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users can upload their own photos storage" on storage.objects;
create policy "Users can upload their own photos storage" on storage.objects for insert to authenticated with check (
  bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users can delete their own photos storage" on storage.objects;
create policy "Users can delete their own photos storage" on storage.objects for delete to authenticated using (
  bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: documents
drop policy if exists "Users can view their own documents storage" on storage.objects;
create policy "Users can view their own documents storage" on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users can upload their own documents storage" on storage.objects;
create policy "Users can upload their own documents storage" on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users can update their own documents storage" on storage.objects;
create policy "Users can update their own documents storage" on storage.objects for update to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users can delete their own documents storage" on storage.objects;
create policy "Users can delete their own documents storage" on storage.objects for delete to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
