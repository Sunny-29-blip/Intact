-- ==============================================================================
-- INTACT — Fix Properties, Roles, Documents & Report Database Migration
-- Safe to run multiple times (idempotent)
-- ==============================================================================

-- 1. ADD MISSING COLUMNS TO PROPERTIES TABLE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'tenant_name'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN tenant_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'is_quick_check'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN is_quick_check boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_is_quick_check ON public.properties(is_quick_check);

-- 2. CREATE PROFILES TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('tenant', 'owner')),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
CREATE POLICY "Users can select own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. CREATE OWNER PROPERTIES TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.owner_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  owner_name text,
  join_code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'owner_properties' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE public.owner_properties ADD COLUMN owner_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_owner_properties_owner_id ON public.owner_properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_properties_join_code ON public.owner_properties(join_code);

ALTER TABLE public.owner_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can select own properties" ON public.owner_properties;
CREATE POLICY "Owners can select own properties"
  ON public.owner_properties FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert own properties" ON public.owner_properties;
CREATE POLICY "Owners can insert own properties"
  ON public.owner_properties FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update own properties" ON public.owner_properties;
CREATE POLICY "Owners can update own properties"
  ON public.owner_properties FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete own properties" ON public.owner_properties;
CREATE POLICY "Owners can delete own properties"
  ON public.owner_properties FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 4. CREATE TENANCY LINKS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.tenancy_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_property_id uuid NOT NULL REFERENCES public.owner_properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_owner_property_tenant UNIQUE (owner_property_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenancy_links_owner_property_id ON public.tenancy_links(owner_property_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_links_tenant_id ON public.tenancy_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_links_tenant_property_id ON public.tenancy_links(tenant_property_id);

ALTER TABLE public.tenancy_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can select own links" ON public.tenancy_links;
CREATE POLICY "Tenants can select own links"
  ON public.tenancy_links FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can insert own links" ON public.tenancy_links;
CREATE POLICY "Tenants can insert own links"
  ON public.tenancy_links FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can update own links" ON public.tenancy_links;
CREATE POLICY "Tenants can update own links"
  ON public.tenancy_links FOR UPDATE
  TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can delete own links" ON public.tenancy_links;
CREATE POLICY "Tenants can delete own links"
  ON public.tenancy_links FOR DELETE
  TO authenticated
  USING (tenant_id = auth.uid());

-- 5. CREATE DOCUMENTS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('property_evidence', 'tenancy_contract')),
  owner_property_id uuid REFERENCES public.owner_properties(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_document_parent CHECK (
    (kind = 'property_evidence' AND owner_property_id IS NOT NULL AND property_id IS NULL) OR
    (kind = 'tenancy_contract' AND property_id IS NOT NULL AND owner_property_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner_property_id ON public.documents(owner_property_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_kind ON public.documents(kind);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own documents" ON public.documents;
CREATE POLICY "Users can select their own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. ADD ISSUE_TYPE TO FINDINGS TABLE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'findings' AND column_name = 'issue_type'
  ) THEN
    ALTER TABLE public.findings ADD COLUMN issue_type text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_findings_issue_type ON public.findings(issue_type);

-- 7. CREATE STORAGE BUCKET 'documents'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 8. STORAGE RLS POLICIES FOR 'documents' BUCKET
DROP POLICY IF EXISTS "Users can view their own documents storage" ON storage.objects;
CREATE POLICY "Users can view their own documents storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload their own documents storage" ON storage.objects;
CREATE POLICY "Users can upload their own documents storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own documents storage" ON storage.objects;
CREATE POLICY "Users can update their own documents storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own documents storage" ON storage.objects;
CREATE POLICY "Users can delete their own documents storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 9. BACKFILL PROFILES FOR EXISTING USERS
INSERT INTO public.profiles (user_id, role, created_at)
SELECT id, 'tenant', now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
