-- ============================================================
-- PING — Phase A: Auth, Profiles, Roles, Linking, Domain tables
-- ============================================================

-- 1. ENUMS ---------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('caregiver', 'patient');
CREATE TYPE public.lang_code AS ENUM ('en', 'ms', 'zh');
CREATE TYPE public.log_status AS ENUM ('confirmed', 'missed', 'pending');

-- 2. PROFILES ------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  language_pref public.lang_code NOT NULL DEFAULT 'en',
  invite_code TEXT UNIQUE,                    -- only populated for patients
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER_ROLES (separate table — never on profiles) ---------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. PATIENTS <-> CAREGIVERS link ----------------------------
CREATE TABLE public.patients_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, caregiver_id)
);

ALTER TABLE public.patients_caregivers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pc_caregiver ON public.patients_caregivers(caregiver_id);
CREATE INDEX idx_pc_patient   ON public.patients_caregivers(patient_id);

-- 5. MEDICATIONS ---------------------------------------------
CREATE TABLE public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  med_name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'Once daily',
  scheduled_time TIME NOT NULL DEFAULT '08:00',
  custom_days INT[] NOT NULL DEFAULT '{}',
  total_qty INT NOT NULL DEFAULT 30,
  remaining_qty INT NOT NULL DEFAULT 30,
  refill_reminder_days INT NOT NULL DEFAULT 7,
  picture_url TEXT,
  unit TEXT NOT NULL DEFAULT 'pills',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_med_patient ON public.medications(patient_id);

-- 6. MEDICATION LOGS -----------------------------------------
CREATE TABLE public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  status public.log_status NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  video_url TEXT,
  resolved_by_caregiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_log_patient_due ON public.medication_logs(patient_id, due_at DESC);
CREATE INDEX idx_log_status ON public.medication_logs(status);

-- 7. VITALS --------------------------------------------------
CREATE TABLE public.vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_pressure_sys INT NOT NULL,
  blood_pressure_dia INT NOT NULL,
  pulse INT,
  note TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bp_sys_range CHECK (blood_pressure_sys BETWEEN 60 AND 260),
  CONSTRAINT bp_dia_range CHECK (blood_pressure_dia BETWEEN 30 AND 180)
);

ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vitals_patient_time ON public.vitals(patient_id, taken_at DESC);

-- 8. PATIENT SETTINGS ----------------------------------------
CREATE TABLE public.patient_settings (
  patient_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  affirmation_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  caregiver_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. SECURITY DEFINER HELPERS (no RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_linked_caregiver(_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients_caregivers
    WHERE patient_id = _patient_id
      AND caregiver_id = auth.uid()
  );
$$;

-- 10. INVITE CODE generator ----------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := lpad(floor(random() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique invite code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- Patient redeems-by-code: caregiver passes a code, we link.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _patient UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'caregiver') THEN
    RAISE EXCEPTION 'Only caregivers can redeem invite codes';
  END IF;

  SELECT id INTO _patient FROM public.profiles WHERE invite_code = _code;
  IF _patient IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.patients_caregivers (patient_id, caregiver_id)
  VALUES (_patient, auth.uid())
  ON CONFLICT (patient_id, caregiver_id) DO NOTHING;

  RETURN _patient;
END;
$$;

-- 11. NEW USER trigger: profile + settings + invite code -----
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _lang public.lang_code;
BEGIN
  -- role from signup metadata, default to 'patient'
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _lang := COALESCE((NEW.raw_user_meta_data->>'language_pref')::public.lang_code, 'en');

  INSERT INTO public.profiles (id, full_name, phone, language_pref, invite_code)
  VALUES (
    NEW.id,
    _name,
    NEW.raw_user_meta_data->>'phone',
    _lang,
    CASE WHEN _role = 'patient' THEN public.generate_invite_code() ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  IF _role = 'patient' THEN
    INSERT INTO public.patient_settings (patient_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. updated_at maintenance ---------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_meds_touch BEFORE UPDATE ON public.medications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_logs_touch BEFORE UPDATE ON public.medication_logs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_settings_touch BEFORE UPDATE ON public.patient_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 13. RLS POLICIES
-- ============================================================

-- profiles: own + linked patients (caregiver) + linked caregivers (patient)
CREATE POLICY profiles_own_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_linked_caregiver(id)                         -- caregiver -> patient profile
  OR EXISTS (                                                -- patient -> caregiver profile
    SELECT 1 FROM public.patients_caregivers
    WHERE caregiver_id = profiles.id AND patient_id = auth.uid()
  )
);
CREATE POLICY profiles_own_update ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles: own only (read). Insert is done by the trigger.
CREATE POLICY user_roles_own_select ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- patients_caregivers: visible to either side; insert via redeem fn only.
CREATE POLICY pc_visible ON public.patients_caregivers
FOR SELECT TO authenticated
USING (patient_id = auth.uid() OR caregiver_id = auth.uid());

CREATE POLICY pc_patient_unlink ON public.patients_caregivers
FOR DELETE TO authenticated USING (patient_id = auth.uid() OR caregiver_id = auth.uid());

-- medications: patient owns, linked caregiver can read & update remaining_qty etc.
CREATE POLICY meds_patient_all ON public.medications
FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY meds_caregiver_select ON public.medications
FOR SELECT TO authenticated
USING (public.is_linked_caregiver(patient_id));

CREATE POLICY meds_caregiver_update ON public.medications
FOR UPDATE TO authenticated
USING (public.is_linked_caregiver(patient_id))
WITH CHECK (public.is_linked_caregiver(patient_id));

-- medication_logs: patient full; linked caregiver select + update (resolve)
CREATE POLICY logs_patient_all ON public.medication_logs
FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY logs_caregiver_select ON public.medication_logs
FOR SELECT TO authenticated
USING (public.is_linked_caregiver(patient_id));

CREATE POLICY logs_caregiver_resolve ON public.medication_logs
FOR UPDATE TO authenticated
USING (public.is_linked_caregiver(patient_id))
WITH CHECK (public.is_linked_caregiver(patient_id));

-- vitals: patient writes; both sides read
CREATE POLICY vitals_patient_all ON public.vitals
FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY vitals_caregiver_select ON public.vitals
FOR SELECT TO authenticated
USING (public.is_linked_caregiver(patient_id));

-- patient_settings: patient only
CREATE POLICY settings_patient_all ON public.patient_settings
FOR ALL TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY settings_caregiver_select ON public.patient_settings
FOR SELECT TO authenticated
USING (public.is_linked_caregiver(patient_id));

-- ============================================================
-- 14. STORAGE BUCKET for med confirmation videos (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('med-videos', 'med-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Patient can upload/read/delete files under their own {uid}/...
CREATE POLICY medvideos_patient_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'med-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY medvideos_patient_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'med-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY medvideos_patient_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'med-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Linked caregivers can read patient videos (folder = patient uid)
CREATE POLICY medvideos_caregiver_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'med-videos'
  AND public.is_linked_caregiver(((storage.foldername(name))[1])::uuid)
);
