-- ============================================================================
-- Acedex — atomic profile update RPC (migration 004)
-- ============================================================================
-- Depends on 001_initial_schema.sql.
--
-- Replaces a two-call client pattern (UPDATE profiles, then UPDATE
-- <role>_profiles) with a single SECURITY DEFINER PLpgSQL function that runs
-- both updates in one transaction. If the extension update fails, the
-- profile update rolls back automatically.
--
-- Also enforces server-side that homepage_url, when present, uses http or
-- https — defense-in-depth against a malicious client that might bypass
-- the form's client-side check.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_profile_atomic(
  _profile_data jsonb,
  _ext_data     jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid   uuid := auth.uid();
  _role  user_role;
  _href  text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated' USING ERRCODE = '42501';
  END IF;

  IF _profile_data IS NULL THEN _profile_data := '{}'::jsonb; END IF;
  IF _ext_data     IS NULL THEN _ext_data     := '{}'::jsonb; END IF;

  -- Defense-in-depth: reject non-http(s) homepage_url even if a malicious
  -- client tampered with the form-level check.
  IF _ext_data ? 'homepage_url' THEN
    _href := NULLIF(_ext_data->>'homepage_url', '');
    IF _href IS NOT NULL AND _href !~* '^https?://' THEN
      RAISE EXCEPTION 'Only http/https URLs allowed' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ── profiles row ──────────────────────────────────────────────────────
  -- Only touch keys present in the payload. NULLIF turns empty strings into
  -- NULL so the optional fields can be cleared.
  UPDATE profiles SET
    full_name     = COALESCE(NULLIF(_profile_data->>'full_name', ''), full_name),
    avatar_url    = CASE WHEN _profile_data ? 'avatar_url'
                         THEN NULLIF(_profile_data->>'avatar_url', '') ELSE avatar_url END,
    university_id = COALESCE((_profile_data->>'university_id')::uuid, university_id),
    bio           = CASE WHEN _profile_data ? 'bio'
                         THEN NULLIF(_profile_data->>'bio', '') ELSE bio END
  WHERE id = _uid
  RETURNING role INTO _role;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = '02000';
  END IF;

  -- ── extension row ─────────────────────────────────────────────────────
  IF _role = 'student' THEN
    UPDATE student_profiles SET
      major     = CASE WHEN _ext_data ? 'major'
                       THEN NULLIF(_ext_data->>'major', '') ELSE major END,
      year      = CASE WHEN _ext_data ? 'year'
                       THEN NULLIF(_ext_data->>'year', '')::academic_year ELSE year END,
      interests = CASE WHEN _ext_data ? 'interests'
                       THEN COALESCE(
                              ARRAY(SELECT jsonb_array_elements_text(_ext_data->'interests')),
                              '{}'::text[])
                       ELSE interests END
    WHERE profile_id = _uid;

  ELSIF _role = 'professor' THEN
    UPDATE professor_profiles SET
      title           = CASE WHEN _ext_data ? 'title'
                             THEN NULLIF(_ext_data->>'title', '')::professor_title ELSE title END,
      department      = COALESCE(NULLIF(_ext_data->>'department', ''), department),
      research_areas  = CASE WHEN _ext_data ? 'research_areas'
                             THEN COALESCE(
                                    ARRAY(SELECT jsonb_array_elements_text(_ext_data->'research_areas')),
                                    '{}'::text[])
                             ELSE research_areas END,
      office_location = CASE WHEN _ext_data ? 'office_location'
                             THEN NULLIF(_ext_data->>'office_location', '') ELSE office_location END,
      office_hours    = CASE WHEN _ext_data ? 'office_hours'
                             THEN NULLIF(_ext_data->>'office_hours', '') ELSE office_hours END,
      homepage_url    = CASE WHEN _ext_data ? 'homepage_url'
                             THEN NULLIF(_ext_data->>'homepage_url', '') ELSE homepage_url END
    WHERE profile_id = _uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_atomic(jsonb, jsonb) TO authenticated;
