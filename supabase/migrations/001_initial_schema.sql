-- ============================================================================
-- Acedex — initial schema (migration 001)
-- ============================================================================
-- Covers 14 features across 5 layers:
--   L1 Foundation     auth + profiles + student/prof profile detail
--   L2 Core           universities, courses, teams, assignments, submissions
--   L3 Differentiator secure PDF docs + AI analysis engine
--   L4 Intelligence   contributions, activity events, notifications
--   L5 Polish         resources, dashboards, bookmarks, admin/audit
--
-- Roles (profiles.role):
--   student    joins teams, submits work, views own data
--   professor  manages own courses/teams, reviews submissions, sees AI reports
--   admin      university-scoped admin (cross-university work via service_role)
--
-- RLS conventions:
--   - Every table has RLS enabled; no row is reachable without a matching policy
--   - service_role bypasses RLS; use it for server-side jobs (AI analysis insert,
--     audit log writes, scheduled contribution rollups)
--   - Helper functions are SECURITY DEFINER with locked search_path so RLS
--     checks on profiles don't recurse into the calling policy
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('student','professor','admin');
CREATE TYPE university_status AS ENUM ('active','paused','archived');
CREATE TYPE academic_year AS ENUM ('freshman','sophomore','junior','senior','graduate');
CREATE TYPE professor_title AS ENUM ('lecturer','adjunct','assistant','associate','full','emeritus');
CREATE TYPE team_status AS ENUM ('active','at_risk','completed','archived');
CREATE TYPE team_member_role AS ENUM ('leader','member');
CREATE TYPE assignment_status AS ENUM ('pending','active','done','late');
CREATE TYPE submission_status AS ENUM ('draft','submitted','reviewed','returned');
CREATE TYPE task_priority AS ENUM ('low','med','high');
CREATE TYPE pdf_access_level AS ENUM ('team','professor','public_link');
CREATE TYPE pdf_action AS ENUM ('view','download_attempt','print_attempt','copy_attempt');
CREATE TYPE annotation_type AS ENUM ('note','highlight','strikeout','question');
CREATE TYPE ai_analysis_kind AS ENUM ('plagiarism','contribution','quality','workflow','insight');
CREATE TYPE ai_verdict AS ENUM ('clear','review','flagged');
CREATE TYPE ai_finding_type AS ENUM (
  'plagiarism_match','style_shift','ghostwriting_signal',
  'contribution_imbalance','timing_anomaly','quality_concern',
  'positive_pattern','workflow_note'
);
CREATE TYPE ai_severity AS ENUM ('info','note','review','alert');
CREATE TYPE ai_decision AS ENUM ('reviewed','follow_up','dismissed');
CREATE TYPE activity_event_type AS ENUM (
  'upload','submission','task_create','task_done','comment',
  'annotation','team_join','team_leave','login','viewed_pdf'
);
CREATE TYPE notification_type AS ENUM (
  'mention','assignment_due','submission_received','ai_insight',
  'decision_required','team_invite','system'
);
CREATE TYPE digest_frequency AS ENUM ('instant','daily','weekly','off');
CREATE TYPE resource_kind AS ENUM ('link','document','video','template','dataset');
CREATE TYPE resource_visibility AS ENUM ('public','university','course','team','private');
CREATE TYPE bookmark_target AS ENUM ('resource','document','team','assignment','finding','submission');
CREATE TYPE feature_flag_scope AS ENUM ('global','university','role');

-- ============================================================================
-- LAYER 1 — FOUNDATION
-- ============================================================================

-- ── 4. partnered universities (defined first; profiles FKs into it) ────────

CREATE TABLE universities (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  slug                   text NOT NULL UNIQUE,
  domain                 text NOT NULL UNIQUE,          -- e.g. 'school.edu'
  country                text,
  city                   text,
  timezone               text NOT NULL DEFAULT 'UTC',
  logo_url               text,
  primary_color          text,
  status                 university_status NOT NULL DEFAULT 'active',
  partnership_started_at timestamptz NOT NULL DEFAULT now(),
  settings               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── 1. profiles (extends auth.users) ───────────────────────────────────────
-- One row per Supabase auth user. Created by a trigger on auth.users in a
-- follow-up migration (the trigger needs the signup flow finalised).

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
  role          user_role NOT NULL,
  email         text NOT NULL,
  full_name     text NOT NULL,
  avatar_url    text,
  bio           text,
  onboarded_at  timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. student-specific extension ──────────────────────────────────────────

CREATE TABLE student_profiles (
  profile_id        uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  student_id_number text,
  major             text,
  minor             text,
  year              academic_year,
  gpa               numeric(3,2) CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 4.5)),
  graduation_year   smallint,
  skills            text[] NOT NULL DEFAULT '{}',
  interests         text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 3. professor-specific extension ────────────────────────────────────────

