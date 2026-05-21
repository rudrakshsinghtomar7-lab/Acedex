-- ============================================================================
-- Acedex — Feature 7 PR E: assignment notifications
-- ============================================================================
-- Existing enum values (kept): assignment_created, submission_received,
-- submission_reviewed. New: subtask_assigned, deadline_reminder.
--
-- Triggers in this migration:
--   notify_assignment_created  (refreshed)  — broadcasts only when the
--     parent is a team assignment. For individual-mode assignments we
--     wait for the assignee join rows to land and notify each assignee
--     individually via notify_assignment_assignee_added. This avoids the
--     "trigger fires before assignment_assignees inserts arrive" race.
--   notify_assignment_assignee_added  (new) — fires on INSERT into
--     assignment_assignees; notifies that student.
--   notify_subtask_assigned  (new) — fires on UPDATE of assignment_subtasks
--     when assigned_to transitions from NULL → uuid OR uuid → different uuid.
--     Covers both leader-assigns and self-pick flows.
--   notify_submission_received  (new) — on INSERT into submissions; notifies
--     the course professor + the assignment owner (deduped).
--   notify_submission_reviewed  (refreshed) — adds the letter grade and
--     points to the body when set, alongside the existing feedback snippet.
--
-- deadline_reminder is added to the enum for completeness — actual rows
-- will be written by a future scheduled job / Edge Function, not by a DB
-- trigger (there's no INSERT/UPDATE event to hook into for a clock-driven
-- reminder).
-- ============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subtask_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deadline_reminder';

