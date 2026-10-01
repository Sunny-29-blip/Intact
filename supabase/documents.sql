-- Intact Document & Contract Uploads Schema
-- Safe to run once ("if not exists")

-- 1. Add owner_name to owner_properties if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'owner_properties' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE public.owner_properties ADD COLUMN owner_name text;
  END IF;
END $$;

-- 2. Add tenant_name to properties if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'tenant_name'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN tenant_name text;
  END IF;
END $$;

-- 3. Create documents table
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

-- 4. Enable Row Level Security on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 5. Documents RLS Policies: users can only access their own documents
DROP POLICY IF EXISTS "Users can select their own documents" ON public.documents;
CREATE POLICY "Users can select their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create Indexes on documents foreign keys and user_id
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner_property_id ON public.documents(owner_property_id);
CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_kind ON public.documents(kind);

-- 7. Create Private Storage Bucket 'documents'
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

-- 8. Storage RLS Policies for 'documents' bucket
-- Path format: {user_id}/{kind}/{parent_id}/{uuid}.{ext}
-- Restricting operations to objects whose first folder equals auth.uid()::text

DROP POLICY IF EXISTS "Users can view their own documents storage" ON storage.objects;
CREATE POLICY "Users can view their own documents storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload their own documents storage" ON storage.objects;
CREATE POLICY "Users can upload their own documents storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own documents storage" ON storage.objects;
CREATE POLICY "Users can update their own documents storage"
  ON storage.objects FOR UPDATE
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
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
