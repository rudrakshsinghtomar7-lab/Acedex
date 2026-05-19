-- ============================================================================
-- migration 005 — PDF comments + highlights on existing pdf_annotations
-- ============================================================================
--
-- Feature 6 MVP (PDF Upload + Async Comments) reuses the pdf_annotations
-- table from migration 001 instead of creating duplicate pdf_comments /
-- pdf_highlights tables. The annotation_type enum discriminates rows:
--
--   comment   → text comment, threading via parent_annotation_id
--   highlight → text selection rectangle, uses the color column added here
--
-- This migration is intentionally minimal:
--   1. extend annotation_type with 'comment'
--   2. extend notification_type with 'pdf_comment'
--   3. add pdf_annotations.color (default '#facc15')
--   4. fan out a notification to every other team member when a comment row
--      is inserted
--
-- New enum values are only referenced inside the plpgsql trigger function
-- below. plpgsql function bodies are parsed at first call, not at CREATE
-- FUNCTION time, so this remains safe to apply in a single transaction.

-- ── 1. enum extensions ─────────────────────────────────────────────────────
ALTER TYPE annotation_type   ADD VALUE IF NOT EXISTS 'comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pdf_comment';

-- ── 2. color column on pdf_annotations ─────────────────────────────────────
-- Non-volatile default → Postgres stores a fast-default, no full table
-- rewrite on existing rows.
ALTER TABLE public.pdf_annotations
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#facc15';

-- ── 3. comment → notification fan-out trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_pdf_annotation_notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc record;
BEGIN
  IF NEW.annotation_type <> 'comment'::annotation_type THEN
    RETURN NEW;
  END IF;

  SELECT id, team_id, title
    INTO doc
  FROM public.pdf_documents
  WHERE id = NEW.document_id;

  IF doc.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id
  )
  SELECT
    tm.profile_id,
    'pdf_comment'::notification_type,
    'New comment on ' || doc.title,
    left(coalesce(NEW.content, ''), 280),
    '/projects/' || doc.team_id::text
      || '/pdfs/' || NEW.document_id::text
      || '?page=' || NEW.page_number::text
      || '#annotation-' || NEW.id::text,
    doc.team_id
  FROM public.team_members tm
  WHERE tm.team_id    = doc.team_id
    AND tm.profile_id <> NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdf_annotations_notify_comment ON public.pdf_annotations;

CREATE TRIGGER pdf_annotations_notify_comment
  AFTER INSERT ON public.pdf_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pdf_annotation_notify_comment();