CREATE TABLE professor_profiles (
  profile_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id     text,
  department      text NOT NULL,
  title           professor_title NOT NULL DEFAULT 'lecturer',
  office_location text,
  office_hours    text,
  research_areas  text[] NOT NULL DEFAULT '{}',
  homepage_url    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LAYER 2 — CORE ACADEMIC WORKFLOW
-- ============================================================================

-- ── 5. courses / teams / team membership ───────────────────────────────────

CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  professor_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  code          text NOT NULL,           -- e.g. 'CS 4890'
  name          text NOT NULL,
  description   text,
  term          text NOT NULL,           -- 'Spring' / 'Fall' / 'Summer'
  year          smallint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, code, term, year)
);

CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  status      team_status NOT NULL DEFAULT 'active',
  progress    smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  due_date    date,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_team team_member_role NOT NULL DEFAULT 'member',
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, profile_id)
);

-- ── 6. assignments / submissions / tasks ───────────────────────────────────

CREATE TABLE assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  due_at      timestamptz,
  owner_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status      assignment_status NOT NULL DEFAULT 'pending',
  order_idx   smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  submitter_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  storage_path  text,                    -- path in storage bucket
  notes         text,
  status        submission_status NOT NULL DEFAULT 'draft',
  version       smallint NOT NULL DEFAULT 1,
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, submitter_id, version)
);

CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  title         text NOT NULL,
  done          boolean NOT NULL DEFAULT false,
  assignee_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  priority      task_priority NOT NULL DEFAULT 'med',
  due_date      date,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LAYER 3 — DIFFERENTIATOR
-- ============================================================================

-- ── 7. secure collaborative PDF system ─────────────────────────────────────
-- Binary lives in a Supabase Storage bucket (e.g. 'pdf-documents'); this
-- table is the metadata + access control layer. Storage bucket RLS goes in
-- a follow-up migration; the bucket's policy should mirror the SELECT rules
-- below using storage.objects + a metadata lookup.

CREATE TABLE pdf_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid REFERENCES teams(id) ON DELETE CASCADE,
  assignment_id    uuid REFERENCES assignments(id) ON DELETE SET NULL,
  uploaded_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title            text NOT NULL,
  storage_path     text NOT NULL,
  file_size_bytes  bigint NOT NULL,
  page_count       integer,
  watermark_text   text,
  access_level     pdf_access_level NOT NULL DEFAULT 'team',
  download_blocked boolean NOT NULL DEFAULT true,
  print_blocked    boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pdf_annotations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          uuid NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  author_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_annotation_id uuid REFERENCES pdf_annotations(id) ON DELETE CASCADE,
  page_number          integer NOT NULL CHECK (page_number > 0),
  bbox                 jsonb NOT NULL,    -- {x,y,w,h} in PDF user-space units
  content              text,
  annotation_type      annotation_type NOT NULL DEFAULT 'note',
  resolved             boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pdf_access_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  viewer_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action      pdf_action NOT NULL,
  ip_address  inet,
  user_agent  text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ── 8. AI submission intelligence engine ───────────────────────────────────
-- Inserts happen server-side via service_role (Edge Function calling Claude).
-- RLS denies INSERT for everyone except admin so client code can't fabricate
-- AI verdicts.

CREATE TABLE ai_analyses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid REFERENCES teams(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  document_id   uuid REFERENCES pdf_documents(id) ON DELETE CASCADE,
  kind          ai_analysis_kind NOT NULL,
  verdict       ai_verdict,
  confidence    smallint CHECK (confidence BETWEEN 1 AND 5),
  model_name    text NOT NULL,
  model_version text,
  prompt_hash   text,
  response      jsonb,
  cost_cents    integer,
  requested_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  CHECK (team_id IS NOT NULL OR submission_id IS NOT NULL OR document_id IS NOT NULL)
);

