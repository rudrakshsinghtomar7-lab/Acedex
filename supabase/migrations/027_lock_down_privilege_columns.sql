-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 027 — close role-escalation and self-grading holes (security fix A)
-- ============================================================================
--
-- Two privilege escalations were reachable by ANY authenticated student holding
-- nothing but the public anon key -- not through the app, but by calling
-- PostgREST directly:
--
--   1. PATCH /profiles?id=eq.<self>  {"role":"admin"}
--      -> instant admin. is_admin() then unlocks the `OR is_admin()` branch of
--         nearly every policy in the schema. Adding university_id to the same
--         PATCH picks which tenant to become admin of, and profiles_delete
--         (is_admin() AND university_id = current_university_id()) then permits
--         deleting that university's users.
--
--   2. PATCH /submissions?id=eq.<own> {"points_awarded":999}
--      -> self-grading. The on_submission_points_change trigger obligingly
--         stamps letter_grade='HD'. Because `status` never changes,
--         on_submission_reviewed never fires, so the professor is never
--         notified. The same worked at INSERT time, since submissions_insert
--         is equally column-unrestricted.
--
-- Root cause in both cases: the RLS UPDATE policies scope by ROW
-- (id = auth.uid() / submitter_id = auth.uid()) but not by COLUMN, and
-- `authenticated` held blanket grants underneath them. RLS has no column
-- granularity, so the grant layer has to provide it.
--
-- ---------------------------------------------------------------------------
-- Two traps this migration exists to document, both found by attacking the fix
-- rather than trusting it:
--
--   * COLUMN PRIVILEGES ARE ADDITIVE. `REVOKE UPDATE (role) ON profiles` against
--     a role that holds a whole-table UPDATE grant is a silent no-op -- it
--     returns success and changes nothing, because a column-level revoke can
--     only remove column-level grants. You must drop the relation-level
--     privilege and grant back the allowed columns individually.
--
--   * INSIDE SECURITY DEFINER, current_user IS THE OWNER, not the caller.
--     A guard of the form `current_user in ('postgres',...)` inside a definer
--     function owned by postgres is unconditionally true and disables the whole
--     check. Discriminate on request.jwt.claims instead.
--
-- Verified by attack with a real student JWT over HTTP: role=admin, tenant hop,
-- points_awarded, letter_grade, pre-graded INSERT, and the sync RPC all 403.
-- Professor grading, profile edit, normal submission, assignee add, and
-- assignment delete (cascade) all still succeed.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles: role + university_id become server-side-only columns
-- ---------------------------------------------------------------------------
-- Nothing in the client updates profiles directly. Signup sets role once via
-- handle_new_auth_user(); profile edits go through update_profile_atomic(),
-- which is SECURITY DEFINER and runs as the owner, so it bypasses these grants
-- entirely. The remaining columns are granted back so the privilege surface is
-- otherwise unchanged.
--
-- NOTE: these grants are column-enumerated. Any future ALTER TABLE ... ADD
-- COLUMN on profiles must be added here, or writes to it will fail with
-- "permission denied for column".
revoke update on public.profiles from anon, authenticated;
grant update (id, email, full_name, avatar_url, bio,
              onboarded_at, last_seen_at, created_at, updated_at)
  on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. submissions: letter_grade is derived and never client-written
