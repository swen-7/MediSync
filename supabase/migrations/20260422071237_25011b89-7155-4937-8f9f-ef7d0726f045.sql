-- 1. Add age to profiles (patients only conceptually)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

-- 2. Add two-photo URLs to medication_logs
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS photo1_url TEXT;
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS photo2_url TEXT;

-- 3. Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_own_all" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- 4. med-photos storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('med-photos', 'med-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: file path convention = {patient_id}/{log_id}_{1|2}.jpg
CREATE POLICY "med_photos_patient_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'med-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "med_photos_patient_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'med-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "med_photos_patient_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'med-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "med_photos_caregiver_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'med-photos'
    AND public.is_linked_caregiver(((storage.foldername(name))[1])::uuid)
  );