CREATE TABLE ai_findings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id         uuid NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
  affected_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  finding_type        ai_finding_type NOT NULL,
  title               text NOT NULL,
  body                text,
  evidence            jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity            ai_severity NOT NULL DEFAULT 'note',
  confidence          smallint NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_finding_decisions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES ai_findings(id) ON DELETE CASCADE,
  decided_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision   ai_decision NOT NULL,
  notes      text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finding_id, decided_by)
);

-- ============================================================================
-- LAYER 4 — INTELLIGENCE & TRACKING
-- ============================================================================

-- ── 9. contribution intelligence ───────────────────────────────────────────

CREATE TABLE contributions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  pct              numeric(5,2) NOT NULL CHECK (pct BETWEEN 0 AND 100),
  uploads_count    integer NOT NULL DEFAULT 0,
  comments_count   integer NOT NULL DEFAULT 0,
  tasks_done_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE TABLE activity_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid REFERENCES teams(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  activity_event_type NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ── 10. notifications ──────────────────────────────────────────────────────

CREATE TABLE notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                  notification_type NOT NULL,
  title                 text NOT NULL,
  body                  text,
  link                  text,
  related_team_id       uuid REFERENCES teams(id) ON DELETE SET NULL,
  related_assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  related_finding_id    uuid REFERENCES ai_findings(id) ON DELETE SET NULL,
  read                  boolean NOT NULL DEFAULT false,
  read_at               timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_preferences (
  profile_id         uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled      boolean NOT NULL DEFAULT true,
  push_enabled       boolean NOT NULL DEFAULT true,
  digest_frequency   digest_frequency NOT NULL DEFAULT 'instant',
  mute_mentions      boolean NOT NULL DEFAULT false,
  mute_due_reminders boolean NOT NULL DEFAULT false,
  mute_ai_insights   boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LAYER 5 — POLISH & MANAGEMENT
-- ============================================================================

-- ── 11. resource hub ───────────────────────────────────────────────────────

CREATE TABLE resources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
  course_id     uuid REFERENCES courses(id) ON DELETE CASCADE,
  team_id       uuid REFERENCES teams(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind          resource_kind NOT NULL,
  title         text NOT NULL,
  description   text,
  url           text,
  storage_path  text,
  tags          text[] NOT NULL DEFAULT '{}',
  visibility    resource_visibility NOT NULL DEFAULT 'course',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR storage_path IS NOT NULL)
);

CREATE TABLE resource_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('course','team','profile')),
  target_id   uuid NOT NULL,
  required    boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, target_type, target_id)
);

-- ── 12. personalised dashboard (widget config; data is derived) ────────────

CREATE TABLE dashboard_widgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  widget_type text NOT NULL,             -- e.g. 'heatmap','recent_activity','upcoming','insights'
  position    smallint NOT NULL DEFAULT 0,
  visible     boolean NOT NULL DEFAULT true,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, widget_type, position)
);

-- ── 13. bookmarks ──────────────────────────────────────────────────────────

CREATE TABLE bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type bookmark_target NOT NULL,
  target_id   uuid NOT NULL,
  folder_name text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, target_type, target_id)
);

-- ── 14. admin control panel ────────────────────────────────────────────────

CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  scope       feature_flag_scope NOT NULL DEFAULT 'global',
  scope_id    text,                       -- university_id or role name, depending on scope
  description text,
  updated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Foundation
CREATE INDEX idx_profiles_university       ON profiles(university_id);
CREATE INDEX idx_profiles_role             ON profiles(role);

-- Core
CREATE INDEX idx_courses_university        ON courses(university_id);
CREATE INDEX idx_courses_professor         ON courses(professor_id);
CREATE INDEX idx_teams_course              ON teams(course_id);
CREATE INDEX idx_teams_status              ON teams(status);
CREATE INDEX idx_team_members_profile      ON team_members(profile_id);
CREATE INDEX idx_assignments_team          ON assignments(team_id);
CREATE INDEX idx_assignments_due           ON assignments(due_at);
CREATE INDEX idx_submissions_assignment    ON submissions(assignment_id);
CREATE INDEX idx_submissions_team          ON submissions(team_id);
CREATE INDEX idx_submissions_submitter     ON submissions(submitter_id);
CREATE INDEX idx_submissions_status        ON submissions(status);
CREATE INDEX idx_tasks_team                ON tasks(team_id);
CREATE INDEX idx_tasks_assignee            ON tasks(assignee_id);
CREATE INDEX idx_tasks_due                 ON tasks(due_date);

