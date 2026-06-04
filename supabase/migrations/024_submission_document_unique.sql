-- 024_submission_document_unique.sql
-- Enforce ONE pdf_document per submission at the schema level.
--
-- Why: annotations (highlights + comments) FK to pdf_documents.id, and each
-- submission version owns its own pdf_document. Today that 1:1 link is
-- guaranteed only by app code. This constraint makes it structurally impossible
-- for two submissions to point at the same pdf_document_id, which would
-- otherwise silently share annotations across versions.
--
-- NULLs: pdf_document_id is ON DELETE SET NULL. Postgres treats NULLs as
-- distinct in a UNIQUE constraint, so multiple NULL values remain allowed.
-- Existing SET NULL behaviour is unaffected.
--
-- Safe to run in the Supabase SQL editor. Idempotent. Aborts cleanly if any
-- existing data would violate the constraint (per current flow, none should).

-- 1. Safety check: abort BEFORE altering if any pdf_document_id is shared.
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (
    select pdf_document_id
    from public.submissions
    where pdf_document_id is not null
    group by pdf_document_id
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'Aborting: % pdf_document_id value(s) are shared by multiple submissions. Resolve the duplicates before adding the unique constraint.',
      dup_count;
  end if;
end $$;

-- 2. Add the constraint only if it does not already exist (re-run safe).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_submissions_pdf_document_id'
  ) then
    alter table public.submissions
      add constraint uq_submissions_pdf_document_id unique (pdf_document_id);
  end if;
end $$;

-- To reverse, if ever needed:
-- alter table public.submissions drop constraint uq_submissions_pdf_document_id;
