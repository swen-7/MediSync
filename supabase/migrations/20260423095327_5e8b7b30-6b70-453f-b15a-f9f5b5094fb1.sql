-- 1. Recreate the trigger that calls handle_new_user on every new auth user.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: profile rows for any auth user missing one.
INSERT INTO public.profiles (id, full_name, phone, language_pref, invite_code)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'User'),
  u.raw_user_meta_data->>'phone',
  COALESCE((u.raw_user_meta_data->>'language_pref')::public.lang_code, 'en'),
  CASE
    WHEN COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'patient') = 'patient'
    THEN public.generate_invite_code()
    ELSE NULL
  END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. Backfill: role rows for any auth user missing one (default to patient).
INSERT INTO public.user_roles (user_id, role)
SELECT
  u.id,
  COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'patient')
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;

-- 4. Backfill: patient_settings for any patient-role user missing one.
INSERT INTO public.patient_settings (patient_id)
SELECT r.user_id
FROM public.user_roles r
LEFT JOIN public.patient_settings s ON s.patient_id = r.user_id
WHERE r.role = 'patient' AND s.patient_id IS NULL;

-- 5. Self-heal RPC: callable by the signed-in user to ensure their own
--    profile + role exist. Used by the client right after login as a safety net.
CREATE OR REPLACE FUNCTION public.ensure_my_profile(_role public.app_role DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _u record;
  _final_role public.app_role;
  _existing_role public.app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id, email, raw_user_meta_data INTO _u FROM auth.users WHERE id = _uid;
  IF _u.id IS NULL THEN
    RAISE EXCEPTION 'auth user not found';
  END IF;

  SELECT role INTO _existing_role FROM public.user_roles WHERE user_id = _uid LIMIT 1;

  IF _existing_role IS NOT NULL THEN
    _final_role := _existing_role;
  ELSE
    _final_role := COALESCE(
      _role,
      (_u.raw_user_meta_data->>'role')::public.app_role,
      'patient'
    );
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _final_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, language_pref, invite_code)
  VALUES (
    _uid,
    COALESCE(_u.raw_user_meta_data->>'full_name', split_part(_u.email, '@', 1), 'User'),
    _u.raw_user_meta_data->>'phone',
    COALESCE((_u.raw_user_meta_data->>'language_pref')::public.lang_code, 'en'),
    CASE WHEN _final_role = 'patient' THEN public.generate_invite_code() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF _final_role = 'patient' THEN
    INSERT INTO public.patient_settings (patient_id) VALUES (_uid)
    ON CONFLICT (patient_id) DO NOTHING;
  END IF;

  RETURN _final_role;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_my_profile(public.app_role) TO authenticated;