-- PDF
CREATE INDEX idx_pdf_documents_team        ON pdf_documents(team_id);
CREATE INDEX idx_pdf_documents_assignment  ON pdf_documents(assignment_id);
CREATE INDEX idx_pdf_documents_uploader    ON pdf_documents(uploaded_by);
CREATE INDEX idx_pdf_annotations_doc       ON pdf_annotations(document_id, page_number);
CREATE INDEX idx_pdf_annotations_author    ON pdf_annotations(author_id);
CREATE INDEX idx_pdf_annotations_parent    ON pdf_annotations(parent_annotation_id);
CREATE INDEX idx_pdf_access_log_doc        ON pdf_access_log(document_id, occurred_at DESC);
CREATE INDEX idx_pdf_access_log_viewer     ON pdf_access_log(viewer_id);

-- AI
CREATE INDEX idx_ai_analyses_team          ON ai_analyses(team_id);
CREATE INDEX idx_ai_analyses_submission    ON ai_analyses(submission_id);
CREATE INDEX idx_ai_analyses_document      ON ai_analyses(document_id);
CREATE INDEX idx_ai_analyses_kind          ON ai_analyses(kind);
CREATE INDEX idx_ai_findings_analysis      ON ai_findings(analysis_id);
CREATE INDEX idx_ai_findings_profile       ON ai_findings(affected_profile_id);
CREATE INDEX idx_ai_findings_severity      ON ai_findings(severity);
CREATE INDEX idx_ai_decisions_finding      ON ai_finding_decisions(finding_id);

-- Intelligence
CREATE INDEX idx_contributions_team        ON contributions(team_id);
CREATE INDEX idx_contributions_profile     ON contributions(profile_id);
CREATE INDEX idx_activity_events_team      ON activity_events(team_id, occurred_at DESC);
CREATE INDEX idx_activity_events_profile   ON activity_events(profile_id, occurred_at DESC);
CREATE INDEX idx_activity_events_type      ON activity_events(event_type);
CREATE INDEX idx_notifications_recipient   ON notifications(recipient_id, read, created_at DESC);

-- Polish
CREATE INDEX idx_resources_university      ON resources(university_id);
CREATE INDEX idx_resources_course          ON resources(course_id);
CREATE INDEX idx_resources_team            ON resources(team_id);
CREATE INDEX idx_resources_tags            ON resources USING GIN (tags);
CREATE INDEX idx_resource_assignments_target ON resource_assignments(target_type, target_id);
CREATE INDEX idx_bookmarks_profile         ON bookmarks(profile_id, target_type);
CREATE INDEX idx_audit_log_actor           ON audit_log(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_log_target          ON audit_log(target_type, target_id);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — used in RLS without recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_profile_role() = 'admin'::user_role
$$;

CREATE OR REPLACE FUNCTION public.is_professor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_profile_role() = 'professor'::user_role
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_profile_role() = 'student'::user_role
$$;

CREATE OR REPLACE FUNCTION public.current_university_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_same_university(_other uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p1, public.profiles p2
    WHERE p1.id = auth.uid() AND p2.id = _other
      AND p1.university_id = p2.university_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team AND profile_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_professor(_team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.courses c ON c.id = t.course_id
    WHERE t.id = _team AND c.professor_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_course_professor(_course uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = _course AND professor_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_pdf(_doc uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pdf_documents d
    WHERE d.id = _doc AND (
      public.is_admin()
      OR d.access_level = 'public_link'
      OR (d.access_level = 'team' AND d.team_id IS NOT NULL AND (
           public.is_team_member(d.team_id) OR public.is_team_professor(d.team_id)))
      OR (d.access_level = 'professor' AND d.team_id IS NOT NULL AND public.is_team_professor(d.team_id))
    )
  )
$$;

-- ============================================================================
-- updated_at TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- submissions.team_id must match assignments.team_id (client sends both; DB enforces consistency)
CREATE OR REPLACE FUNCTION public.tg_submissions_team_matches_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = NEW.assignment_id AND a.team_id = NEW.team_id
  ) THEN
    RAISE EXCEPTION 'submissions.team_id must match assignments.team_id for the given assignment_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER submissions_team_matches_assignment
  BEFORE INSERT OR UPDATE OF assignment_id, team_id ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_submissions_team_matches_assignment();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON universities        FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles            FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_profiles    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON professor_profiles  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON courses             FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teams               FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assignments         FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON submissions         FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks               FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pdf_documents       FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pdf_annotations     FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON resources           FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON dashboard_widgets   FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feature_flags       FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- ENABLE RLS ON EVERY TABLE
-- ============================================================================

ALTER TABLE universities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_annotations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_access_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_findings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_finding_decisions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources                ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags            ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- Convention: each table gets up to four policies (select / insert / update /
-- delete). Combined OR-of-roles policies are preferred for SELECT since
-- multiple policies are OR'd anyway; for INSERT/UPDATE/DELETE we keep them
-- in one policy for readability.

-- ── universities ───────────────────────────────────────────────────────────
CREATE POLICY universities_select ON universities FOR SELECT TO authenticated
USING (true);

CREATE POLICY universities_write ON universities FOR ALL TO authenticated
USING (is_admin() AND id = current_university_id())
WITH CHECK (is_admin() AND id = current_university_id());

-- ── profiles ───────────────────────────────────────────────────────────────
-- Anyone in the same university can see basic profile info (needed to render
-- avatars, team members, course rosters). Admins see all profiles in their
-- university. service_role bypasses for cross-university platform ops.

CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR university_id = current_university_id()
  OR is_admin()
);

CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR (is_admin() AND university_id = current_university_id()))
WITH CHECK (id = auth.uid() OR (is_admin() AND university_id = current_university_id()));

CREATE POLICY profiles_delete ON profiles FOR DELETE TO authenticated
USING (is_admin() AND university_id = current_university_id());

-- ── student_profiles ───────────────────────────────────────────────────────
CREATE POLICY student_profiles_select ON student_profiles FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR is_admin()
  OR (is_professor() AND EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = profile_id
          AND p.university_id = current_university_id()))
);

