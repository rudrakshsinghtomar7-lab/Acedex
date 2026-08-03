-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 028 — shrink the callable function surface (hardening B)
-- ============================================================================
--
-- Follow-up to 027. Nothing here closes a live vulnerability; this is the
-- "worth doing, not urgent" list from the audit. It clears 68 of the linter's
-- 87 warnings and removes reachability that has no legitimate use.
--
-- What is deliberately NOT touched: the read-only helpers used inside RLS
-- policies (is_admin, is_team_member, is_team_professor, is_course_professor,
-- is_same_university, is_student, is_professor, current_profile_role,
-- current_university_id, can_view_pdf, storage_can_view_*, storage_owns_*).
-- Policy expressions are evaluated as the querying role, so revoking EXECUTE on
-- those would break every read that depends on them. They are genuinely
-- read-only and each resolves its subject from auth.uid() rather than from an
-- argument, so they cannot be used to enumerate other users.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Revoke EXECUTE on functions that only ever run from triggers
-- ---------------------------------------------------------------------------
-- PostgreSQL checks EXECUTE on a trigger function at CREATE TRIGGER time, not
-- at fire time, so revoking here cannot break any trigger.
--
-- FROM PUBLIC is the load-bearing part. Supabase's ACLs show a leading
-- `=X/postgres`, i.e. EXECUTE is granted to PUBLIC, which anon and
-- authenticated inherit. Revoking from anon+authenticated ALONE leaves the
-- PUBLIC grant intact, the functions still callable, and the linter warning
-- still firing -- while looking like it worked.
revoke execute on function
  public.handle_new_auth_user(),
  public.create_task_for_assignment(),
  public.tg_set_updated_at(),
  public.tg_tasks_sync_done(),
  public.tg_submissions_team_matches_assignment(),
  public.tg_sync_assignment_task_assignees(),
  public.tg_submissions_guard_grade(),
  public.set_letter_grade_from_points(),
  public.set_assignee_letter_grade_from_points(),
  public.set_team_letter_grade_from_points(),
  public.sync_task_for_subtask(),
  public.sync_task_from_assignment(),
  public.sync_task_from_submission(),
  public.notify_assignment_assignee_added(),
  public.notify_assignment_created(),
  public.notify_pdf_comment(),
  public.notify_pdf_uploaded(),
  public.notify_submission_received(),
  public.notify_submission_reviewed(),
  public.notify_subtask_assigned()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Revoke EXECUTE on internal helpers the client never calls
-- ---------------------------------------------------------------------------
-- compute_assignment_task_status is a cross-tenant oracle: SECURITY DEFINER,
-- no caller check, and it returns the submission state of ANY assignment id,
-- bypassing RLS. Its only caller is create_task_for_assignment (a definer
-- trigger owned by postgres, which retains EXECUTE).
--
-- sync_assignment_task_assignees is guarded as of 027, but the app never calls
-- it over RPC either -- its only caller is the on_assignment_assignee_sync_task
-- trigger. Revoking is defence in depth.
--
-- Verified before revoking: neither appears in any RLS policy expression.
revoke execute on function
  public.compute_assignment_task_status(uuid),
  public.sync_assignment_task_assignees(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on the four functions that lack it
-- ---------------------------------------------------------------------------
-- These are SECURITY INVOKER, so they run with the caller's own privileges and
-- the hijack risk is largely theoretical -- but the fix is free. ALTER FUNCTION
-- avoids re-declaring the bodies.
alter function public.tg_set_updated_at()                 set search_path = public, pg_temp;
alter function public.tg_tasks_sync_done()                set search_path = public, pg_temp;
alter function public.set_team_letter_grade_from_points() set search_path = public, pg_temp;
alter function public.calculate_aussie_grade(numeric, numeric)
                                                          set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 4. Name pg_temp explicitly on the existing SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
-- They currently use `SET search_path = public`. When pg_temp is not named, it
-- is searched FIRST for relation names, so a session able to create a temp
-- table could shadow e.g. public.profiles inside a definer function. Not
-- reachable through PostgREST (no arbitrary DDL), which is why this is
-- hardening and not a vulnerability -- but naming pg_temp last is the reason
-- the convention exists.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proconfig is not null
       and 'search_path=public' = any(p.proconfig)
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Fix the tautology in submissions_insert
-- ---------------------------------------------------------------------------
-- The policy read `a.team_id = a.team_id`, which is always true, so it never
-- actually checked that the submission's team matches the assignment's. It was
-- harmless only because tg_submissions_team_matches_assignment enforces the
-- same invariant -- the policy was load-bearing by accident.
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (
    submitter_id = auth.uid()
    and exists (
      select 1 from public.assignments a
       where a.id = submissions.assignment_id
         and a.team_id = submissions.team_id
         and public.is_team_member(a.team_id)
    )
  );

commit;
