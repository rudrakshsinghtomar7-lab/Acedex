-- 027_lock_down_privilege_columns.sql
--
-- Security fix (A). Closes two privilege-escalation holes reachable by any
-- authenticated student holding nothing but the public anon key.
--
-- Both existed because the RLS UPDATE policies on `profiles` and `submissions`
-- scope by ROW (id = auth.uid() / submitter_id = auth.uid()) but not by COLUMN,
-- and `authenticated` held blanket column grants underneath them:
--
--   1. PATCH /profiles?id=eq.<self> {"role":"admin"}  -> instant admin.
--      is_admin() then unlocks the `OR is_admin()` branch of nearly every
--      policy in the schema. Chaining university_id first picks the tenant.
--
--   2. PATCH /submissions?id=eq.<own> {"points_awarded":999} -> self-grading.
--      The on_submission_points_change trigger then stamps letter_grade='HD',
--      and because status never changes, on_submission_reviewed never fires,
--      so the professor is not notified.
--
-- Two different mechanisms are needed, because a column REVOKE is role-level
-- and cannot distinguish a professor from a student -- both are `authenticated`:
--
--   * profiles.role / profiles.university_id and submissions.letter_grade have
--     no legitimate client-side writer, so a REVOKE is sufficient and exact.
--     ProfileEdit writes university_id only through update_profile_atomic(),
--     which is SECURITY DEFINER and runs as the owner, so it is unaffected.
--
--   * submissions.points_awarded IS written client-side, by professors, in
--     reviewSubmission() (src/lib/assignments.js). Revoking it would break
--     grading. It is guarded by a trigger that checks the caller instead, so
--     this migration needs no coordinated client deploy.

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles: role and university_id are server-side-only columns.
-- ---------------------------------------------------------------------------
-- Nothing in the client writes `role` at all. Signup sets it once via
-- handle_new_auth_user() (SECURITY DEFINER, fires as supabase_auth_admin).
revoke update (role, university_id) on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. submissions.letter_grade: derived column, never written by a client.
-- ---------------------------------------------------------------------------
-- reviewSubmission() deliberately omits it and lets set_letter_grade_from_points
-- compute it. The trigger is SECURITY DEFINER, so the revoke does not affect it.
revoke update (letter_grade) on public.submissions from anon, authenticated;
revoke insert (letter_grade) on public.submissions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. submissions.points_awarded: professor-writable, so guard by caller.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose -- this reads only NEW/OLD and delegates the
-- privilege question to is_team_professor()/is_admin(), which are already
-- SECURITY DEFINER. Keeping it INVOKER adds no new definer surface for the
-- linter to flag. search_path is pinned per the same hardening we apply in (B).
create or replace function public.tg_submissions_guard_grade()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Backend paths (service_role key, or a direct owner connection running a
  -- migration/backfill) bypass RLS but still fire triggers. They are not the
  -- threat model here, and `authenticated` cannot SET ROLE into either.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- INSERT: a student may create a submission, but not a pre-graded one.
  -- submissions_insert is column-unrestricted, so without this a crafted
  -- INSERT sets points_awarded directly and bypasses the UPDATE path entirely.
  if tg_op = 'INSERT' then
    if (new.points_awarded is not null or new.letter_grade is not null)
       and not (public.is_team_professor(new.team_id) or public.is_admin()) then
      raise exception 'only the team professor may set grades'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: allow any other edit the RLS policy already permits (status,
  -- feedback, storage_path...), but reject a change to the grade columns.
  -- IS DISTINCT FROM so a no-op resend of the same value is not an error.
  if (new.points_awarded is distinct from old.points_awarded
      or new.letter_grade is distinct from old.letter_grade)
     and not (public.is_team_professor(new.team_id) or public.is_admin()) then
    raise exception 'only the team professor may set grades'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Name is deliberately 'aa_'-prefixed: Postgres fires BEFORE triggers in
-- alphabetical order, and this must run before on_submission_points_change,
-- which would otherwise recompute letter_grade from a value we are rejecting.
drop trigger if exists aa_submissions_guard_grade on public.submissions;
create trigger aa_submissions_guard_grade
  before insert or update on public.submissions
  for each row execute function public.tg_submissions_guard_grade();

-- ---------------------------------------------------------------------------
-- 4. sync_assignment_task_assignees: had no caller check at all.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER and directly callable over the REST API, so any student
-- could force-reconcile any assignment's task_assignees and delete rows a
-- professor had set manually. It is also called from tg_sync_assignment_task_
-- assignees, where auth.uid() is the professor doing the write, so the same
-- check holds for the trigger path.
create or replace function public.sync_assignment_task_assignees(_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare _task_id uuid; _team_id uuid;
begin
  select team_id into _team_id from public.assignments where id = _assignment_id;

  -- Assignment row is already gone. This is the normal cascade path:
  -- assignment_assignees.assignment_id is ON DELETE CASCADE, and RI cascade
  -- fires AFTER the parent row is removed, so on_assignment_assignee_sync_task
  -- reaches here once per assignee while deleting an assignment. Raising would
  -- abort every assignment deletion. Nothing to sync and nothing to escalate.
  if _team_id is null then return; end if;

  if not (current_user in ('postgres', 'service_role', 'supabase_admin')
          or public.is_team_professor(_team_id) or public.is_admin()) then
    raise exception 'not authorized to sync assignees for this assignment'
      using errcode = '42501';
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