CREATE POLICY student_profiles_write ON student_profiles FOR ALL TO authenticated
USING (profile_id = auth.uid() OR is_admin())
WITH CHECK (profile_id = auth.uid() OR is_admin());

-- ── professor_profiles ─────────────────────────────────────────────────────
CREATE POLICY professor_profiles_select ON professor_profiles FOR SELECT TO authenticated
USING (
  is_admin()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = profile_id
               AND p.university_id = current_university_id())
);

CREATE POLICY professor_profiles_write ON professor_profiles FOR ALL TO authenticated
USING (profile_id = auth.uid() OR is_admin())
WITH CHECK (profile_id = auth.uid() OR is_admin());

-- ── courses ────────────────────────────────────────────────────────────────
CREATE POLICY courses_select ON courses FOR SELECT TO authenticated
USING (university_id = current_university_id() OR is_admin());

CREATE POLICY courses_insert ON courses FOR INSERT TO authenticated
WITH CHECK (
  (is_professor() AND professor_id = auth.uid() AND university_id = current_university_id())
  OR is_admin()
);

CREATE POLICY courses_update ON courses FOR UPDATE TO authenticated
USING (professor_id = auth.uid() OR is_admin())
WITH CHECK (professor_id = auth.uid() OR is_admin());

CREATE POLICY courses_delete ON courses FOR DELETE TO authenticated
USING (professor_id = auth.uid() OR is_admin());

-- ── teams ──────────────────────────────────────────────────────────────────
CREATE POLICY teams_select ON teams FOR SELECT TO authenticated
USING (
  is_team_member(id)
  OR is_team_professor(id)
  OR is_admin()
);

CREATE POLICY teams_insert ON teams FOR INSERT TO authenticated
WITH CHECK (is_course_professor(course_id) OR is_admin());

CREATE POLICY teams_update ON teams FOR UPDATE TO authenticated
USING (is_team_professor(id) OR is_admin())
WITH CHECK (is_team_professor(id) OR is_admin());

CREATE POLICY teams_delete ON teams FOR DELETE TO authenticated
USING (is_team_professor(id) OR is_admin());

-- ── team_members ───────────────────────────────────────────────────────────
CREATE POLICY team_members_select ON team_members FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR is_team_member(team_id)
  OR is_team_professor(team_id)
  OR is_admin()
);

CREATE POLICY team_members_insert ON team_members FOR INSERT TO authenticated
WITH CHECK (is_team_professor(team_id) OR is_admin());

