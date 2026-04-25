
-- 1. Medications RLS: split per-action with role-aware checks
DROP POLICY IF EXISTS meds_patient_all       ON public.medications;
DROP POLICY IF EXISTS meds_supervisor_select ON public.medications;
DROP POLICY IF EXISTS meds_supervisor_update ON public.medications;

CREATE POLICY meds_select ON public.medications FOR SELECT TO authenticated
USING (
  patient_id = auth.uid()
  OR public.is_linked_supervisor(patient_id)
);

CREATE POLICY meds_insert ON public.medications FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'patient')    AND patient_id = auth.uid())
  OR (public.has_role(auth.uid(), 'supervisor') AND public.is_linked_supervisor(patient_id))
);

CREATE POLICY meds_update ON public.medications FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'patient')    AND patient_id = auth.uid())
  OR (public.has_role(auth.uid(), 'supervisor') AND public.is_linked_supervisor(patient_id))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'patient')    AND patient_id = auth.uid())
  OR (public.has_role(auth.uid(), 'supervisor') AND public.is_linked_supervisor(patient_id))
);

CREATE POLICY meds_delete ON public.medications FOR DELETE TO authenticated
USING (
  (public.has_role(auth.uid(), 'patient')    AND patient_id = auth.uid())
  OR (public.has_role(auth.uid(), 'supervisor') AND public.is_linked_supervisor(patient_id))
);

-- 2. Profiles: supervisors can update linked patients' profiles (e.g. age)
DROP POLICY IF EXISTS profiles_supervisor_update ON public.profiles;
CREATE POLICY profiles_supervisor_update ON public.profiles FOR UPDATE TO authenticated
USING (public.is_linked_supervisor(id))
WITH CHECK (public.is_linked_supervisor(id));

-- 3. Add missed-alert tracking column (idempotent)
ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS missed_alert_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS medication_logs_due_status_idx
  ON public.medication_logs (status, due_at);
