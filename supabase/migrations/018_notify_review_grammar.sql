-- ============================================================================
-- Acedex — Feature 7 Phase 3 polish: notify_submission_reviewed grammar
-- ============================================================================
-- Branch the body string per verdict so the resubmit sentence no longer
-- reads "Kavya needs a resubmission your submission for X". Templates:
--   approved           → "<R> approved your submission for 'X'<grade><snippet>"
--   rejected           → "<R> rejected your submission for 'X'<grade><snippet>"
--   resubmit_requested → "<R> requested a resubmission for 'X'<snippet>"
--   needs_resubmission → same as resubmit_requested (legacy alias)
-- Title for the resubmit case becomes "Resubmission requested" so the
-- inbox is glanceable.
--
-- No schema/RLS changes — function body only.
-- ============================================================================

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
  _reviewer         text;
  _title            text;
  _body             text;
  _grade            text;
  _snippet          text;
BEGIN
  SELECT a.title, a.max_points INTO _assignment_title, _max_points
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _reviewer_name
  FROM public.profiles WHERE id = NEW.reviewed_by;

  _reviewer        := COALESCE(_reviewer_name,    'Your professor');
  _assignment_title := COALESCE(_assignment_title, 'an assignment');

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

  IF NEW.status::text IN ('needs_resubmission','resubmit_requested') THEN
    _title := 'Resubmission requested';
    _body  := _reviewer || ' requested a resubmission for "' || _assignment_title || '"' || _snippet;
  ELSIF NEW.status::text = 'approved' THEN
    _title := 'Submission approved';
    _body  := _reviewer || ' approved your submission for "' || _assignment_title || '"' || _grade || _snippet;
  ELSIF NEW.status::text = 'rejected' THEN
    _title := 'Submission rejected';
    _body  := _reviewer || ' rejected your submission for "' || _assignment_title || '"' || _grade || _snippet;
  ELSE
    -- Defensive default — keeps the trigger working if a future status
    -- slips into the WHEN allow-list without a matching branch here.
    _title := 'Submission ' || NEW.status::text;
    _body  := _reviewer || ' updated your submission for "' || _assignment_title || '"' || _grade || _snippet;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  ) VALUES (
    NEW.submitter_id,
    'submission_reviewed'::notification_type,
    _title,
    _body,
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.assignment_id
  );

  RETURN NEW;
END;
$$;
