CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.medication_logs    WHERE patient_id = _uid;
  DELETE FROM public.medications        WHERE patient_id = _uid;
  DELETE FROM public.calendar_events    WHERE patient_id = _uid;
  DELETE FROM public.vitals             WHERE patient_id = _uid;
  DELETE FROM public.patient_settings   WHERE patient_id = _uid;
  DELETE FROM public.push_subscriptions WHERE user_id    = _uid;
  DELETE FROM public.patients_supervisors WHERE patient_id = _uid OR supervisor_id = _uid;
  DELETE FROM public.user_roles         WHERE user_id    = _uid;
  DELETE FROM public.profiles           WHERE id         = _uid;
  DELETE FROM auth.users                WHERE id         = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;