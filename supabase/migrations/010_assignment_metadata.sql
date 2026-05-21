-- ============================================================================
-- Acedex — Feature 7 PR C: assignment metadata for the Create flow
-- ============================================================================
-- Fields the new Create Assignment form writes. All nullable / defaulted so
-- pre-existing assignments rows keep validating.
--
--   assignment_type      → 'individual' | 'team' (drives whether the form
--                          shows the subtask + distribution layer)
--   max_points           → grade ceiling (informational for now; future PR
--                          will wire grading)
--   deadline_type        → 'hard' | 'grace' (informational; future enforcement
--                          can use this to gate submissions)
--   grace_days           → integer days past due_at still accepted when
--                          deadline_type = 'grace'
--   ai_plagiarism_check  → boolean flag; the actual check is Phase 8 (Feature
--                          8 - AI plagiarism detection). For now it's just
--                          stored so the form round-trips.
-- ============================================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type text
    CHECK (assignment_type IS NULL OR assignment_type IN ('individual', 'team'));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS max_points integer
    CHECK (max_points IS NULL OR (max_points >= 0 AND max_points <= 10000));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS deadline_type text
    CHECK (deadline_type IS NULL OR deadline_type IN ('hard', 'grace'));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS grace_days integer
    CHECK (grace_days IS NULL OR (grace_days >= 0 AND grace_days <= 60));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS ai_plagiarism_check boolean NOT NULL DEFAULT false;
