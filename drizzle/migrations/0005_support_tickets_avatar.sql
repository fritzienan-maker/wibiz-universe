-- 0005: user avatar + support tickets
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. User avatar URL
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  subject        varchar(255) NOT NULL,
  category       varchar(100),
  message        text NOT NULL,
  priority       varchar(20) NOT NULL DEFAULT 'normal',
  attachment_url text,
  status         varchar(20) NOT NULL DEFAULT 'open',
  ghl_forwarded  boolean NOT NULL DEFAULT false,
  created_at     timestamp DEFAULT now(),
  updated_at     timestamp DEFAULT now()
);
