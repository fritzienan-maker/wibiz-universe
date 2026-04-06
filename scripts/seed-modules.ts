/**
 * Seeds the WiBiz Academy 30-Day Onboarding Programme.
 * Source: WiBiz_Academy_30Day_Module_Map_v1.0
 *
 * Safe to run against an empty modules table.
 * If modules already exist, the script exits without changes (use --force to overwrite).
 *
 *   npx tsx scripts/seed-modules.ts
 *   npx tsx scripts/seed-modules.ts --force   # clears and re-seeds
 */

import "dotenv/config";
import pg          from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { modules, exercises } from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  console.error("[seed-modules] DATABASE_URL must be set");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");

// ─── Programme data ───────────────────────────────────────────────────────────

interface ExerciseSeed {
  title:       string;
  description: string;
  dayNumber:   number;
  orderIndex:  number;
}

interface ModuleSeed {
  title:       string;
  description: string;
  dayStart:    number;
  dayEnd:      number;
  orderIndex:  number;
  exercises:   ExerciseSeed[];
}

const PROGRAMME: ModuleSeed[] = [
  // ── Module 1: Foundation ──────────────────────────────────────────────────
  {
    title:       "Module 1 — Phase 1: Foundation",
    description: "Get live, get responding, get to your first test. Milestone: Day 7 Check-In — First 10 Tests passed.",
    dayStart:    0,
    dayEnd:      7,
    orderIndex:  0,
    exercises: [
      {
        title:       "Day 0 — Welcome + Platform Orientation",
        description: "Complete platform setup and dashboard orientation. Deliverable: Business Profile live in platform. All plans.",
        dayNumber:   0,
        orderIndex:  0,
      },
      {
        title:       "Day 1 — Connect Your First Channel",
        description: "Connect and test your primary messaging channel. Deliverable: First channel connected and responding. All plans.",
        dayNumber:   1,
        orderIndex:  1,
      },
      {
        title:       "Day 2 — Build Your Top 10 FAQs",
        description: "Seed your knowledge base with your top 10 FAQ entries. Deliverable: 10 FAQ entries live and tested. All plans.",
        dayNumber:   2,
        orderIndex:  2,
      },
      {
        title:       "Day 3A — Booking Flow Setup",
        description: "Set up full booking flow with confirmation messages. Deliverable: Booking flow live with confirmation. Standard & Pro plans.",
        dayNumber:   3,
        orderIndex:  3,
      },
      {
        title:       "Day 3B — Welcome Menu + Quick Buttons",
        description: "Build your welcome menu and configure quick reply buttons. Deliverable: Welcome menu live and tested. Lite plan.",
        dayNumber:   3,
        orderIndex:  4,
      },
      {
        title:       "Day 4 — Reminders + No-Show Prevention",
        description: "Activate automated booking reminders and no-show sequences. Deliverable: Reminders active on all booking types. Standard & Pro plans.",
        dayNumber:   4,
        orderIndex:  5,
      },
      {
        title:       "Day 5 — Escalation Rules Setup",
        description: "Define escalation categories and notification routing. Deliverable: Escalation rules active with 3+ categories. All plans.",
        dayNumber:   5,
        orderIndex:  6,
      },
      {
        title:       "Day 6 — After-Hours + Fallback Handling",
        description: "Configure after-hours messaging and fallback responses for unrecognised queries. Deliverable: After-hours message and fallback tested. All plans.",
        dayNumber:   6,
        orderIndex:  7,
      },
      {
        title:       "Day 7 — Week 1 Review + First 10 Tests",
        description: "Run the First 10 Tests, identify gaps, and submit your gap log. Deliverable: First 10 Tests passed, gap log submitted. All plans.",
        dayNumber:   7,
        orderIndex:  8,
      },
    ],
  },

  // ── Module 2: Conversion Optimisation ────────────────────────────────────
  {
    title:       "Module 2 — Phase 2: Conversion Optimisation",
    description: "Turn conversations into bookings and revenue. Milestone: Day 14 Check-In (human review) — 5 criteria checked.",
    dayStart:    8,
    dayEnd:      14,
    orderIndex:  1,
    exercises: [
      {
        title:       "Day 8 — Booking Conversion Audit",
        description: "Analyse conversation-to-booking drop-off and identify the key failure stage. Deliverable: Drop-off stage identified. Standard & Pro plans.",
        dayNumber:   8,
        orderIndex:  0,
      },
      {
        title:       "Day 9 — Payment + Deposit Integration",
        description: "Connect payment links and configure deposit triggers inside the booking flow. Deliverable: Payment trigger live and tested. Standard & Pro plans.",
        dayNumber:   9,
        orderIndex:  1,
      },
      {
        title:       "Day 10 — Expand Knowledge Base +10 FAQs",
        description: "Add 10 more FAQ entries to reach 20+ total in your knowledge base. Deliverable: KB at 20+ entries. All plans.",
        dayNumber:   10,
        orderIndex:  2,
      },
      {
        title:       "Day 11 — Upsell + Add-On Prompts",
        description: "Build upsell prompts and add-on suggestions into the booking flow. Deliverable: Upsell prompt live in booking flow. Standard & Pro plans.",
        dayNumber:   11,
        orderIndex:  3,
      },
      {
        title:       "Day 12 — Waitlist + Fully-Booked Handling",
        description: "Configure waitlist flows and fully-booked responses to retain leads. Deliverable: Waitlist flow live and tested. Standard & Pro plans.",
        dayNumber:   12,
        orderIndex:  4,
      },
      {
        title:       "Day 13 — Channel Expansion Prep",
        description: "Configure your second messaging channel (not yet live). Deliverable: Second channel configured and ready. Standard & Pro plans.",
        dayNumber:   13,
        orderIndex:  5,
      },
      {
        title:       "Day 14 — Check-In Milestone",
        description: "5-point check: (1) Channel connected and responding · (2) KB has 15+ entries · (3) Escalation rules with notifications · (4) At least one booking or conversation logged · (5) After-hours handling set. 3+ fails → CSM review flagged. All plans.",
        dayNumber:   14,
        orderIndex:  6,
      },
    ],
  },

  // ── Module 3: Scale + Governance ─────────────────────────────────────────
  {
    title:       "Module 3 — Phase 3: Scale + Governance",
    description: "Add channels, routing, and operational consistency. Milestone: Day 21 Check-In (performance + upgrade review).",
    dayStart:    15,
    dayEnd:      21,
    orderIndex:  2,
    exercises: [
      {
        title:       "Day 15 — Second Channel Go-Live",
        description: "Activate your second channel and run Tests to confirm it is live and responding. Deliverable: Second channel live and tested. Standard & Pro plans.",
        dayNumber:   15,
        orderIndex:  0,
      },
      {
        title:       "Day 16 — Routing Rules Design",
        description: "Design and activate routing rules covering 4+ scenarios (VIP, location, category, agent). Deliverable: Routing rules live for 4+ scenarios. Pro plan only.",
        dayNumber:   16,
        orderIndex:  1,
      },
      {
        title:       "Day 17 — Governance Playbook Setup",
        description: "Complete your AI governance document and lock approved response templates. Deliverable: Governance doc complete, templates locked. Pro plan only.",
        dayNumber:   17,
        orderIndex:  2,
      },
      {
        title:       "Day 18 — Industry-Specific Optimisation",
        description: "Build and test 3+ vertical-specific response templates tailored to your industry. Deliverable: 3+ industry templates live and tested. All plans.",
        dayNumber:   18,
        orderIndex:  3,
      },
      {
        title:       "Day 19 — Complaint + Reputation Handling",
        description: "Configure complaint escalation flow and automated review request sequences. Deliverable: Complaint flow live, review request configured. All plans.",
        dayNumber:   19,
        orderIndex:  4,
      },
      {
        title:       "Day 20 — Weekly Ops Routine Lock-In",
        description: "Establish and complete your first weekly operations review routine. Deliverable: Weekly routine confirmed, first review completed. All plans.",
        dayNumber:   20,
        orderIndex:  5,
      },
      {
        title:       "Day 21 — Check-In Milestone",
        description: "5-point check: (1) Booking conversion trend up vs Week 1 · (2) Escalation rate trending down · (3) Second channel live (Std/Pro) · (4) Governance or routing set (Pro) · (5) Weekly review habit confirmed. Upgrade trigger for candidates. All plans.",
        dayNumber:   21,
        orderIndex:  6,
      },
    ],
  },

  // ── Module 4: Retention + Expansion ──────────────────────────────────────
  {
    title:       "Module 4 — Phase 4: Retention + Expansion",
    description: "Build habits, measure ROI, and prepare for renewal. Milestone: Day 30 Graduation + ClearPath Tier 1 Certification.",
    dayStart:    22,
    dayEnd:      30,
    orderIndex:  3,
    exercises: [
      {
        title:       "Day 22 — Reporting Dashboard Setup",
        description: "Set up your weekly reporting template and activate automated performance summaries. Deliverable: Weekly report template active. Standard & Pro plans.",
        dayNumber:   22,
        orderIndex:  0,
      },
      {
        title:       "Day 23 — Retention Sequences",
        description: "Build and activate renewal and re-engagement automation sequences. Deliverable: Renewal and re-engagement sequences active. Standard & Pro plans.",
        dayNumber:   23,
        orderIndex:  1,
      },
      {
        title:       "Day 24 — Peak Season Playbook",
        description: "Document and pre-load your peak season playbook into the platform. Deliverable: Peak season playbook documented and pre-loaded. Pro plan only.",
        dayNumber:   24,
        orderIndex:  2,
      },
      {
        title:       "Day 25 — Multi-Location Config Check",
        description: "Run a full multi-location configuration audit and resolve any discrepancies. Deliverable: Multi-location audit complete. Pro plan only.",
        dayNumber:   25,
        orderIndex:  3,
      },
      {
        title:       "Day 26 — Social Proof + Case Study Build",
        description: "Compile your 30-day stats and draft your first client case study. Deliverable: 30-day stats compiled, case study drafted. All plans.",
        dayNumber:   26,
        orderIndex:  4,
      },
      {
        title:       "Day 27 — Staff Training + Handoff Review",
        description: "Complete staff training on handoff protocols and review the escalation log. Deliverable: Staff training log completed. All plans.",
        dayNumber:   27,
        orderIndex:  5,
      },
      {
        title:       "Day 28 — Knowledge Base Audit + Refresh",
        description: "Audit your full knowledge base and update at least 3 entries based on 30-day conversation data. Deliverable: KB audited, 3+ entries updated. All plans.",
        dayNumber:   28,
        orderIndex:  6,
      },
      {
        title:       "Day 29 — 30-Day Prep + Upgrade Review",
        description: "Complete your 30-Day Performance Report and review upgrade eligibility. Deliverable: 30-Day Report complete. All plans.",
        dayNumber:   29,
        orderIndex:  7,
      },
      {
        title:       "Day 30 — Graduation + ClearPath Certification",
        description: "Day 30 Graduation: 30-Day Performance Report issued · Ongoing Maintenance Playbook · ClearPath Tier 1 Certificate auto-issued · Upgrade conversation · Referral ask. CRM moves to Active Client stage. All plans.",
        dayNumber:   30,
        orderIndex:  8,
      },
    ],
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const db = drizzle(pool);

  // Check for existing data
  const existing = await db.select({ id: modules.id }).from(modules).limit(1);

  if (existing.length > 0 && !FORCE) {
    console.log("[seed-modules] Modules already exist — skipping (use --force to overwrite).");
    await pool.end();
    return;
  }

  if (FORCE && existing.length > 0) {
    console.log("[seed-modules] --force: clearing existing exercises and modules…");
    await db.delete(exercises);
    await db.delete(modules);
    console.log("[seed-modules] Cleared.");
  }

  let totalModules   = 0;
  let totalExercises = 0;

  for (const mod of PROGRAMME) {
    const { exercises: exList, ...modData } = mod;

    const [inserted] = await db
      .insert(modules)
      .values({ ...modData, isActive: true })
      .returning({ id: modules.id });

    const moduleId = inserted!.id;
    totalModules++;

    for (const ex of exList) {
      await db.insert(exercises).values({
        moduleId,
        ...ex,
        isActive: true,
      });
      totalExercises++;
    }

    console.log(`[seed-modules] ✓ ${mod.title} — ${exList.length} exercises`);
  }

  console.log(`\n[seed-modules] Done. ${totalModules} modules, ${totalExercises} exercises seeded.`);
  await pool.end();
}

run().catch((err) => {
  console.error("[seed-modules] Fatal:", err);
  process.exit(1);
});
