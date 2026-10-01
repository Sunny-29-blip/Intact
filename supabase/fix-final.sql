-- Intact: final schema alignment. Safe to run more than once.
-- Adds columns the app expects that are not created by the other SQL files.

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tenant_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS landlord_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deposit_amount numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_quick_check boolean NOT NULL DEFAULT false;

ALTER TABLE public.findings ADD COLUMN IF NOT EXISTS issue_type text;

ALTER TABLE public.owner_properties ADD COLUMN IF NOT EXISTS owner_name text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_line text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pincode text;

-- Users may update their own profile row (role changes are not exposed by the API).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Keep both buckets private.
UPDATE storage.buckets SET public = false WHERE id IN ('inspection-photos', 'documents');
