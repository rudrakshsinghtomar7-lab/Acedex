-- ============================================================================
-- Acedex — auth trigger + storage buckets (migration 002)
-- ============================================================================
-- Depends on 001_initial_schema.sql.
--
-- Two sections:
--   A. Auto-create profiles row when a user signs up (auth.users → profiles).
--   B. Storage buckets + storage.objects RLS that mirrors metadata-table RLS.
--
-- Storage convention: <metadata_table>.storage_path stores the bucket-relative
-- path (identical to storage.objects.name). One row per object. Client flow:
--   1) INSERT metadata row (RLS-checked)
--   2) Upload to storage at the row's storage_path (RLS-checked via helper)
--   3) On upload failure, DELETE the orphan metadata row.
-- ============================================================================


-- ── A.1 default university (fallback for unmatched email domains) ──────────
-- Trigger assigns new users here if their email domain doesn't match any
-- real universities.domain. The domain '__default__' won't match any real
-- split_part(email,'@',2), so the fallback is the only way in.

INSERT INTO universities (id, name, slug, domain, status)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Default (Unassigned)',
  'default',
  '__default__',
  'active'
)
ON CONFLICT (id) DO NOTHING;


-- ── A.2 auth → profile trigger ─────────────────────────────────────────────
-- Fires AFTER INSERT ON auth.users. SECURITY DEFINER so it can write into
-- public.profiles (and the role-specific extension table) without RLS.
--
-- Metadata source: NEW.raw_user_meta_data (set by signUp's options.data).
--   full_name : meta.full_name || meta.name || email local-part
--   role      : meta.role (must cast cleanly to user_role) || 'student'
--
-- Role policy: trusts metadata so dev can create professor/admin accounts
-- via signUp options.data.role. Lock this down before production by
-- restricting to 'student' here and promoting via admin panel.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _meta      jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  _email     text  := NEW.email;
  _domain    text  := split_part(NEW.email, '@', 2);
  _full_name text  := COALESCE(
                        NULLIF(_meta->>'full_name',''),
                        NULLIF(_meta->>'name',''),
                        split_part(NEW.email, '@', 1)
                      );
  _role_text text  := COALESCE(NULLIF(_meta->>'role',''), 'student');
  _role      user_role;
  _univ_id   uuid;
BEGIN
  -- role: trust metadata, default 'student'. Bad values fall back to student
  -- rather than failing signup (would lock people out for a typo).
  BEGIN
    _role := _role_text::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    _role := 'student';
  END;

  -- university: domain match, else default
  SELECT id INTO _univ_id FROM universities WHERE domain = _domain;
  IF _univ_id IS NULL THEN
    _univ_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  INSERT INTO profiles (id, university_id, role, email, full_name)
  VALUES (NEW.id, _univ_id, _role, _email, _full_name);

  IF _role = 'student' THEN
    INSERT INTO student_profiles (profile_id) VALUES (NEW.id);
  ELSIF _role = 'professor' THEN
    -- department is NOT NULL with no default; placeholder until onboarding.
    INSERT INTO professor_profiles (profile_id, department) VALUES (NEW.id, 'TBD');
  END IF;
  -- admin: no extension table

  INSERT INTO notification_preferences (profile_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ============================================================================
-- B. STORAGE BUCKETS + RLS
-- ============================================================================

-- ── B.1 buckets ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('pdfs',        'pdfs',        false),
  ('submissions', 'submissions', false),
  ('avatars',     'avatars',     false),
  ('resources',   'resources',   false)
ON CONFLICT (id) DO NOTHING;


-- ── B.2 SECURITY DEFINER helpers (bypass RLS on metadata tables) ───────────
-- Storage policies look up the metadata row via storage_path and delegate
-- the access decision to logic that mirrors the metadata-table RLS. Helpers
-- are SECURITY DEFINER so they can read metadata regardless of the caller's
-- per-table RLS — the access decision is encoded *inside* the helper.

CREATE OR REPLACE FUNCTION public.storage_can_view_pdf(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pdf_documents d
    WHERE d.storage_path = _path AND public.can_view_pdf(d.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_owns_pdf(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pdf_documents d
    WHERE d.storage_path = _path
      AND (
        d.uploaded_by = auth.uid()
        OR (d.team_id IS NOT NULL AND public.is_team_professor(d.team_id))
        OR public.is_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_view_submission(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.storage_path = _path
      AND (
        s.submitter_id = auth.uid()
        OR public.is_team_member(s.team_id)
        OR public.is_team_professor(s.team_id)
        OR public.is_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_owns_submission(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.storage_path = _path
      AND (
        s.submitter_id = auth.uid()
        OR public.is_team_professor(s.team_id)
        OR public.is_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_view_resource(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM resources r
    WHERE r.storage_path = _path
      AND (
        public.is_admin()
        OR r.visibility = 'public'
        OR (r.visibility = 'university'
              AND r.university_id = public.current_university_id())
        OR (r.visibility = 'course' AND r.course_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM courses c WHERE c.id = r.course_id
                AND c.university_id = public.current_university_id()))
        OR (r.visibility = 'team' AND r.team_id IS NOT NULL
              AND (public.is_team_member(r.team_id)
                   OR public.is_team_professor(r.team_id)))
        OR (r.visibility = 'private' AND r.created_by = auth.uid())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_owns_resource(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM resources r
    WHERE r.storage_path = _path
      AND (r.created_by = auth.uid() OR public.is_admin())
  )
$$;

GRANT EXECUTE ON FUNCTION public.storage_can_view_pdf(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_owns_pdf(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_view_submission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_owns_submission(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_view_resource(text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_owns_resource(text)       TO authenticated;


-- ── B.3 storage.objects policies ───────────────────────────────────────────
-- Policy names are prefixed with the bucket to keep them readable in the
-- storage policies pane. RLS is already enabled on storage.objects by default
-- in Supabase, so no ALTER TABLE needed.

-- pdfs
DROP POLICY IF EXISTS storage_pdfs_select ON storage.objects;
DROP POLICY IF EXISTS storage_pdfs_insert ON storage.objects;
DROP POLICY IF EXISTS storage_pdfs_update ON storage.objects;
DROP POLICY IF EXISTS storage_pdfs_delete ON storage.objects;

CREATE POLICY storage_pdfs_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pdfs' AND public.storage_can_view_pdf(name));

CREATE POLICY storage_pdfs_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdfs' AND public.storage_owns_pdf(name));

CREATE POLICY storage_pdfs_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pdfs' AND public.storage_owns_pdf(name))
WITH CHECK (bucket_id = 'pdfs' AND public.storage_owns_pdf(name));

CREATE POLICY storage_pdfs_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pdfs' AND public.storage_owns_pdf(name));

-- submissions
DROP POLICY IF EXISTS storage_submissions_select ON storage.objects;
DROP POLICY IF EXISTS storage_submissions_insert ON storage.objects;
DROP POLICY IF EXISTS storage_submissions_update ON storage.objects;
DROP POLICY IF EXISTS storage_submissions_delete ON storage.objects;

CREATE POLICY storage_submissions_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions' AND public.storage_can_view_submission(name));

CREATE POLICY storage_submissions_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions' AND public.storage_owns_submission(name));

CREATE POLICY storage_submissions_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'submissions' AND public.storage_owns_submission(name))
WITH CHECK (bucket_id = 'submissions' AND public.storage_owns_submission(name));

CREATE POLICY storage_submissions_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'submissions' AND public.storage_owns_submission(name));

-- avatars  (path convention: <profile_id>/avatar.<ext>)
-- No metadata table; ownership comes from the first path segment matching
-- auth.uid(). SELECT mirrors profiles_select (permissive within authenticated).
DROP POLICY IF EXISTS storage_avatars_select ON storage.objects;
DROP POLICY IF EXISTS storage_avatars_insert ON storage.objects;
DROP POLICY IF EXISTS storage_avatars_update ON storage.objects;
DROP POLICY IF EXISTS storage_avatars_delete ON storage.objects;

CREATE POLICY storage_avatars_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY storage_avatars_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY storage_avatars_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY storage_avatars_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- resources
DROP POLICY IF EXISTS storage_resources_select ON storage.objects;
DROP POLICY IF EXISTS storage_resources_insert ON storage.objects;
DROP POLICY IF EXISTS storage_resources_update ON storage.objects;
DROP POLICY IF EXISTS storage_resources_delete ON storage.objects;

CREATE POLICY storage_resources_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resources' AND public.storage_can_view_resource(name));

CREATE POLICY storage_resources_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resources' AND public.storage_owns_resource(name));

CREATE POLICY storage_resources_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resources' AND public.storage_owns_resource(name))
WITH CHECK (bucket_id = 'resources' AND public.storage_owns_resource(name));

CREATE POLICY storage_resources_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resources' AND public.storage_owns_resource(name));
