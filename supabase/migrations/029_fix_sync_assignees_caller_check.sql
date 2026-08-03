-- 029_fix_sync_assignees_caller_check.sql
--
-- Corrects the caller check added to sync_assignment_task_assignees in 027.
-- Still security fix (A).
--
-- 027 guarded the function with:
--     if not (current_user in ('postgres','service_role','supabase_admin')
--             or is_team_professor(_team_id) or is_admin()) then raise ...
--
-- Inside a SECURITY DEFINER function current_user is the FUNCTION OWNER, not
-- the caller -- that is what "definer" means. The function is owned by postgres,
-- so `current_user in ('postgres',...)` was unconditionally true and the whole
-- check short-circuited. Verified by attack: a student calling the RPC still
-- got HTTP 204.
--
-- (The submissions guard from 027 does not have this bug: it is SECURITY
-- INVOKER, where current_user really is the calling role.)
--
-- Correct discriminator: presence of a JWT. PostgREST sets request.jwt.claims
-- for every API request; a direct owner connection (psql, a migration, a
-- backfill) has no such setting. So:
--   * no claims        -> direct DB connection, allow
--   * role=service_role -> trusted backend key, allow
--   * otherwise         -> a real API caller, require professor/admin
--
-- The trigger path (on_assignment_assignee_sync_task on assignment_assignees,
-- AFTER INSERT OR DELETE) still works: assignees_prof_write already restricts
-- that table to professors/admins, so the professor's own JWT satisfies the
-- check. Deleting an assignment cascades with the parent row already gone, and
-- is handled by the _team_id IS NULL early return below.

begin;

create or replace function public.sync_assignment_task_assignees(_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _task_id uuid;
  _team_id uuid;
  _claims  text := nullif(current_setting('request.jwt.claims', true), '');
  _jwt_role text;
begin
  select team_id into _team_id from public.assignments where id = _assignment_id;

  -- Assignment row already gone: the normal cascade path (assignment_assignees
  -- is ON DELETE CASCADE and RI cascade fires after the parent is removed).
  -- Raising here would abort every assignment deletion.
  if _team_id is null then return; end if;

  if _claims is not null then
    begin
      _jwt_role := _claims::jsonb ->> 'role';
    exception when others then
      _jwt_role := null;   -- unparseable claims: treat as an untrusted caller
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
