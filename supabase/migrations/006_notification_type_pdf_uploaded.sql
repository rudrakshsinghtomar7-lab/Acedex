-- ============================================================================
-- Acedex — notification_type 'pdf_uploaded'
-- ============================================================================
-- Adds the enum value that migration 007's notify_pdf_uploaded trigger
-- inserts. 'pdf_comment' was already added by the canonical migration 005
-- (005_pdf_comments_highlights.sql); the IF NOT EXISTS guard makes this safe
-- to re-apply.
--
-- Kept as a standalone migration because Postgres requires the ALTER TYPE
-- ADD VALUE transaction to commit before the new label can be referenced as
-- a literal in subsequent SQL inside the same migration file when SQL-level
-- (non-plpgsql) statements need it. Splitting also lets us roll forward the
-- enum without re-running the trigger replacement.
-- ============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pdf_uploaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pdf_comment';
