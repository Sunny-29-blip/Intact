-- ==============================================================================
-- INTACT — Owner and Tenant Roles & Tenancy Linking Schema
-- Safe to execute on Supabase Postgres
-- ==============================================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant', 'owner')),
  display_name text,
  created_at timestamptz not null default now()
);

-- 2. OWNER PROPERTIES TABLE
create table if not exists public.owner_properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  city text,
  join_code text unique not null,
  created_at timestamptz not null default now()
);

-- 3. TENANCY LINKS TABLE
create table if not exists public.tenancy_links (
  id uuid primary key default gen_random_uuid(),
  owner_property_id uuid not null references public.owner_properties(id) on delete cascade,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  tenant_property_id uuid not null references public.properties(id) on delete cascade,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_owner_property_tenant unique (owner_property_id, tenant_id)
);

-- 4. INDEXES
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_owner_properties_owner_id on public.owner_properties(owner_id);
create index if not exists idx_owner_properties_join_code on public.owner_properties(join_code);
create index if not exists idx_tenancy_links_owner_property_id on public.tenancy_links(owner_property_id);
create index if not exists idx_tenancy_links_tenant_id on public.tenancy_links(tenant_id);
create index if not exists idx_tenancy_links_tenant_property_id on public.tenancy_links(tenant_property_id);

-- 5. ROW LEVEL SECURITY (RLS)

-- Profiles RLS
alter table public.profiles enable row level security;

create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Note: No client update policy on profiles; changes go through server routes with admin client.

-- Owner Properties RLS
alter table public.owner_properties enable row level security;

create policy "Owners can select own properties"
  on public.owner_properties
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can insert own properties"
  on public.owner_properties
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update own properties"
  on public.owner_properties
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own properties"
  on public.owner_properties
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Tenancy Links RLS
alter table public.tenancy_links enable row level security;

create policy "Tenants can select own links"
  on public.tenancy_links
  for select
  to authenticated
  using (tenant_id = auth.uid());

create policy "Tenants can insert own links"
  on public.tenancy_links
  for insert
  to authenticated
  with check (tenant_id = auth.uid());

create policy "Tenants can update own links"
  on public.tenancy_links
  for update
  to authenticated
  using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());

create policy "Tenants can delete own links"
  on public.tenancy_links
  for delete
  to authenticated
  using (tenant_id = auth.uid());

-- 6. BACKFILL EXISTING USERS AS TENANTS
insert into public.profiles (user_id, role, created_at)
select id, 'tenant', now()
from auth.users
on conflict (user_id) do nothing;
