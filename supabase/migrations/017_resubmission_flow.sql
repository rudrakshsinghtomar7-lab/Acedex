-- ============================================================================
-- Acedex — Feature 7 Phase 3: resubmission flow
-- ============================================================================
-- Adds two submission_status values:
--   under_review       — a resubmission pending re-grade
--   resubmit_requested — prof verdict asking the student for a new version
-- Wires existing notification triggers to fire on the new states. No
-- schema columns added: submissions.version + per-row feedback already
-- give version history with per-version feedback (each resubmit is a
-- new INSERT, never an update-in-place).
--
-- needs_resubmission is left in place as a back-compat alias — old rows +
-- client-side code keep working; new code emits resubmit_requested.
--
-- The grade-privacy boundary from migration 016 is untouched — no
-- assignment_assignees policy changes here.
-- ============================================================================

ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'resubmit_requested';

-- Allow 'under_review' through the submission_received notification gate so
-- resubmissions (which insert at status='under_review') still ping the prof.
-- Title switches to "Resubmission" when version > 1.
CREATE OR REPLACE FUNCTION public.notify_submission_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _course_professor_id uuid;
  _assignment_title    text;
  _assignment_owner    uuid;
  _submitter_name      text;
BEGIN
  IF NEW.status::text NOT IN (
    'submitted','under_review','approved','rejected',
    'needs_resubmission','resubmit_requested','reviewed'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.title, a.owner_id, c.professor_id INTO
    _assignment_title, _assignment_owner, _course_professor_id
  FROM public.assignments a
  JOIN public.teams    t ON t.id = a.team_id
  JOIN public.courses  c ON c.id = t.course_id
  WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _submitter_name
  FROM public.profiles WHERE id = NEW.submitter_id;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  SELECT DISTINCT
    r.recipient_id,
    'submission_received'::notification_type,
    CASE WHEN NEW.version > 1 THEN 'Resubmission' ELSE 'New submission' END,
    COALESCE(_submitter_name, 'A student')
      || ' submitted v' || NEW.version::text || ' for "'
      || COALESCE(_assignment_title, 'an assignment') || '".',
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.assignment_id
  FROM (
    SELECT _course_professor_id AS recipient_id WHERE _course_professor_id IS NOT NULL
    UNION
    SELECT _assignment_owner    AS recipient_id WHERE _assignment_owner    IS NOT NULL
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> NEW.submitter_id;

  RETURN NEW;
END;
$$;

-- Add resubmit_requested branch to the verdict CASE.
CREATE OR REPLACE FUNCTION public.notify_submission_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assignment_title text;
  _max_points       numeric;
  _reviewer_name    text;
  _verdict          text;
  _grade            text;
  _snippet          text;
BEGIN
  SELECT a.title, a.max_points INTO _assignment_title, _max_points
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _reviewer_name
  FROM public.profiles WHERE id = NEW.reviewed_by;

  _verdict := CASE NEW.status::text
    WHEN 'approved'           THEN 'approved'
    WHEN 'rejected'           THEN 'rejected'
    WHEN 'needs_resubmission' THEN 'needs a resubmission'
    WHEN 'resubmit_requested' THEN 'needs a resubmission'
    ELSE NEW.status::text
  END;

  _grade := CASE
    WHEN NEW.letter_grade IS NOT NULL AND NEW.points_awarded IS NOT NULL AND _max_points IS NOT NULL
      THEN ' · ' || NEW.letter_grade || ' (' || NEW.points_awarded::text || '/' || _max_points::text || ')'
    WHEN NEW.letter_grade IS NOT NULL
      THEN ' · ' || NEW.letter_grade
    ELSE ''
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
  ) VALUES (
    NEW.submitter_id,
    'submission_reviewed'::notification_type,
    'Submission ' || _verdict,
    COALESCE(_reviewer_name, 'Your professor')
      || ' ' || _verdict || ' your submission for "'
      || COALESCE(_assignment_title, 'an assignment') || '"' || _grade || _snippet,
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.assignment_id
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger so its WHEN clause covers resubmit_requested too.
-- The clause casts to text, so it works in the same migration without
-- needing the new enum value to be committed first.
DROP TRIGGER IF EXISTS on_submission_reviewed ON public.submissions;
CREATE TRIGGER on_submission_reviewed
  AFTER UPDATE OF status ON public.submissions
  FOR EACH ROW
  WHEN (
    (OLD.status IS DISTINCT FROM NEW.status)
    AND (NEW.status::text IN ('approved','rejected','needs_resubmission','resubmit_requested'))
  )
  EXECUTE FUNCTION notify_submission_reviewed();