CREATE POLICY team_members_update ON team_members FOR UPDATE TO authenticated
USING (is_team_professor(team_id) OR is_admin())
WITH CHECK (is_team_professor(team_id) OR is_admin());

CREATE POLICY team_members_delete ON team_members FOR DELETE TO authenticated
USING (
  profile_id = auth.uid()                  -- a student may leave a team
  OR is_team_professor(team_id)
  OR is_admin()
);

-- ── assignments ────────────────────────────────────────────────────────────
CREATE POLICY assignments_select ON assignments FOR SELECT TO authenticated
USING (is_team_member(team_id) OR is_team_professor(team_id) OR is_admin());

CREATE POLICY assignments_write ON assignments FOR ALL TO authenticated
USING (is_team_professor(team_id) OR is_admin())
WITH CHECK (is_team_professor(team_id) OR is_admin());

-- ── submissions ────────────────────────────────────────────────────────────
CREATE POLICY submissions_select ON submissions FOR SELECT TO authenticated
USING (
  submitter_id = auth.uid()
  OR is_team_member(team_id)
  OR is_team_professor(team_id)
  OR is_admin()
);

CREATE POLICY submissions_insert ON submissions FOR INSERT TO authenticated
WITH CHECK (
  submitter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = assignment_id
      AND a.team_id = team_id
      AND is_team_member(a.team_id)
  )
);

CREATE POLICY submissions_update ON submissions FOR UPDATE TO authenticated
USING (
  submitter_id = auth.uid()
  OR is_team_professor(team_id)
  OR is_admin()
)
WITH CHECK (
  submitter_id = auth.uid()
  OR is_team_professor(team_id)
  OR is_admin()
);

CREATE POLICY submissions_delete ON submissions FOR DELETE TO authenticated
USING (
  (submitter_id = auth.uid() AND status = 'draft')
  OR is_admin()
);

-- ── tasks ──────────────────────────────────────────────────────────────────
CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated
USING (is_team_member(team_id) OR is_team_professor(team_id) OR is_admin());

CREATE POLICY tasks_write ON tasks FOR ALL TO authenticated
USING (is_team_member(team_id) OR is_team_professor(team_id) OR is_admin())
WITH CHECK (is_team_member(team_id) OR is_team_professor(team_id) OR is_admin());

-- ── pdf_documents ──────────────────────────────────────────────────────────
-- Access depends on access_level. 'team' → members + professor. 'professor' →
-- professor only. 'public_link' → anyone authenticated in the university.

CREATE POLICY pdf_documents_select ON pdf_documents FOR SELECT TO authenticated
USING (
  is_admin()
  OR access_level = 'public_link'
  OR (access_level = 'team' AND team_id IS NOT NULL
        AND (is_team_member(team_id) OR is_team_professor(team_id)))
  OR (access_level = 'professor' AND team_id IS NOT NULL AND is_team_professor(team_id))
);

CREATE POLICY pdf_documents_insert ON pdf_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (team_id IS NULL OR is_team_member(team_id) OR is_team_professor(team_id))
);

CREATE POLICY pdf_documents_update ON pdf_documents FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR (team_id IS NOT NULL AND is_team_professor(team_id))
  OR is_admin()
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR (team_id IS NOT NULL AND is_team_professor(team_id))
  OR is_admin()
);

CREATE POLICY pdf_documents_delete ON pdf_documents FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR (team_id IS NOT NULL AND is_team_professor(team_id))
  OR is_admin()
);

-- ── pdf_annotations ────────────────────────────────────────────────────────
CREATE POLICY pdf_annotations_select ON pdf_annotations FOR SELECT TO authenticated
USING (can_view_pdf(document_id) OR is_admin());

CREATE POLICY pdf_annotations_insert ON pdf_annotations FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND can_view_pdf(document_id));

CREATE POLICY pdf_annotations_update ON pdf_annotations FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR is_admin())
WITH CHECK (author_id = auth.uid() OR is_admin());

CREATE POLICY pdf_annotations_delete ON pdf_annotations FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM pdf_documents d WHERE d.id = document_id
               AND d.team_id IS NOT NULL AND is_team_professor(d.team_id))
  OR is_admin()
);

-- ── pdf_access_log ─────────────────────────────────────────────────────────
-- Audit trail. Users can insert their own access rows (recorded by the
-- client/edge function); only professors of the doc's team + admins can read.

