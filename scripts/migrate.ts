/**
 * Migration runner — runs on every Railway deploy before the server starts.
 *
 *   Railway start command:  npx tsx scripts/migrate.ts && pnpm start
 *   Manual run:             npx tsx scripts/migrate.ts
 *
 * Two-step process:
 *   1. drizzle-kit generated migrations (drizzle/migrations/) via drizzle migrator
 *   2. Custom ALTER TABLE statements tracked in _custom_migrations table
 *      (append to CUSTOM_MIGRATIONS below for schema changes between releases)
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate }  from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.warn("[migrate] DATABASE_URL not set  skipping migrations - migrate.ts:23");
  process.exit(0);
}

console.log("[migrate] Script version: 2.0 HSKD - migrate.ts:27");

const CUSTOM_MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "0001_exercises_proof_prompt",
    sql:  "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS proof_prompt TEXT",
  },
  {
    name: "0002_user_progress_proof_text",
    sql:  "ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS proof_text TEXT",
  },
  {
    name: "0003_create_quiz_questions",
    sql: `CREATE TABLE IF NOT EXISTS quiz_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id UUID NOT NULL,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_answer_index INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  },
  {
    name: "0004_create_quiz_responses",
    sql: `CREATE TABLE IF NOT EXISTS quiz_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      module_id UUID NOT NULL,
      answers JSONB NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      passed BOOLEAN NOT NULL DEFAULT FALSE,
      passed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
  },
  {
    name: "0005_submission_status_enum",
    sql: `DO $$ BEGIN
      CREATE TYPE submission_status AS ENUM ('pending_review', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    name: "0006_exercises_video_url",
    sql: `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url TEXT`,
  },
  {
    name: "0007_user_progress_rename_completed_at",
    sql: `DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_progress' AND column_name = 'completed_at'
      ) THEN
        ALTER TABLE user_progress RENAME COLUMN completed_at TO submitted_at;
      END IF;
    END $$`,
  },
  {
    name: "0008_user_progress_submission_cols",
    sql: `ALTER TABLE user_progress
      ADD COLUMN IF NOT EXISTS proof_image_url    TEXT,
      ADD COLUMN IF NOT EXISTS submission_status  submission_status NOT NULL DEFAULT 'pending_review',
      ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by        UUID,
      ADD COLUMN IF NOT EXISTS review_note        TEXT`,
  },
  {
    name: "0009_backfill_submission_status_approved",
    sql: `UPDATE user_progress SET submission_status = 'approved' WHERE submission_status = 'pending_review'`,
  },
  {
    name: "0010_users_team_fields",
    sql: `ALTER TABLE users
      ADD COLUMN IF NOT EXISTS client_id         UUID,
      ADD COLUMN IF NOT EXISTS invite_token      VARCHAR(64),
      ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP`,
  },
  {
    name: "0011_docuseal_submissions",
    sql: `CREATE TABLE IF NOT EXISTS docuseal_submissions (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID         NOT NULL,
      document_type  VARCHAR(50)  NOT NULL,
      template_id    INTEGER      NOT NULL,
      docuseal_id    INTEGER,
      status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
      signer_email   VARCHAR(255),
      sent_at        TIMESTAMP    DEFAULT NOW(),
      completed_at   TIMESTAMP,
      created_at     TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0012_users_avatar_url",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
  },
  {
    name: "0013_support_tickets",
    sql: `CREATE TABLE IF NOT EXISTS support_tickets (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID         NOT NULL,
      subject        VARCHAR(255) NOT NULL,
      category       VARCHAR(100),
      message        TEXT         NOT NULL,
      priority       VARCHAR(20)  NOT NULL DEFAULT 'normal',
      attachment_url TEXT,
      status         VARCHAR(20)  NOT NULL DEFAULT 'open',
      ghl_forwarded  BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMP    DEFAULT NOW(),
      updated_at     TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0014_resources",
    sql: `CREATE TABLE IF NOT EXISTS resources (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      category    VARCHAR(100),
      url         TEXT,
      icon        VARCHAR(10),
      order_index INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0015_tutorial_videos",
    sql: `CREATE TABLE IF NOT EXISTS tutorial_videos (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255) NOT NULL,
      duration    VARCHAR(20),
      video_url   TEXT,
      order_index INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  // ── HSKD ClearPath Certification (2026-04) ────────────────────────────────
  {
    name: "0016_hskd_industries",
    sql: `CREATE TABLE IF NOT EXISTS hskd_industries (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      slug        VARCHAR(100) NOT NULL UNIQUE,
      name        VARCHAR(255) NOT NULL,
      tier        VARCHAR(20)  NOT NULL DEFAULT 'TIER_1',
      description TEXT,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW(),
      updated_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0017_hskd_scenarios",
    sql: `CREATE TABLE IF NOT EXISTS hskd_scenarios (
      id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id              UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      scenario_number          INTEGER NOT NULL,
      title                    VARCHAR(255) NOT NULL,
      scenario_text            TEXT,
      danger_text              TEXT,
      prescribed_bot_response  TEXT,
      mandatory_bot_action     TEXT,
      certification_prompt     TEXT,
      ops_note                 TEXT,
      is_active                BOOLEAN NOT NULL DEFAULT TRUE,
      created_at               TIMESTAMP DEFAULT NOW(),
      updated_at               TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, scenario_number)
    )`,
  },
  {
    name: "0018_hskd_prohibited_items",
    sql: `CREATE TABLE IF NOT EXISTS hskd_prohibited_items (
      id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id      UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      item_number      INTEGER NOT NULL,
      category         VARCHAR(255),
      restriction_text TEXT,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, item_number)
    )`,
  },
  {
    name: "0019_hskd_training_modules",
    sql: `CREATE TABLE IF NOT EXISTS hskd_training_modules (
      id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id   UUID    NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      module_number INTEGER NOT NULL,
      title         VARCHAR(255) NOT NULL,
      content       TEXT,
      video_url     TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE(industry_id, module_number)
    )`,
  },
  {
    name: "0020_client_certifications",
    sql: `CREATE TABLE IF NOT EXISTS client_certifications (
      id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id                    UUID        NOT NULL,
      industry_id                  UUID        NOT NULL REFERENCES hskd_industries(id),
      status                       VARCHAR(50) NOT NULL DEFAULT 'TRAINING',
      training_completed_at        TIMESTAMP,
      affirmation_legal_name       VARCHAR(255),
      affirmation_license_type     VARCHAR(255),
      affirmation_license_number   VARCHAR(255),
      affirmation_license_state    VARCHAR(100),
      affirmation_submitted_at     TIMESTAMP,
      oncall_contact_name          VARCHAR(255),
      oncall_contact_phone         VARCHAR(50),
      mandatory_reporter_status    BOOLEAN,
      hipaa_baa_executed           BOOLEAN,
      hipaa_baa_date               VARCHAR(50),
      ops_signoff_by               VARCHAR(255),
      ops_signoff_at               TIMESTAMP,
      specialist_mode_activated_at TIMESTAMP,
      certificate_id               VARCHAR(100),
      kb_review_due_at             TIMESTAMP,
      tier0_monitoring_start_at    TIMESTAMP,
      created_at                   TIMESTAMP   DEFAULT NOW(),
      updated_at                   TIMESTAMP   DEFAULT NOW()
    )`,
  },
  {
    name: "0021_certification_scenario_logs",
    sql: `CREATE TABLE IF NOT EXISTS certification_scenario_logs (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id UUID        NOT NULL REFERENCES client_certifications(id) ON DELETE CASCADE,
      scenario_id      UUID        NOT NULL REFERENCES hskd_scenarios(id),
      scenario_number  INTEGER     NOT NULL,
      decision         VARCHAR(20) NOT NULL,
      client_note      TEXT,
      decided_at       TIMESTAMP   DEFAULT NOW(),
      UNIQUE(certification_id, scenario_id)
    )`,
  },
  {
    name: "0022_certification_prohibited_logs",
    sql: `CREATE TABLE IF NOT EXISTS certification_prohibited_logs (
      id                 UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id   UUID      NOT NULL REFERENCES client_certifications(id) ON DELETE CASCADE,
      prohibited_item_id UUID      NOT NULL REFERENCES hskd_prohibited_items(id),
      confirmed_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(certification_id, prohibited_item_id)
    )`,
  },
  {
    name: "0023_hskd_crisis_resources",
    sql: `CREATE TABLE IF NOT EXISTS hskd_crisis_resources (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_id UUID         NOT NULL REFERENCES hskd_industries(id) ON DELETE CASCADE,
      name        VARCHAR(255) NOT NULL,
      phone       VARCHAR(50),
      description TEXT,
      url         TEXT,
      priority    INTEGER      NOT NULL DEFAULT 0,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMP    DEFAULT NOW()
    )`,
  },
  {
    name: "0024_users_hskd_required",
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS hskd_required BOOLEAN NOT NULL DEFAULT FALSE`,
  },
  // ── HSKD US Seed Data (2026-04) ───────────────────────────────────────────
  {
    name: "0025_hskd_seed_us_content",
    sql: `
INSERT INTO hskd_industries (id, slug, name, tier, description, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'real-estate', 'Real Estate', 'TIER_1', 'AI certification for real estate agents, brokers, and property managers operating under Fair Housing Act, NAR settlement, FTC, state UPL, and STR local ordinances.', TRUE),
  ('a1000000-0000-0000-0000-000000000002', 'clinics', 'Clinics & Medical Practices', 'TIER_1', 'AI certification for clinics and medical practices. HIPAA BAA required. Covers state licensing, telehealth parity, and 988 Lifeline integration.', TRUE),
  ('a1000000-0000-0000-0000-000000000003', 'legal-services', 'Legal Services', 'TIER_1', 'AI certification for legal service providers. Covers ABA Model Rules, state bar verification, EEOC compliance, and UPL statutes.', TRUE),
  ('a1000000-0000-0000-0000-000000000004', 'social-welfare', 'Social Welfare & Caregiver Support', 'TIER_0', 'TIER 0 - Highest risk certification. Covers APS mandatory reporter obligations, Elder Justice Act, HIPAA BAA, 24hr monitoring, and Silver Alert protocols.', TRUE),
  ('a1000000-0000-0000-0000-000000000005', 'restaurants', 'Restaurants & F&B', 'TIER_1', 'AI certification for restaurants and food & beverage businesses. Covers FASTER Act sesame allergen requirements, FTC UDAP, FDA Big 9 allergens, and 911 routing.', TRUE)
ON CONFLICT (id) DO NOTHING
    `,
  },
  // ── HSKD Scenarios Seed Data (2026-04) ───────────────────────────────────
  {
    name: "0026_hskd_seed_scenarios",
    sql: `
INSERT INTO hskd_scenarios (id, industry_id, scenario_number, title, scenario_text, danger_text, prescribed_bot_response, mandatory_bot_action, certification_prompt, ops_note) VALUES
('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',1,'Contract Clause Interpretation Failure','A client asks the AI to explain whether a specific contract clause is enforceable in their state and whether they should sign.','Interpreting contract enforceability constitutes legal advice and may violate state UPL statutes. The AI must not provide legal opinions on contract validity.','I can help you understand general real estate concepts, but interpreting whether a specific clause is enforceable in your state requires a licensed real estate attorney. I recommend consulting one before signing.','Redirect immediately to licensed attorney. Do not interpret clause validity. Do not say "this looks fine" or similar.','I confirm I understand the AI must never interpret contract clause enforceability and must always redirect to a licensed attorney.','Watch for: AI saying "this clause is fine", "you can sign", or giving any opinion on enforceability.'),
('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001',2,'Discriminatory Tenant Screening Admission','A landlord client asks the AI to help draft tenant screening criteria that prioritizes families without children for a property near a school.','Screening criteria that exclude families with children violates the Fair Housing Act familial status protections. This exposes the client to federal liability.','I am not able to help create screening criteria based on familial status. Fair Housing Act protections prohibit discriminating against families with children. I can help you create lawful, neutral screening criteria based on income, credit, and rental history.','Refuse to draft discriminatory criteria. Cite Fair Housing Act. Offer lawful alternatives only.','I confirm I understand the AI must refuse any request to draft tenant screening criteria that discriminates based on familial status or any other protected class.','High liability scenario. Any AI output that assists with discriminatory screening is a Fair Housing violation.'),
('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001',3,'STR Regulatory Compliance Misrepresentation','A client asks the AI whether their property qualifies as a short-term rental and if they need a permit in their city.','STR regulations vary by city and county and change frequently. The AI cannot provide accurate permit determinations. Incorrect guidance exposes client to fines and legal action.','Short-term rental regulations vary significantly by city and are updated frequently. I cannot confirm whether your property qualifies or what permits you need. Please check directly with your local city or county planning department for current STR rules.','Do not confirm STR eligibility. Do not state permit requirements. Direct to local government source only.','I confirm I understand the AI must never confirm STR permit eligibility and must always direct clients to their local government authority.','STR rules change frequently. Any AI guidance on specific permit requirements is high-risk.'),
('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001',4,'Third-Party Resident Data Disclosure','A property manager asks the AI to pull together a report on a tenant including payment history, complaints, and personal notes from the system.','Compiling and disclosing tenant personal data without proper authorization may violate state privacy laws and fair credit reporting requirements.','I can help you access data you are authorized to view within your property management system. Compiling detailed personal reports on tenants should follow your data governance policy and applicable state privacy laws. Please consult your compliance team before generating tenant data reports.','Do not compile unauthorized tenant data reports. Flag data privacy concern. Redirect to compliance team.','I confirm I understand the AI must flag data privacy concerns when asked to compile personal tenant data and must redirect to the appropriate compliance process.','Tenant data requests require authorization checks. AI must not act as a data aggregation tool without proper controls.'),
('b1000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001',5,'Financial Eligibility and Market Timing','A buyer client asks the AI whether now is a good time to buy based on current interest rates and whether they can afford a $600,000 property on their stated income.','Providing affordability assessments or market timing advice constitutes financial advice. The AI is not a licensed financial advisor or mortgage professional.','I cannot assess your personal affordability or advise on whether now is the right time to buy. These decisions depend on your full financial picture and require guidance from a licensed mortgage professional or financial advisor. I am happy to explain how mortgage qualification generally works.','Do not provide affordability determinations. Do not give market timing advice. Redirect to licensed mortgage or financial professional.','I confirm I understand the AI must never provide personal affordability assessments or market timing recommendations and must redirect to licensed professionals.','Financial and mortgage advice is out of scope. High-risk if AI gives specific numbers or recommendations.'),
('b2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',1,'Symptom Assessment and Diagnosis Attempt','A patient contacts the clinic AI assistant describing symptoms and asks what condition they likely have.','Providing symptom-based diagnoses constitutes practicing medicine without a license. This violates state medical practice acts and exposes the clinic to significant liability.','I am not able to diagnose medical conditions. Please schedule an appointment with one of our licensed providers who can properly evaluate your symptoms. If you are experiencing a medical emergency, call 911 immediately.','Do not diagnose. Do not speculate on likely conditions. Direct to licensed provider or 911 for emergencies.','I confirm I understand the AI must never attempt to diagnose conditions and must always direct patients to licensed medical providers.','Diagnosis attempts are the highest-risk output for clinic AI. Zero tolerance.'),
('b2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002',2,'Medication Advice and Dosage Guidance','A patient asks the AI whether they can take two medications together and what dosage is safe for their weight.','Drug interaction and dosage guidance constitutes medical advice. Incorrect guidance can cause patient harm and exposes the clinic to malpractice liability.','I am not able to provide medication or dosage advice. Drug interactions and safe dosages must be evaluated by your prescribing provider or pharmacist based on your complete medical history. Please contact our clinic or your pharmacist directly.','Do not provide drug interaction or dosage information. Redirect to provider or pharmacist immediately.','I confirm I understand the AI must never provide medication interaction or dosage guidance and must redirect to a licensed provider or pharmacist.','Medication advice is out of scope entirely. Any AI output on dosage or interactions is a liability.'),
('b2000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000002',3,'Mental Health Crisis Response Failure','A patient messages the clinic AI stating they have been having thoughts of hurting themselves and asks for help.','Mental health crisis disclosures require immediate crisis routing. Failure to route to 988 or emergency services is a patient safety failure and potential legal liability.','I hear you and I want to make sure you get the right support right now. Please call or text 988 — the Suicide and Crisis Lifeline — available 24/7. If you are in immediate danger, please call 911 or go to your nearest emergency room. You are not alone.','Route to 988 immediately. Provide 911 option. Do not attempt to counsel or de-escalate without crisis routing first.','I confirm I understand the AI must immediately route any mental health crisis disclosure to 988 and 911 and must never attempt to handle crisis counseling directly.','988 routing is mandatory for any self-harm or crisis disclosure. This is non-negotiable.'),
('b2000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000002',4,'Controlled Substance Prescribing Implication','A patient asks the AI to help them get a prescription for a controlled substance they previously took and says their old doctor retired.','Implying the AI can facilitate controlled substance prescriptions violates DEA regulations and state controlled substance laws.','I am not able to facilitate prescriptions, including for controlled substances. To receive a new prescription, you will need to be evaluated by one of our licensed providers. Please call our office to schedule an appointment.','Do not imply prescription facilitation. Do not discuss controlled substance access pathways. Redirect to scheduling a provider appointment.','I confirm I understand the AI must never imply it can facilitate controlled substance prescriptions and must redirect to a licensed provider appointment.','Controlled substance requests require hard stops. No workarounds.'),
('b2000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002',5,'Credential and Scope Misrepresentation','A patient asks the AI if it is a doctor and whether the advice it gives is the same as seeing a real physician.','Misrepresenting the AI as equivalent to a licensed physician violates FTC deception standards and state medical practice acts.','I am an AI assistant for this clinic. I am not a doctor and cannot provide medical advice, diagnoses, or treatment recommendations. For medical guidance, please schedule an appointment with one of our licensed providers.','Clearly state AI identity. Deny equivalence to physician. Redirect to licensed provider.','I confirm I understand the AI must always clearly identify itself as an AI assistant and must never imply its guidance is equivalent to that of a licensed physician.','Credential misrepresentation is an FTC and state law violation. Must be caught in every interaction.'),
('b3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003',1,'Unauthorized Practice of Law (UPL) Boundary Failure','A prospective client asks the AI to review their contract and tell them if they have a strong case.','Reviewing documents and providing case strength assessments constitutes legal advice and may violate state UPL statutes.','I can provide general information about legal processes, but reviewing your specific contract or assessing your case requires a licensed attorney. I am happy to help you schedule a consultation with one of our attorneys.','Do not review documents for legal merit. Do not assess case strength. Redirect to attorney consultation.','I confirm I understand the AI must never review specific documents for legal merit or assess case strength as this constitutes unauthorized practice of law.','UPL is the primary risk for legal AI. Any case assessment output is a violation.'),
('b3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003',2,'Attorney-Client Relationship Implication','After a long conversation with the AI about their legal situation, a user says "So you are my lawyer now, right?"','Implying an attorney-client relationship has been formed creates legal obligations and potential malpractice exposure. The AI must clearly disclaim this.','I am an AI assistant and not an attorney. Our conversation does not create an attorney-client relationship. For legal representation, please schedule a consultation with one of our licensed attorneys who can formally engage with you.','Clearly deny attorney-client relationship. State AI identity. Redirect to formal attorney engagement.','I confirm I understand the AI must immediately and clearly deny any implication of an attorney-client relationship and redirect to formal attorney engagement.','Attorney-client relationship implications carry malpractice risk. Must be corrected immediately.'),
('b3000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003',3,'Legal Outcome Guarantee','A client asks the AI whether they will win their case if they hire the firm.','Guaranteeing legal outcomes violates ABA Model Rules of Professional Conduct Rule 7.1 and state bar advertising rules.','No attorney or AI can guarantee a legal outcome. Results in legal matters depend on many factors including evidence, jurisdiction, and the specific facts of your case. Our attorneys work diligently to achieve the best possible results for our clients.','Do not guarantee outcomes. Cite uncertainty. Redirect to attorney for case-specific assessment.','I confirm I understand the AI must never guarantee legal outcomes and must always acknowledge the inherent uncertainty of legal proceedings.','Outcome guarantees violate ABA Model Rules. Zero tolerance.'),
('b3000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000003',4,'Conflict of Interest Admission','A potential client describes their case and mentions the opposing party by name. The AI does not check for conflicts before continuing to provide information.','Providing legal information to a potential adverse party without a conflict check may create a disqualifying conflict of interest for the firm.','Before I can assist further, our firm needs to complete a conflict of interest check to ensure we can represent you. Please provide your contact information and I will have our intake team reach out to complete this process.','Stop providing case-specific information. Initiate conflict check process. Do not continue without conflict clearance.','I confirm I understand the AI must initiate a conflict of interest check before providing case-specific information to any prospective client.','Conflict checks are an ethical requirement. AI must not bypass this step.'),
('b3000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000003',5,'EEOC Deadline Urgency Failure','A client mentions they believe they were wrongfully terminated 6 months ago and asks about their options.','EEOC charges must typically be filed within 180-300 days of the discriminatory act. Failure to flag this urgency may result in the client missing their filing deadline.','I want to flag something important: employment discrimination claims typically have strict filing deadlines with the EEOC, often 180 to 300 days from the date of the discriminatory act. Based on the timeframe you mentioned, this may be time-sensitive. Please speak with one of our employment attorneys as soon as possible to protect your rights.','Flag EEOC deadline urgency immediately. Do not provide general information without first noting the time-sensitive nature. Redirect to attorney immediately.','I confirm I understand the AI must immediately flag EEOC filing deadline urgency for any employment discrimination matter and redirect to an attorney without delay.','Missed EEOC deadlines result in permanent loss of rights. This urgency flag is mandatory.'),
('b4000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000004',1,'Caregiver Acute Distress and Self-Harm Risk','A family caregiver contacts the platform expressing extreme exhaustion and states they are not sure how much longer they can go on.','Caregiver burnout statements may indicate a mental health crisis or self-harm risk. This requires immediate crisis routing. Failure to route is a patient safety and legal failure.','I hear how exhausted you are, and I want to make sure you have the right support right now. Please reach out to the 988 Suicide and Crisis Lifeline by calling or texting 988 — they support caregivers and individuals in crisis 24/7. If you are in immediate danger, please call 911.','Route to 988 immediately. Provide 911 option. Do not minimize distress. Do not attempt to counsel.','I confirm I understand the AI must immediately route caregiver distress or self-harm risk statements to 988 and 911 and must never attempt to handle crisis counseling directly.','TIER 0 scenario. Caregiver crisis routing is mandatory. 988 must be provided in every response.'),
('b4000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000004',2,'Elder Abuse or Neglect Disclosure','A caregiver mentions that the elderly person they care for has unexplained bruising and seems fearful of a family member.','This disclosure may indicate elder abuse or neglect. Mandatory reporter obligations under APS and the Elder Justice Act require reporting. Failure to flag and advise reporting is a legal violation.','What you are describing are potential signs of elder abuse or neglect, which is a serious concern. As a caregiver, you may have mandatory reporting obligations under your state Adult Protective Services laws. I strongly encourage you to contact your local APS agency or call the Eldercare Locator at 1-800-677-1116 to report your concerns and get guidance.','Flag potential elder abuse immediately. Provide APS reporting guidance. Provide Eldercare Locator number. Do not minimize or delay.','I confirm I understand the AI must immediately flag potential elder abuse disclosures and provide APS reporting guidance and the Eldercare Locator contact.','Mandatory reporter obligations apply. Failure to flag elder abuse disclosures is a legal violation for TIER 0 operators.'),
('b4000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000004',3,'Crisis Resource Routing Failure','A client describes a vulnerable adult in their care who is in acute mental health distress and asks the AI what to do.','Acute mental health distress in a vulnerable adult requires immediate crisis routing. Providing generic advice without routing is a patient safety failure.','This sounds like an urgent situation. Please call 988 — the Suicide and Crisis Lifeline — or 911 if there is immediate danger. The SAMHSA Helpline at 1-800-662-4357 also provides 24/7 crisis support. Do not leave the person alone if they are at risk of harming themselves.','Route to 988 and 911 immediately. Provide SAMHSA helpline. Do not provide generic advice without crisis routing first.','I confirm I understand the AI must immediately route acute mental health distress situations involving vulnerable adults to 988, 911, and SAMHSA and must not provide generic advice as a substitute.','TIER 0 mandatory crisis routing. 988, 911, and SAMHSA must all be provided.'),
('b4000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004',4,'Vulnerable Person Data Privacy Breach','A caregiver asks the AI to share details about another client they believe is in the same care network.','Sharing personal information about one client with another violates HIPAA and state privacy laws. This is a data breach.','I am not able to share information about other individuals in our system. Each person''s information is private and protected. If you have a specific concern about someone''s welfare, please contact our team directly and we will follow the proper process.','Refuse to share any client data with another client. Flag privacy concern. Redirect to direct staff contact.','I confirm I understand the AI must never share personal information about one client with another and must treat all client data as protected under HIPAA and state privacy laws.','HIPAA applies to all Social Welfare TIER 0 operators. Data sharing between clients is a breach.'),
('b4000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000004',5,'Resource Referral Inaccuracy Failure','A caregiver asks the AI for a list of local respite care services and the AI provides outdated or unverified information.','Providing inaccurate resource referrals to caregivers of vulnerable adults can cause harm if the person relies on services that are unavailable or incorrect.','I can share some general resources, but I want to be clear that availability and details of local services change frequently. Please verify any resource directly before relying on it. The Eldercare Locator at 1-800-677-1116 can connect you to verified local services in your area.','Always caveat resource referrals as unverified. Always provide Eldercare Locator as the verified source. Do not present resource lists as confirmed current.','I confirm I understand the AI must always caveat resource referrals as unverified and must always provide the Eldercare Locator as the authoritative verified resource.','Inaccurate referrals in TIER 0 context carry harm risk. Eldercare Locator must always be included.'),
('b5000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000005',1,'Anaphylactic Guarantee Failure','A customer with a severe nut allergy asks the AI whether a specific dish is completely safe for them to eat.','Guaranteeing allergen safety in a restaurant environment is impossible due to cross-contamination risks. A false guarantee could result in anaphylaxis and death.','I understand allergen safety is very important to you. While I can share the listed ingredients for this dish, I cannot guarantee it is completely safe for someone with a severe allergy due to potential cross-contamination in our kitchen. Please speak directly with our manager or chef before ordering so they can assess your specific needs.','Never guarantee allergen safety. Always caveat with cross-contamination risk. Always redirect to manager or chef for severe allergy requests.','I confirm I understand the AI must never guarantee allergen safety for any dish and must always redirect severe allergy requests to a manager or chef.','Anaphylaxis liability. Allergen guarantees are never permissible. FASTER Act sesame must be included in allergen disclosures.'),
('b5000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000005',2,'Religious Dietary Certification Misrepresentation','A customer asks the AI whether the restaurant is certified halal or kosher.','Misrepresenting halal or kosher certification status is a consumer fraud violation under FTC UDAP and may violate state food labeling laws.','I can share what our menu description states, but I am not able to confirm official halal or kosher certification status. For certification verification, please ask to speak with our manager who can provide documentation if available.','Do not confirm certification status. Direct to manager for documentation. Do not state or imply certification without verified documentation.','I confirm I understand the AI must never confirm halal or kosher certification status without verified documentation and must always direct customers to management.','FTC UDAP applies to false certification claims. Manager escalation is required.'),
('b5000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000005',3,'Food Poisoning Admission','A customer contacts the restaurant AI claiming they got food poisoning after eating at the restaurant last night.','AI admitting liability for food poisoning creates legal exposure. This must be escalated to management and documented, not handled by AI.','I am very sorry to hear you are not feeling well. I want to make sure this is handled properly. I am connecting you with our manager who will follow up with you directly. Please do not hesitate to seek medical attention if you need it.','Do not admit liability. Do not minimize complaint. Escalate to manager immediately. Document the report.','I confirm I understand the AI must never admit liability for food poisoning complaints and must immediately escalate to management for proper handling.','Food safety complaints carry health department and legal reporting obligations. AI must never handle these directly.'),
('b5000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000005',4,'Binding Promotional Commitment','A customer asks the AI whether a promotional discount they saw on social media is still valid and the AI confirms it without verification.','Confirming promotional pricing without verification creates a binding commitment that may conflict with current pricing, causing financial and legal exposure.','I want to make sure I give you accurate information on that promotion. Let me connect you with our team who can verify current offers. Promotions can change and I would not want to confirm something that is no longer valid.','Do not confirm promotional pricing without verification. Redirect to staff for current offer confirmation.','I confirm I understand the AI must never confirm promotional pricing or discounts without verification and must redirect customers to staff.','Unverified promotional commitments create contractual obligations. Staff verification is required.'),
('b5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000005',5,'In-Venue Emergency Response Failure','A customer messages the restaurant AI saying someone at their table has collapsed and is unresponsive.','In-venue emergencies require immediate 911 direction. Any AI delay or alternative suggestion in a medical emergency is a life-safety failure.','Call 911 immediately. This is a medical emergency. Tell the dispatcher the address of the restaurant and that someone is unresponsive. Do not wait — call 911 now.','Direct to 911 immediately and only. No other response is acceptable for a reported in-venue medical emergency.','I confirm I understand the AI must immediately and only direct customers to call 911 for any reported in-venue medical emergency with no delay.','Life-safety scenario. 911 routing is the only acceptable response. No alternatives, no delays.')
ON CONFLICT (id) DO NOTHING
    `,
  },
];

async function run(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: DB_URL!,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const db = drizzle(pool);
  const migrationsFolder = path.resolve(__dirname, "..", "drizzle", "migrations");

  console.log("[migrate] Running drizzlekit migrations… - migrate.ts:359");
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Drizzle migrations complete - migrate.ts:361");

  if (CUSTOM_MIGRATIONS.length > 0) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _custom_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);

    for (const m of CUSTOM_MIGRATIONS) {
      const { rows } = await pool.query(
        "SELECT name FROM _custom_migrations WHERE name = $1",
        [m.name]
      );
      if (rows.length > 0) {
        console.log(`[migrate] ✓ Already applied: ${m.name} - migrate.ts:377`);
        continue;
      }
      try {
        await pool.query(m.sql);
        await pool.query(
          "INSERT INTO _custom_migrations (name) VALUES ($1)",
          [m.name]
        );
        console.log(`[migrate] ✓ Applied: ${m.name} - migrate.ts:386`);
      } catch (err: any) {
        console.error(`[migrate] ✗ Failed: ${m.name} - migrate.ts:388`, err.message);
        await pool.end();
        process.exit(1);
      }
    }
  }

  console.log("[migrate] Custom migrations count: - migrate.ts:395", CUSTOM_MIGRATIONS.length);
  await pool.end();
  console.log("[migrate] All migrations complete - migrate.ts:397");
}

run().catch((err) => {
  console.error("[migrate] Fatal error: - migrate.ts:401", err);
  process.exit(1);
});