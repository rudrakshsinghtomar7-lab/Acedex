-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 031 — stop students escalating resource visibility on UPDATE (security fix A3)
-- ============================================================================
--
-- resources_insert already blocks a student from CREATING a public/university/
-- course resource (they may only insert team/private). But resources_update's
-- WITH CHECK was just `created_by = auth.uid() OR is_admin()` with no column
-- restriction, so a student could insert private and then flip it:
--
--   POST  /resources {visibility:"private", ...}          -> 201
--   PATCH /resources?id=eq.<own> {"visibility":"public"}  -> 200  visibility=public
--
-- publishing content university-wide/public, bypassing the insert-time gate.
--
-- Fix: mirror the insert policy's visibility rule in the update check — a
-- non-privileged owner may keep a resource 'team' or 'private' but cannot raise
-- it to 'public'/'university'/'course'. Professors and admins retain full range.
-- ============================================================================

begin;

drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources
  for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (
    (created_by = auth.uid() or is_admin())
    and (
      is_admin()
      or is_professor()
      or visibility = any (array['team'::resource_visibility, 'private'::resource_visibility])
    )
  );

commit;