-- ---------------------------------------------------------------------------
-- reviewSubmission() deliberately omits letter_grade and lets
-- set_letter_grade_from_points compute it. A BEFORE trigger assigning
-- NEW.letter_grade does not require the *caller* to hold UPDATE on that column,
-- so revoking it does not break grading.
--
-- points_awarded stays granted: professors write it client-side and are the
-- same `authenticated` role as students, so no grant can separate them. It is
-- guarded by caller below instead.
revoke update on public.submissions from anon, authenticated;
grant update (id, assignment_id, team_id, submitter_id, storage_path, notes,
              status, version, submitted_at, reviewed_at, reviewed_by,
              created_at, updated_at, pdf_document_id, feedback, points_awarded)
  on public.submissions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. submissions.points_awarded: guarded by caller, not by grant
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: this reads only NEW/OLD and delegates the
-- privilege question to is_team_professor()/is_admin(), which are already
-- definer. Keeping it invoker means current_user really is the calling role
-- (see trap #2 above) and adds no new definer surface.
create or replace function public.tg_submissions_guard_grade()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Backend paths (service_role, or a direct owner connection running a
  -- migration/backfill) bypass RLS but still fire triggers. `authenticated`
  -- cannot SET ROLE into either, so this is safe *here* -- and it is only safe
  -- because this function is INVOKER.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- INSERT: a student may create a submission, but not a pre-graded one.
  if tg_op = 'INSERT' then
    if (new.points_awarded is not null or new.letter_grade is not null)
       and not (public.is_team_professor(new.team_id) or public.is_admin()) then
      raise exception 'only the team professor may set grades'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: allow every other edit RLS already permits (status, feedback,
  -- storage_path...), but reject a change to the grade columns. IS DISTINCT
  -- FROM so a no-op resend of the same value is not an error.
  if (new.points_awarded is distinct from old.points_awarded
      or new.letter_grade is distinct from old.letter_grade)
     and not (public.is_team_professor(new.team_id) or public.is_admin()) then
    raise exception 'only the team professor may set grades'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 'aa_' prefix is load-bearing: BEFORE triggers fire in alphabetical order, and
-- this must run before on_submission_points_change, which would otherwise
-- recompute letter_grade from a value we are about to reject.
drop trigger if exists aa_submissions_guard_grade on public.submissions;
create trigger aa_submissions_guard_grade
  before insert or update on public.submissions
  for each row execute function public.tg_submissions_guard_grade();

-- ---------------------------------------------------------------------------
-- 4. sync_assignment_task_assignees: add the missing caller check
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER and directly callable over REST with no authorization check
-- at all, so any student could force-reconcile any assignment's task_assignees
-- and delete rows a professor had set manually.
--
-- Discriminator is the JWT, not current_user (trap #2). PostgREST sets
-- request.jwt.claims on every API request; a direct owner connection has none:
--   no claims           -> direct DB connection, allow
--   role = service_role -> trusted backend key, allow
--   otherwise           -> real API caller, require professor/admin
--
-- The trigger path still works: on_assignment_assignee_sync_task fires on
-- assignment_assignees, which assignees_prof_write already restricts to
-- professors/admins, so their own JWT satisfies the check.
create or replace function public.sync_assignment_task_assignees(_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _task_id  uuid;
  _team_id  uuid;
  _claims   text := nullif(current_setting('request.jwt.claims', true), '');
  _jwt_role text;
begin
  select team_id into _team_id from public.assignments where id = _assignment_id;

  -- Assignment row already gone. This is the NORMAL cascade path:
  -- assignment_assignees.assignment_id is ON DELETE CASCADE, and RI cascade
  -- fires after the parent row is removed, so this runs once per assignee while
  -- deleting an assignment. Raising here would abort every assignment deletion.
  if _team_id is null then return; end if;

  if _claims is not null then
    begin
      _jwt_role := _claims::jsonb ->> 'role';
    exception when others then
      _jwt_role := null;   -- unparseable claims: treat as untrusted
    end;

    if _jwt_role is distinct from 'service_role'
       and not (public.is_team_professor(_team_id) or public.is_admin()) then
      raise exception 'not authorized to sync assignees for this assignment'
        using errcode = '42501';
    end if;
  end if;

  select id into _task_id from public.tasks where assignment_id = _assignment_id;
  if _task_id is null then return; end if;

  delete from public.task_assignees ta
    where ta.task_id = _task_id
      and ta.student_id not in (
        select aa.student_id from public.assignment_assignees aa
         where aa.assignment_id = _assignment_id);

  insert into public.task_assignees (task_id, student_id, assigned_by)
    select _task_id, aa.student_id, null
      from public.assignment_assignees aa
     where aa.assignment_id = _assignment_id
    on conflict (task_id, student_id) do nothing;
end;
$$;

commit;
