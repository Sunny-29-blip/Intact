-- ==============================================================================
-- INTACT — Tenant-Side Move-In/Move-Out Inspection App
-- Database Schema, Indexes, Row Level Security (RLS), and Storage Configuration
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. TABLES
-- ==============================================================================

-- PROPERTIES
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  tenancy_start date not null,
  tenancy_end date,
  lease_notes text,
  share_token uuid unique not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- INSPECTIONS
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('move_in', 'move_out')),
  created_at timestamptz not null default now(),
  constraint uq_property_inspection_kind unique (property_id, kind)
);

-- PHOTOS
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

-- COMPARISONS
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

-- FINDINGS
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  description text not null,
  classification text not null check (classification in ('damage', 'wear', 'unclear')),
  severity text not null check (severity in ('minor', 'moderate', 'major')),
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

-- ==============================================================================
-- 3. INDEXES
-- ==============================================================================

-- User ID indexes (Multi-tenant fast filtering)
create index if not exists idx_properties_user_id on public.properties(user_id);
create index if not exists idx_inspections_user_id on public.inspections(user_id);
create index if not exists idx_photos_user_id on public.photos(user_id);
create index if not exists idx_comparisons_user_id on public.comparisons(user_id);
create index if not exists idx_findings_user_id on public.findings(user_id);

-- Foreign key indexes
create index if not exists idx_inspections_property_id on public.inspections(property_id);
create index if not exists idx_photos_inspection_id on public.photos(inspection_id);
create index if not exists idx_comparisons_property_id on public.comparisons(property_id);
create index if not exists idx_comparisons_move_in_photo_id on public.comparisons(move_in_photo_id);
create index if not exists idx_comparisons_move_out_photo_id on public.comparisons(move_out_photo_id);
create index if not exists idx_findings_comparison_id on public.findings(comparison_id);

-- Share token lookup index
create index if not exists idx_properties_share_token on public.properties(share_token);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.properties enable row level security;
alter table public.inspections enable row level security;
alter table public.photos enable row level security;
alter table public.comparisons enable row level security;
alter table public.findings enable row level security;

-- PROPERTIES POLICIES
create policy "Users can manage own properties"
  on public.properties
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSPECTIONS POLICIES
create policy "Users can manage own inspections"
  on public.inspections
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- PHOTOS POLICIES
create policy "Users can manage own photos"
  on public.photos
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- COMPARISONS POLICIES
create policy "Users can manage own comparisons"
  on public.comparisons
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- FINDINGS POLICIES
create policy "Users can manage own findings"
  on public.findings
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ==============================================================================
-- 5. STORAGE BUCKET & STORAGE RLS POLICIES
-- ==============================================================================

-- Create private bucket for inspection photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-photos',
  'inspection-photos',
  false,
  20971520, -- 20MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Storage RLS: Authenticated users can upload to their own user_id folder: {user_id}/{property_id}/{inspection_kind}/{uuid}.jpg
create policy "Authenticated users can upload inspection photos to own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'inspection-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Authenticated users can read their own inspection photos
create policy "Authenticated users can read own inspection photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'inspection-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Authenticated users can delete their own inspection photos
create policy "Authenticated users can delete own inspection photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'inspection-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
