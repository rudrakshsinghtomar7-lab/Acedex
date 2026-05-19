-- ============================================================================
-- Acedex — PDF upload + comment notification triggers
-- ============================================================================
-- Depends on migration 006 having added 'pdf_uploaded' (and on the canonical
-- 005 having added 'pdf_comment') to notification_type.
--
-- notify_pdf_uploaded fires on INSERT into pdf_documents. Recipients are the
--   course professor plus all team_members of the owning team, excluding the
--   uploader. Link: /projects/:teamId/pdfs/:pdfId
--
-- notify_pdf_comment (replaces the migration-005 trigger
-- pdf_annotations_notify_comment / tg_pdf_annotation_notify_comment) fires
--   on INSERT of a pdf_annotations row with annotation_type = 'comment'.
--   Recipients are all team_members of the owning team, excluding the
--   commenter. Body uses a 60-char snippet per Feature 6 spec; link omits
--   the annotation anchor and uses /projects/:teamId/pdfs/:pdfId?page=N.
-- ============================================================================

-- --- notify_pdf_uploaded -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_pdf_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _team_name text;
  _course_professor_id uuid;
  _uploader_name text;
BEGIN
  SELECT t.name, c.professor_id
    INTO _team_name, _course_professor_id
  FROM public.teams t
  JOIN public.courses c ON c.id = t.course_id
  WHERE t.id = NEW.team_id;

  IF _team_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO _uploader_name
  FROM public.profiles
  WHERE id = NEW.uploaded_by;

  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    body,
    link,
    related_team_id
  )
  SELECT DISTINCT
    r.recipient_id,
    'pdf_uploaded'::notification_type,
    'New PDF uploaded',
    COALESCE(_uploader_name, 'A teammate')
      || ' uploaded ' || COALESCE(NEW.title, 'a PDF')
      || ' to ' || _team_name || '.',
    '/projects/' || NEW.team_id::text || '/pdfs/' || NEW.id::text,
    NEW.team_id
  FROM (
    SELECT tm.profile_id AS recipient_id
      FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id
    UNION
    SELECT _course_professor_id AS recipient_id
      WHERE _course_professor_id IS NOT NULL
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> NEW.uploaded_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pdf_document_inserted ON public.pdf_documents;
CREATE TRIGGER on_pdf_document_inserted
  AFTER INSERT ON public.pdf_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pdf_uploaded();

-- --- notify_pdf_comment (refreshed) ------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_pdf_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _doc_title text;
  _author_name text;
  _snippet text;
BEGIN
  IF NEW.annotation_type::text <> 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT d.team_id, d.title
    INTO _team_id, _doc_title
  FROM public.pdf_documents d
  WHERE d.id = NEW.document_id;

  IF _team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO _author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  _snippet := CASE
    WHEN char_length(COALESCE(NEW.content, '')) > 60
      THEN substring(NEW.content from 1 for 60) || '…'
    ELSE COALESCE(NEW.content, '')
  END;

  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    body,
    link,
    related_team_id
  )
  SELECT
    tm.profile_id,
    'pdf_comment'::notification_type,
    'New PDF comment',
    COALESCE(_author_name, 'A teammate')
      || ' commented on ' || COALESCE(_doc_title, 'a PDF')
      || ': ' || _snippet,
    '/projects/' || _team_id::text
      || '/pdfs/' || NEW.document_id::text
      || '?page=' || NEW.page_number::text,
    _team_id
  FROM public.team_members tm
  WHERE tm.team_id = _team_id
    AND tm.profile_id <> NEW.author_id;

  RETURN NEW;
END;
$$;

-- Replace the canonical-005 trigger + function. We drop the trigger first so
-- a single comment INSERT doesn't fan out twice via both old and new paths.
DROP TRIGGER IF EXISTS pdf_annotations_notify_comment ON public.pdf_annotations;
DROP FUNCTION IF EXISTS public.tg_pdf_annotation_notify_comment();

DROP TRIGGER IF EXISTS on_pdf_comment_inserted ON public.pdf_annotations;
CREATE TRIGGER on_pdf_comment_inserted
  AFTER INSERT ON public.pdf_annotations
  FOR EACH ROW
  WHEN (NEW.annotation_type::text = 'comment')
  EXECUTE FUNCTION public.notify_pdf_comment();
