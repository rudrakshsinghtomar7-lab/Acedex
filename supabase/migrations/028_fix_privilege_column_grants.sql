-- 028_fix_privilege_column_grants.sql
--
-- Corrects migration 027. Still security fix (A) -- hardening (B) is separate.
--
-- 027 used:
--     revoke update (role, university_id) on profiles from anon, authenticated;
--
-- That is a silent no-op. In PostgreSQL, column-level privileges are strictly
-- ADDITIVE to relation-level ones: `authenticated` holds a whole-table UPDATE
-- grant (relacl 'w' in authenticated=arwdDxtm/postgres), which already covers
-- every column, and REVOKE ... (col) can only remove column-specific grants.
-- It cannot subtract from a table-wide grant. The revoke returned success and
-- changed nothing -- verified by attack: a student PATCHing {"role":"admin"}
-- still got HTTP 204 and the role really changed.
--
-- The correct pattern is to drop the relation-level privilege and grant back
-- only the allowed columns. Column lists below are the full current column set
-- minus the protected ones, so every other write keeps working byte-for-byte.
--
-- NOTE: this makes the grants column-enumerated. Any future ALTER TABLE ... ADD
-- COLUMN on profiles/submissions must add the new column to the GRANT below,
-- or clients will get "permission denied for column" when writing it.

begin;

-- ---------------------------------------------------------------------------
-- profiles: protect role + university_id
-- ---------------------------------------------------------------------------
-- Nothing in the client updates profiles directly -- the only writer is
-- update_profile_atomic(), which is SECURITY DEFINER and runs as the owner, so
-- it is unaffected by these grants. The remaining columns are granted purely to
-- keep the privilege surface identical to before for anything not yet traced.
revoke update on public.profiles from anon, authenticated;
grant update (id, email, full_name, avatar_url, bio,
              onboarded_at, last_seen_at, created_at, updated_at)
  on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submissions: protect letter_grade
-- ---------------------------------------------------------------------------
-- letter_grade is derived: reviewSubmission() never sends it and
-- set_letter_grade_from_points computes it in a BEFORE trigger. A BEFORE
-- trigger assigning NEW.letter_grade does not require the *caller* to hold
-- UPDATE on that column, so revoking it does not break grading.
--
-- points_awarded stays granted: professors write it client-side and are the
-- same `authenticated` role as students. It is guarded by caller instead, in
-- tg_submissions_guard_grade() from 027, which remains correct and in force.
revoke update on public.submissions from anon, authenticated;
grant update (id, assignment_id, team_id, submitter_id, storage_path, notes,
              status, version, submitted_at, reviewed_at, reviewed_by,
              created_at, updated_at, pdf_document_id, feedback, points_awarded)
  on public.submissions to anon, authenticated;

commit;
