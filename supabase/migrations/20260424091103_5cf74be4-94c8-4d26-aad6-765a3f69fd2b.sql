
-- =========================================================
-- 1. Drop ALL policies that reference is_linked_caregiver (so we can drop the fn)
-- =========================================================
DROP POLICY IF EXISTS profiles_own_select ON public.profiles;
DROP POLICY IF EXISTS meds_caregiver_select ON public.medications;
DROP POLICY IF EXISTS meds_caregiver_update ON public.medications;
DROP POLICY IF EXISTS logs_caregiver_select ON public.medication_logs;
DROP POLICY IF EXISTS logs_caregiver_resolve ON public.medication_logs;
DROP POLICY IF EXISTS vitals_caregiver_select ON public.vitals;
DROP POLICY IF EXISTS settings_caregiver_select ON public.patient_settings;
DROP POLICY IF EXISTS medvideos_caregiver_select ON storage.objects;
DROP POLICY IF EXISTS med_photos_caregiver_select ON storage.objects;

-- =========================================================
-- 2. Rename enum value caregiver -> supervisor
-- =========================================================
ALTER TYPE public.app_role RENAME VALUE 'caregiver' TO 'supervisor';

-- =========================================================
-- 3. Rename patients_caregivers -> patients_supervisors + column rename
-- =========================================================
DROP POLICY IF EXISTS pc_visible ON public.patients_caregivers;
DROP POLICY IF EXISTS pc_patient_unlink ON public.patients_caregivers;

ALTER TABLE public.patients_caregivers RENAME TO patients_supervisors;
ALTER TABLE public.patients_supervisors RENAME COLUMN caregiver_id TO supervisor_id;

-- Rename unique constraint if it still has the old name
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.patients_supervisors
      RENAME CONSTRAINT patients_caregivers_patient_id_caregiver_id_key
      TO patients_supervisors_patient_id_supervisor_id_key;
  EXCEPTION WHEN undefined_object THEN
    -- constraint name was different; ensure a unique constraint exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'patients_supervisors_patient_id_supervisor_id_key'
    ) THEN
      ALTER TABLE public.patients_supervisors
        ADD CONSTRAINT patients_supervisors_patient_id_supervisor_id_key
        UNIQUE (patient_id, supervisor_id);
    END IF;
  END;
END$$;

CREATE POLICY ps_visible ON public.patients_supervisors
  FOR SELECT TO authenticated
  USING ((patient_id = auth.uid()) OR (supervisor_id = auth.uid()));

CREATE POLICY ps_patient_unlink ON public.patients_supervisors
  FOR DELETE TO authenticated
  USING ((patient_id = auth.uid()) OR (supervisor_id = auth.uid()));

-- =========================================================
-- 4. Drop old fn, create new one
-- =========================================================
DROP FUNCTION IF EXISTS public.is_linked_caregiver(uuid);

CREATE OR REPLACE FUNCTION public.is_linked_supervisor(_patient_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients_supervisors
    WHERE patient_id = _patient_id AND supervisor_id = auth.uid()
  );
$$;

-- =========================================================
-- 5. Recreate every dropped policy with the new function name
-- =========================================================

-- profiles
CREATE POLICY profiles_own_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (id = auth.uid())
    OR public.is_linked_supervisor(id)
    OR EXISTS (
      SELECT 1 FROM public.patients_supervisors ps
      WHERE ps.supervisor_id = profiles.id AND ps.patient_id = auth.uid()
    )
  );

-- medications
CREATE POLICY meds_supervisor_select ON public.medications
  FOR SELECT TO authenticated USING (public.is_linked_supervisor(patient_id));
CREATE POLICY meds_supervisor_update ON public.medications
  FOR UPDATE TO authenticated
  USING (public.is_linked_supervisor(patient_id))
  WITH CHECK (public.is_linked_supervisor(patient_id));

-- medication_logs
CREATE POLICY logs_supervisor_select ON public.medication_logs
  FOR SELECT TO authenticated USING (public.is_linked_supervisor(patient_id));
