ALTER TABLE public.medications
ADD COLUMN IF NOT EXISTS meal_timing text NOT NULL DEFAULT 'N/A';