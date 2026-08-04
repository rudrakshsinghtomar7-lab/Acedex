-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- ============================================================================
-- 029 — close storage-path forgery (security fix A1)
-- ============================================================================
--
-- Any authenticated student could READ and permanently DELETE any file in the
-- pdfs / submissions / resources buckets, by inserting a metadata row
-- (pdf_documents / submissions / resources) that claims someone else's
-- storage_path. Verified by attack: baseline read of a victim's private PDF
-- 404s; after
--
--   POST /pdf_documents {uploaded_by:self, storage_path:"<victim-team>/x.pdf",
--                        access_level:"public_link", ...}   -> 201
--
-- GET of that object returned 200 + the victim's bytes, and DELETE removed it
-- from storage.objects for real (confirmed against storage.objects, not the
-- API's "Successfully deleted" — storage.remove() reports success on paths it
-- never touched).
--
-- Root cause: the storage policies authorize via storage_owns_pdf(name) /
-- storage_can_view_pdf(name), which trust a metadata row keyed on storage_path.
-- Two independent gaps let a student forge that row:
--   (1) storage_path had no uniqueness, so a path could be double-claimed; and
--   (2) the INSERT checks bound only the row's owner column (uploaded_by /
--       submitter_id / created_by) to auth.uid(), never the PATH — so a student
--       could point their own row at anyone's object.
--
-- This migration fixes the ROOT CAUSE, not the authorizer, with two independent
-- defenses. Note we could NOT bind the insert to storage.objects.owner: the app
-- inserts the metadata row BEFORE uploading the object (the storage INSERT
-- policy needs the row to already exist), so the object does not yet exist at
-- row-insert time.
--
-- Pre-checked before the unique indexes: zero duplicate storage_path values in
-- any of the three tables, so no legitimate row is broken.
--
-- ----------------------------------------------------------------------------
-- STORAGE PATH NAMESPACE CONTRACT — READ THIS BEFORE BUILDING RESOURCE UPLOAD
-- ----------------------------------------------------------------------------
-- Defense (2) below requires every storage_path to be PREFIXED by an id the
-- caller provably controls, checked as split_part(storage_path,'/',1). The
-- prefix differs by table, and the difference is deliberate, not an oversight:
--
--   * pdf_documents, submissions  ->  prefixed by TEAM_ID
--       These objects are always team-scoped. The client already builds paths
--       as `${teamId}/${randomUUID}/${filename}` (lib/pdfs.js uploadPdfDocument),
--       and the caller must be a member/professor of that team. A submission
--       reuses its PDF's path, so its team_id matches the prefix too.
--
--   * resources  ->  prefixed by CREATED_BY (the uploader's uid)
--       Resources are MULTI-SCOPE: a resource may be team, course, university,
--       public, or private (see resources.visibility; team_id/course_id/
--       university_id are all nullable). There is no single team to namespace
--       by, so a university-wide or public resource has no teamId. The only id
--       that is always present and caller-controlled is created_by, so resource
--       objects namespace by uploader uid: `${auth.uid()}/...`.
--
--   ==> WHEN YOU BUILD RESOURCE UPLOAD (there is no client uploader today, and
--       0 resource objects exist): the storage_path MUST start with the
--       uploader's uid, i.e. `${userId}/...`. A teamId prefix like the PDF path
--       will be REJECTED by resources_insert. If resources are later redesigned
--       to be strictly team-scoped like PDFs, change this policy to a team_id
--       prefix at that time so the two schemes converge — do it deliberately,
--       not by copying the PDF path builder and hitting a 403.
--
-- The team_id IS NULL branch on pdf_documents is treated as UNUSED. No client
-- creates teamless PDFs. It is kept alive but locked to a uid prefix so it
-- cannot be the forgery vector it was; a real personal-document feature, if it
-- ever lands, gets its own path scheme designed on purpose.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Defense 1: a storage_path can be claimed by at most one row per table.
-- ---------------------------------------------------------------------------
-- Per-table, NOT cross-table: pdf_documents and submissions intentionally
-- share the same path string (a submission references its PDF's object), so
-- each table gets its own unique index. Combined with the random-UUID segment
-- in every path, this makes both claiming an existing file (the path is already
-- taken -> 23505) and pre-claiming a future file (unguessable UUID) infeasible.
create unique index if not exists uq_pdf_documents_storage_path
  on public.pdf_documents (storage_path);

create unique index if not exists uq_submissions_storage_path
  on public.submissions (storage_path) where storage_path is not null;

create unique index if not exists uq_resources_storage_path
  on public.resources (storage_path) where storage_path is not null;

-- ---------------------------------------------------------------------------
-- Defense 2: the claimed path must live under a namespace the caller controls.
-- ---------------------------------------------------------------------------
-- pdf_documents: team-prefixed, caller must belong to that team. Kills the
-- exploit's team_id=NULL + victim-team-prefixed path. Keeps a uid-namespaced
-- teamless branch alive but non-exploitable (see contract note above).
drop policy if exists pdf_documents_insert on public.pdf_documents;
create policy pdf_documents_insert on public.pdf_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      (team_id is not null
        and (is_team_member(team_id) or is_team_professor(team_id))
        and split_part(storage_path, '/', 1) = team_id::text)
      or
      (team_id is null
        and split_part(storage_path, '/', 1) = uploaded_by::text)
    )
  );

-- submissions: keep the 028 checks (self, assignment/team match, membership),
-- add the team-id path bind. storage_path may be null for a fileless draft.
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
    and (storage_path is null or split_part(storage_path, '/', 1) = team_id::text)
  );

-- resources: keep the existing visibility/ownership checks, add the uid path
-- bind (see contract note — resources namespace by uploader, not team).
drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      is_admin()
      or is_professor()
      or (visibility = any (array['team'::resource_visibility, 'private'::resource_visibility])
          and (team_id is null or is_team_member(team_id)))
    )
    and (storage_path is null or split_part(storage_path, '/', 1) = created_by::text)
  );

commit;