CREATE POLICY logs_supervisor_resolve ON public.medication_logs
  FOR UPDATE TO authenticated
  USING (public.is_linked_supervisor(patient_id))
  WITH CHECK (public.is_linked_supervisor(patient_id));

ALTER TABLE public.medication_logs
  RENAME COLUMN resolved_by_caregiver_id TO resolved_by_supervisor_id;

-- patient_settings
CREATE POLICY settings_supervisor_select ON public.patient_settings
  FOR SELECT TO authenticated USING (public.is_linked_supervisor(patient_id));

-- vitals (full RW for supervisors)
CREATE POLICY vitals_supervisor_select ON public.vitals
  FOR SELECT TO authenticated USING (public.is_linked_supervisor(patient_id));
CREATE POLICY vitals_supervisor_insert ON public.vitals
  FOR INSERT TO authenticated WITH CHECK (public.is_linked_supervisor(patient_id));
CREATE POLICY vitals_supervisor_update ON public.vitals
  FOR UPDATE TO authenticated
  USING (public.is_linked_supervisor(patient_id))
  WITH CHECK (public.is_linked_supervisor(patient_id));
CREATE POLICY vitals_supervisor_delete ON public.vitals
  FOR DELETE TO authenticated USING (public.is_linked_supervisor(patient_id));

-- storage policies (recreate the two that we dropped)
CREATE POLICY medvideos_supervisor_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'med-videos'
    AND public.is_linked_supervisor(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY med_photos_supervisor_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'med-photos'
    AND public.is_linked_supervisor(((storage.foldername(name))[1])::uuid)
  );

-- =========================================================
-- 6. Update server-side functions for new role + new column names
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _patient UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'supervisor') THEN
    RAISE EXCEPTION 'Only supervisors can redeem invite codes';
  END IF;
  SELECT id INTO _patient FROM public.profiles WHERE invite_code = _code;
  IF _patient IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO public.patients_supervisors (patient_id, supervisor_id)
  VALUES (_patient, auth.uid())
  ON CONFLICT (patient_id, supervisor_id) DO NOTHING;
  RETURN _patient;
END;
$$;

-- handle_new_user uses the enum value name only; rename above is sufficient,
-- but we re-emit it to be explicit.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _lang public.lang_code;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _lang := COALESCE((NEW.raw_user_meta_data->>'language_pref')::public.lang_code, 'en');

  INSERT INTO public.profiles (id, full_name, phone, language_pref, invite_code)
  VALUES (
    NEW.id, _name, NEW.raw_user_meta_data->>'phone', _lang,
    CASE WHEN _role = 'patient' THEN public.generate_invite_code() ELSE NULL END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'patient' THEN
    INSERT INTO public.patient_settings (patient_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- 7. NEW: calendar_events
-- =========================================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  title TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cal_patient_all ON public.calendar_events
  FOR ALL TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY cal_supervisor_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (public.is_linked_supervisor(patient_id));

CREATE POLICY cal_supervisor_insert ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_linked_supervisor(patient_id) AND created_by = auth.uid());

CREATE POLICY cal_supervisor_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (public.is_linked_supervisor(patient_id))
  WITH CHECK (public.is_linked_supervisor(patient_id));

CREATE POLICY cal_supervisor_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (public.is_linked_supervisor(patient_id));

CREATE INDEX idx_calendar_events_patient_date
  ON public.calendar_events (patient_id, event_date);

CREATE TRIGGER calendar_events_touch
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;

-- =========================================================
-- 8. Factory reset RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.factory_reset_patient_data(_patient_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() <> _patient_id AND NOT public.is_linked_supervisor(_patient_id) THEN
    RAISE EXCEPTION 'not authorized to reset this patient';
  END IF;

  DELETE FROM public.medication_logs    WHERE patient_id = _patient_id;
  DELETE FROM public.calendar_events    WHERE patient_id = _patient_id;
  DELETE FROM public.push_subscriptions WHERE user_id    = _patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.factory_reset_patient_data(uuid) TO authenticated;