-- --- notify_assignment_created (refreshed) ---------------------------------

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
  -- Individual-mode assignments wait for the assignee join rows; the per-row
  -- notify_assignment_assignee_added trigger handles those.
  IF NEW.assignment_type = 'individual' THEN
    RETURN NEW;
  END IF;

  SELECT t.name, c.professor_id
    INTO _team_name, _course_professor_id
  FROM public.teams t
  JOIN public.courses c ON c.id = t.course_id
  WHERE t.id = NEW.team_id;

  IF _team_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _creator_name
  FROM public.profiles WHERE id = NEW.owner_id;

  _due := CASE
    WHEN NEW.due_at IS NOT NULL THEN ' (due ' || to_char(NEW.due_at, 'Mon DD') || ')'
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
    SELECT tm.profile_id AS recipient_id FROM public.team_members tm WHERE tm.team_id = NEW.team_id
    UNION
    SELECT _course_professor_id AS recipient_id WHERE _course_professor_id IS NOT NULL
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> COALESCE(NEW.owner_id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;

-- --- notify_assignment_assignee_added (individual-mode fan-out) ------------

CREATE OR REPLACE FUNCTION public.notify_assignment_assignee_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _team_name text;
  _assignment_title text;
  _creator_name text;
  _owner_id uuid;
  _due text;
BEGIN
  SELECT a.team_id, a.title, a.owner_id, a.due_at INTO
    _team_id, _assignment_title, _owner_id, _due
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF _team_id IS NULL OR NEW.student_id = _owner_id THEN
    RETURN NEW;
  END IF;

  SELECT t.name INTO _team_name FROM public.teams t WHERE t.id = _team_id;
  SELECT full_name INTO _creator_name FROM public.profiles WHERE id = _owner_id;

  -- Due-date suffix built from the assignments row (re-fetch to avoid a
  -- second SELECT INTO collision with _due above).
  SELECT CASE
    WHEN a.due_at IS NOT NULL THEN ' (due ' || to_char(a.due_at, 'Mon DD') || ')'
    ELSE ''
  END INTO _due FROM public.assignments a WHERE a.id = NEW.assignment_id;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  VALUES (
    NEW.student_id,
    'assignment_created'::notification_type,
    'New assignment',
    COALESCE(_creator_name, 'Your professor')
      || ' assigned you "' || COALESCE(_assignment_title, 'an assignment')
      || '" in ' || COALESCE(_team_name, 'your project') || _due || '.',
    '/projects/' || _team_id::text,
    _team_id,
    NEW.assignment_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_assignment_assignee_inserted ON public.assignment_assignees;
CREATE TRIGGER on_assignment_assignee_inserted
  AFTER INSERT ON public.assignment_assignees
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_assignee_added();

-- --- notify_subtask_assigned -----------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_subtask_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _assignment_title text;
  _assigner_name text;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF NEW.assigned_to = NEW.assigned_by THEN RETURN NEW; END IF; -- self-claim won't ping the claimer

  SELECT a.team_id, a.title INTO _team_id, _assignment_title
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF _team_id IS NULL THEN RETURN NEW; END IF;

  SELECT full_name INTO _assigner_name
  FROM public.profiles
  WHERE id = COALESCE(NEW.assigned_by, NEW.assigned_to);

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  VALUES (
    NEW.assigned_to,
    'subtask_assigned'::notification_type,
    'You picked up a subtask',
    COALESCE(_assigner_name, 'A teammate')
      || ' assigned you "' || COALESCE(NEW.title, 'a subtask')
      || '" on ' || COALESCE(_assignment_title, 'an assignment') || '.',
    '/projects/' || _team_id::text,
    _team_id,
    NEW.assignment_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subtask_assigned_to_change ON public.assignment_subtasks;
CREATE TRIGGER on_subtask_assigned_to_change
  AFTER UPDATE OF assigned_to ON public.assignment_subtasks
  FOR EACH ROW
  WHEN (
    NEW.assigned_to IS NOT NULL
    AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
  )
  EXECUTE FUNCTION public.notify_subtask_assigned();

-- --- notify_submission_received --------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_submission_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _course_professor_id uuid;
  _assignment_title text;
  _assignment_owner uuid;
  _submitter_name text;
BEGIN
  -- Drafts don't ping anyone.
  IF NEW.status::text NOT IN ('submitted','approved','rejected','needs_resubmission','reviewed') THEN
    RETURN NEW;
  END IF;

  SELECT a.title, a.owner_id, c.professor_id INTO
    _assignment_title, _assignment_owner, _course_professor_id
  FROM public.assignments a
  JOIN public.teams t ON t.id = a.team_id
  JOIN public.courses c ON c.id = t.course_id
  WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _submitter_name
  FROM public.profiles WHERE id = NEW.submitter_id;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, related_team_id, related_assignment_id
  )
  SELECT DISTINCT
    r.recipient_id,
    'submission_received'::notification_type,
    'New submission',
    COALESCE(_submitter_name, 'A student')
      || ' submitted v' || NEW.version::text || ' for "'
      || COALESCE(_assignment_title, 'an assignment') || '".',
    '/projects/' || NEW.team_id::text,
    NEW.team_id,
    NEW.assignment_id
  FROM (
    SELECT _course_professor_id AS recipient_id WHERE _course_professor_id IS NOT NULL
    UNION
    SELECT _assignment_owner   AS recipient_id WHERE _assignment_owner   IS NOT NULL
  ) r
  WHERE r.recipient_id IS NOT NULL
    AND r.recipient_id <> NEW.submitter_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_inserted ON public.submissions;
CREATE TRIGGER on_submission_inserted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_submission_received();

-- --- notify_submission_reviewed (refresh: add grade + points to body) ------

CREATE OR REPLACE FUNCTION public.notify_submission_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _assignment_title text;
  _max_points numeric;
  _reviewer_name text;
  _verdict text;
  _grade text;
  _snippet text;
BEGIN
  SELECT a.title, a.max_points INTO _assignment_title, _max_points
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO _reviewer_name
  FROM public.profiles WHERE id = NEW.reviewed_by;

  _verdict := CASE NEW.status::text
    WHEN 'approved'           THEN 'approved'
    WHEN 'rejected'           THEN 'rejected'
    WHEN 'needs_resubmission' THEN 'needs a resubmission'
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
  )
  VALUES (
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
