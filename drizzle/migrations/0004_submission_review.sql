-- 0004: exercise video URLs + submission review workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New enum for submission review states
CREATE TYPE submission_status AS ENUM ('pending_review', 'approved', 'rejected');

-- 2. Video URL field on exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url text;

-- 3. Extend user_progress for the review workflow
--    Rename completed_at → submitted_at (tracks when client submitted, not approved)
ALTER TABLE user_progress RENAME COLUMN completed_at TO submitted_at;

ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS proof_image_url   text,
  ADD COLUMN IF NOT EXISTS submission_status submission_status NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewed_at       timestamp,
  ADD COLUMN IF NOT EXISTS reviewed_by       uuid,
  ADD COLUMN IF NOT EXISTS review_note       text;

-- 4. Backfill: rows that existed before this migration were already accepted
UPDATE user_progress SET submission_status = 'approved';
