ALTER TABLE public.vitals
ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.vitals;