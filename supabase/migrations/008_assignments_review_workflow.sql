-- ============================================================================
-- Acedex — Feature 7 MVP: Assignments + Submission review workflow
-- ============================================================================
-- Builds on the existing assignments + submissions tables from migration 001
-- (RLS already correct: professor-of-course can write assignments; students
-- can submit; professor can update submission status/feedback).
--
-- This migration adds the review-loop pieces:
--   1. submission_status enum: approved / rejected / needs_resubmission
--   2. notification_type enum: assignment_created / submission_reviewed
--   3. submissions.pdf_document_id link so Submit Work attaches the PDF row
--   4. submissions.feedback column for professor review notes (kept
--      separate from submissions.notes, which is the student-authored
--      message accompanying their submission)
--   5. Indexes for the queries the UI hits on every list open
--   6. notify_assignment_created trigger — fan out to all team_members
--      (and the course professor) when an assignment is inserted
--   7. notify_submission_reviewed trigger — fan out to the submitter when
--      submissions.status moves into approved / rejected / needs_resubmission
--
-- Enum values are referenced as 'literal'::enum casts inside plpgsql
-- function bodies. plpgsql parses bodies lazily at first call, so this is
-- safe to apply as a single transaction.
-- ============================================================================

ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'needs_resubmission';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assignment_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'submission_reviewed';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS pdf_document_id uuid
    REFERENCES public.pdf_documents(id) ON DELETE SET NULL;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS feedback text;

CREATE INDEX IF NOT EXISTS idx_assignments_team_due
  ON public.assignments(team_id, due_at);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_version
  ON public.submissions(assignment_id, version DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter_status
  ON public.submissions(submitter_id, status);

-- --- notify_assignment_created ----------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_assignment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _team_name text;
  _course_professor_id uuid;
  _creator_name text;
  _due text;
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
    INTO _creator_name
  FROM public.profiles
  WHERE id = NEW.owner_id;

  _due := CASE
    WHEN NEW.due_at IS NOT NULL
      THEN ' (due ' || to_char(NEW.due_at, 'Mon DD') || ')'
    ELSE ''
  END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  SELECT DISTINCT
    r.recipient_id,
    'assignment_created'::notification_type,
    'New assignment',
    COALESCE(_creator_name, 'Your professor')
      || ' posted "' || COALESCE(NEW.title, 'an assignment')
      || '" to ' || _team_name || _due || '.',
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.id
  FROM (
    SELECT tm.profile_id AS recipient_id
      FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id
    UNION
    SELECT _course_professor_id AS recipient_id
      WHERE _course_professor_id IS NOT NULL
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> COALESCE(NEW.owner_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_inserted ON public.assignments;
CREATE TRIGGER on_assignment_inserted
  AFTER INSERT ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_created();

-- --- notify_submission_reviewed ---------------------------------------------
-- Fires when a submission's status transitions to one of the review verdicts.
-- Skips drafts and student-side status changes — those won't trip the WHEN
-- clause.

CREATE OR REPLACE FUNCTION public.notify_submission_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _assignment_title text;
  _reviewer_name text;
  _verdict text;
  _snippet text;
BEGIN
  SELECT a.title INTO _assignment_title
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _reviewer_name
  FROM public.profiles WHERE id = NEW.reviewed_by;

  _verdict := CASE NEW.status::text
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'needs_resubmission' THEN 'needs a resubmission'
    ELSE NEW.status::text
  END;

  _snippet := CASE
    WHEN char_length(COALESCE(NEW.feedback, '')) > 60
      THEN ': ' || substring(NEW.feedback from 1 for 60) || '…'
    WHEN char_length(COALESCE(NEW.feedback, '')) > 0
      THEN ': ' || NEW.feedback
    ELSE ''
  END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  VALUES (
    NEW.submitter_id,
    'submission_reviewed'::notification_type,
    'Submission ' || _verdict,
    COALESCE(_reviewer_name, 'Your professor')
      || ' ' || _verdict || ' your submission for "'
      || COALESCE(_assignment_title, 'an assignment') || '"' || _snippet,
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.assignment_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_reviewed ON public.submissions;
CREATE TRIGGER on_submission_reviewed
  AFTER UPDATE OF status ON public.submissions
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status::text IN ('approved', 'rejected', 'needs_resubmission')
  )
  EXECUTE FUNCTION public.notify_submission_reviewed();