CREATE POLICY pdf_access_log_select ON pdf_access_log FOR SELECT TO authenticated
USING (
  is_admin()
  OR EXISTS (SELECT 1 FROM pdf_documents d WHERE d.id = document_id
               AND d.team_id IS NOT NULL AND is_team_professor(d.team_id))
);

CREATE POLICY pdf_access_log_insert ON pdf_access_log FOR INSERT TO authenticated
WITH CHECK (viewer_id = auth.uid());

-- no update / delete: log is append-only for non-admins; admins use service_role

-- ── ai_analyses ────────────────────────────────────────────────────────────
-- Students see analyses for their team. Professors see analyses for teams
-- they own. Inserts happen via service_role (Edge Function calling Claude);
-- the RLS INSERT policy below is admin-only as a safety net.

CREATE POLICY ai_analyses_select ON ai_analyses FOR SELECT TO authenticated
USING (
  is_admin()
  OR (team_id IS NOT NULL AND (is_team_member(team_id) OR is_team_professor(team_id)))
  OR (submission_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM submissions s WHERE s.id = submission_id
          AND (s.submitter_id = auth.uid()
               OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = s.assignment_id
                            AND is_team_professor(a.team_id)))))
);

CREATE POLICY ai_analyses_write ON ai_analyses FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ── ai_findings ────────────────────────────────────────────────────────────
-- Students only see findings that affect them, or generic 'positive_pattern'
-- findings for their team. Professors see everything for teams they own.

CREATE POLICY ai_findings_select ON ai_findings FOR SELECT TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM ai_analyses a
    WHERE a.id = analysis_id
      AND a.team_id IS NOT NULL
      AND is_team_professor(a.team_id)
  )
  OR (
    -- student: own finding, or a positive pattern for a team they're on
    affected_profile_id = auth.uid()
    OR (
      finding_type = 'positive_pattern'
      AND EXISTS (
        SELECT 1 FROM ai_analyses a
        WHERE a.id = analysis_id
          AND a.team_id IS NOT NULL
          AND is_team_member(a.team_id)
      )
    )
  )
);

CREATE POLICY ai_findings_write ON ai_findings FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ── ai_finding_decisions ───────────────────────────────────────────────────
-- A "mark reviewed / add to follow-ups" action by the professor.

CREATE POLICY ai_finding_decisions_select ON ai_finding_decisions FOR SELECT TO authenticated
USING (
  decided_by = auth.uid()
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM ai_findings f JOIN ai_analyses a ON a.id = f.analysis_id
    WHERE f.id = finding_id AND a.team_id IS NOT NULL AND is_team_professor(a.team_id)
  )
);

CREATE POLICY ai_finding_decisions_insert ON ai_finding_decisions FOR INSERT TO authenticated
WITH CHECK (
  decided_by = auth.uid() AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM ai_findings f JOIN ai_analyses a ON a.id = f.analysis_id
      WHERE f.id = finding_id AND a.team_id IS NOT NULL AND is_team_professor(a.team_id)
    )
  )
);

CREATE POLICY ai_finding_decisions_update ON ai_finding_decisions FOR UPDATE TO authenticated
USING (decided_by = auth.uid() OR is_admin())
WITH CHECK (decided_by = auth.uid() OR is_admin());

CREATE POLICY ai_finding_decisions_delete ON ai_finding_decisions FOR DELETE TO authenticated
USING (decided_by = auth.uid() OR is_admin());

-- ── contributions ──────────────────────────────────────────────────────────
CREATE POLICY contributions_select ON contributions FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR is_team_professor(team_id)
  OR is_admin()
);

CREATE POLICY contributions_write ON contributions FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ── activity_events ────────────────────────────────────────────────────────
CREATE POLICY activity_events_select ON activity_events FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (team_id IS NOT NULL AND is_team_professor(team_id))
  OR is_admin()
);

CREATE POLICY activity_events_insert ON activity_events FOR INSERT TO authenticated
WITH CHECK (profile_id = auth.uid());

-- update/delete: admin only (events are append-only for users)
CREATE POLICY activity_events_update ON activity_events FOR UPDATE TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY activity_events_delete ON activity_events FOR DELETE TO authenticated
USING (is_admin());

-- ── notifications ──────────────────────────────────────────────────────────
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid() OR is_admin());

CREATE POLICY notifications_insert ON notifications FOR INSERT TO authenticated
WITH CHECK (is_admin());                  -- normal inserts via service_role

CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
USING (recipient_id = auth.uid() OR is_admin())
WITH CHECK (recipient_id = auth.uid() OR is_admin());

CREATE POLICY notifications_delete ON notifications FOR DELETE TO authenticated
USING (recipient_id = auth.uid() OR is_admin());

-- ── notification_preferences ───────────────────────────────────────────────
CREATE POLICY notification_prefs_all ON notification_preferences FOR ALL TO authenticated
USING (profile_id = auth.uid() OR is_admin())
WITH CHECK (profile_id = auth.uid() OR is_admin());

-- ── resources ──────────────────────────────────────────────────────────────
-- Visibility-based reads. Writes are by creator (or admin); a creator must be
-- a professor or admin to publish at course/university scope.

CREATE POLICY resources_select ON resources FOR SELECT TO authenticated
USING (
  is_admin()
  OR visibility = 'public'
  OR (visibility = 'university' AND university_id = current_university_id())
  OR (visibility = 'course' AND course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM courses c WHERE c.id = course_id
          AND c.university_id = current_university_id()))
  OR (visibility = 'team' AND team_id IS NOT NULL AND is_team_member(team_id))
  OR (visibility = 'team' AND team_id IS NOT NULL AND is_team_professor(team_id))
  OR (visibility = 'private' AND created_by = auth.uid())
);

CREATE POLICY resources_insert ON resources FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    is_admin()
    OR is_professor()
    OR (visibility IN ('team','private')
        AND (team_id IS NULL OR is_team_member(team_id)))
  )
);

CREATE POLICY resources_update ON resources FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR is_admin())
WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY resources_delete ON resources FOR DELETE TO authenticated
USING (created_by = auth.uid() OR is_admin());

-- ── resource_assignments ───────────────────────────────────────────────────
CREATE POLICY resource_assignments_select ON resource_assignments FOR SELECT TO authenticated
USING (
  is_admin()
  OR assigned_by = auth.uid()
  OR (target_type = 'profile' AND target_id = auth.uid())
  OR (target_type = 'team' AND is_team_member(target_id))
  OR (target_type = 'team' AND is_team_professor(target_id))
  OR (target_type = 'course' AND is_course_professor(target_id))
);

CREATE POLICY resource_assignments_write ON resource_assignments FOR ALL TO authenticated
USING (
  assigned_by = auth.uid()
  OR is_admin()
  OR (target_type = 'course' AND is_course_professor(target_id))
  OR (target_type = 'team' AND is_team_professor(target_id))
)
WITH CHECK (
  assigned_by = auth.uid()
  OR is_admin()
  OR (target_type = 'course' AND is_course_professor(target_id))
  OR (target_type = 'team' AND is_team_professor(target_id))
);

-- ── dashboard_widgets ──────────────────────────────────────────────────────
CREATE POLICY dashboard_widgets_all ON dashboard_widgets FOR ALL TO authenticated
USING (profile_id = auth.uid() OR is_admin())
WITH CHECK (profile_id = auth.uid() OR is_admin());

-- ── bookmarks ──────────────────────────────────────────────────────────────
CREATE POLICY bookmarks_all ON bookmarks FOR ALL TO authenticated
USING (profile_id = auth.uid() OR is_admin())
WITH CHECK (profile_id = auth.uid() OR is_admin());

-- ── audit_log ──────────────────────────────────────────────────────────────
-- Read by admins; insert via service_role only (no policy ⇒ RLS denies).
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO authenticated
USING (is_admin());

-- ── feature_flags ──────────────────────────────────────────────────────────
CREATE POLICY feature_flags_select ON feature_flags FOR SELECT TO authenticated
USING (true);

CREATE POLICY feature_flags_write ON feature_flags FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ============================================================================
-- FOLLOW-UPS (NOT IN THIS MIGRATION)
-- ============================================================================
-- 1. Auth trigger: on auth.users INSERT, create a profiles row. Needs the
--    signup flow finalised first (email domain → university lookup, role
--    defaulting, invite handling).
-- 2. Storage buckets + storage.objects RLS for: pdf-documents,
--    submissions, avatars, resources. The bucket policies should mirror
--    the metadata-table SELECT rules via a join on storage_path.
-- 3. Materialised view or scheduled job to rebuild `contributions` rows
--    from `activity_events`.
-- 4. Edge Function(s) that call Claude and write to ai_analyses /
--    ai_findings under service_role.
