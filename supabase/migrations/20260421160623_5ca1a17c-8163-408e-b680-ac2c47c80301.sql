-- Part 4: Add blood_glucose to vitals
ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS blood_glucose numeric(4,1);

-- Make blood pressure nullable so users can log just glucose
ALTER TABLE public.vitals
  ALTER COLUMN blood_pressure_sys DROP NOT NULL,
  ALTER COLUMN blood_pressure_dia DROP NOT NULL;

-- Part 6: Streak columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- Part 1: Enforce one role per user (drop dup rows first if any, then unique)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END$$;