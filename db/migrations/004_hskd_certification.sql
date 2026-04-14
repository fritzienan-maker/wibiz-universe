-- ============================================================
-- HSKD ClearPath Certification Module
-- Migration: 004_hskd_certification.sql
-- DO NOT modify existing tables
-- ============================================================

-- 1. hskd_industries
CREATE TABLE IF NOT EXISTS hskd_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('TIER_0', 'TIER_1')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. hskd_scenarios
CREATE TABLE IF NOT EXISTS hskd_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES hskd_industries(id),
  scenario_number INT NOT NULL CHECK (scenario_number BETWEEN 1 AND 5),
  title VARCHAR(255) NOT NULL,
  scenario_text TEXT,
  danger_text TEXT,
  prescribed_bot_response TEXT,
  mandatory_bot_action TEXT,
  certification_prompt TEXT,
  ops_note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. hskd_prohibited_items
CREATE TABLE IF NOT EXISTS hskd_prohibited_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES hskd_industries(id),
  item_number INT NOT NULL,
  category VARCHAR(255),
  restriction_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. hskd_training_modules
CREATE TABLE IF NOT EXISTS hskd_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES hskd_industries(id),
  module_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  video_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. client_certifications
CREATE TABLE IF NOT EXISTS client_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  industry_id UUID NOT NULL REFERENCES hskd_industries(id),
  status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'PENDING_OPS_REVIEW', 'CERTIFIED', 'REJECTED')),
  training_completed_at TIMESTAMP,
  affirmation_full_name VARCHAR(255),
  affirmation_title VARCHAR(255),
  affirmation_license_type VARCHAR(100),
  affirmation_license_state VARCHAR(100),
  affirmation_license_number VARCHAR(100),
  oncall_contact_name VARCHAR(255),
  oncall_contact_phone VARCHAR(50),
  hipaa_baa_executed BOOLEAN DEFAULT FALSE,
  hipaa_baa_date DATE,
  mandatory_reporter_status VARCHAR(100),
  certificate_id VARCHAR(100) UNIQUE,
  ops_signoff_by VARCHAR(255),
  ops_signoff_at TIMESTAMP,
  specialist_mode_activated_at TIMESTAMP,
  kb_review_due_at TIMESTAMP,
  tier0_monitoring_start_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. certification_scenario_logs
CREATE TABLE IF NOT EXISTS certification_scenario_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES client_certifications(id),
  scenario_id UUID NOT NULL REFERENCES hskd_scenarios(id),
  scenario_number INT NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  logged_at TIMESTAMP DEFAULT NOW()
);

-- 7. certification_prohibited_logs
CREATE TABLE IF NOT EXISTS certification_prohibited_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES client_certifications(id),
  prohibited_item_id UUID NOT NULL REFERENCES hskd_prohibited_items(id),
  confirmed_at TIMESTAMP DEFAULT NOW()
);

-- 8. client_training_progress
CREATE TABLE IF NOT EXISTS client_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES hskd_training_modules(id),
  completed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hskd_scenarios_industry_id ON hskd_scenarios(industry_id);
CREATE INDEX IF NOT EXISTS idx_hskd_prohibited_items_industry_id ON hskd_prohibited_items(industry_id);
CREATE INDEX IF NOT EXISTS idx_hskd_training_modules_industry_id ON hskd_training_modules(industry_id);
CREATE INDEX IF NOT EXISTS idx_client_certifications_client_id ON client_certifications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_certifications_industry_id ON client_certifications(industry_id);
CREATE INDEX IF NOT EXISTS idx_client_certifications_status ON client_certifications(status);
CREATE INDEX IF NOT EXISTS idx_client_certifications_certificate_id ON client_certifications(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_scenario_logs_certification_id ON certification_scenario_logs(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_prohibited_logs_certification_id ON certification_prohibited_logs(certification_id);
CREATE INDEX IF NOT EXISTS idx_client_training_progress_client_id ON client_training_progress(client_id);
