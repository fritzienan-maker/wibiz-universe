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
import { modules, exercises, quizQuestions } from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  console.error("[seed-modules] DATABASE_URL must be set");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");

// ─── Programme data ───────────────────────────────────────────────────────────

interface ExerciseSeed {
  title:       string;
  description: string;
  proofPrompt: string;
  dayNumber:   number;
  orderIndex:  number;
}

interface QuizQuestionSeed {
  question:           string;
  options:            string[];
  correctAnswerIndex: number;
  orderIndex:         number;
}

interface ModuleSeed {
  title:         string;
  description:   string;
  dayStart:      number;
  dayEnd:        number;
  orderIndex:    number;
  exercises:     ExerciseSeed[];
  quizQuestions: QuizQuestionSeed[];
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
        proofPrompt: "Enter your business name, operating hours, and primary contact number exactly as they appear in the platform.",
        dayNumber:   0,
        orderIndex:  0,
      },
      {
        title:       "Day 1 — Connect Your First Channel",
        description: "Connect and test your primary messaging channel. Deliverable: First channel connected and responding. All plans.",
        proofPrompt: "State the channel you connected (e.g. WhatsApp: +44 7700 900000) and paste the test response the AI sent back.",
        dayNumber:   1,
        orderIndex:  1,
      },
      {
        title:       "Day 2 — Build Your Top 10 FAQs",
        description: "Seed your knowledge base with your top 10 FAQ entries. Deliverable: 10 FAQ entries live and tested. All plans.",
        proofPrompt: "List all 10 FAQ questions you have added to the knowledge base, one per line.",
        dayNumber:   2,
        orderIndex:  2,
      },
      {
        title:       "Day 3A — Booking Flow Setup",
        description: "Set up full booking flow with confirmation messages. Deliverable: Booking flow live with confirmation. Standard & Pro plans.",
        proofPrompt: "Confirm your booking calendar is connected and paste the exact confirmation message text you configured. (Lite plan: enter N/A)",
        dayNumber:   3,
        orderIndex:  3,
      },
      {
        title:       "Day 3B — Welcome Menu + Quick Buttons",
        description: "Build your welcome menu and configure quick reply buttons. Deliverable: Welcome menu live and tested. Lite plan.",
        proofPrompt: "Describe your welcome menu — list all buttons or quick reply options you have set up. (Std/Pro: enter N/A)",
        dayNumber:   3,
        orderIndex:  4,
      },
      {
        title:       "Day 4 — Reminders + No-Show Prevention",
        description: "Activate automated booking reminders and no-show sequences. Deliverable: Reminders active on all booking types. Standard & Pro plans.",
        proofPrompt: "Confirm reminders are active. State the time windows you set (e.g. 24h before, 1h before) and the message text used. (Lite plan: enter N/A)",
        dayNumber:   4,
        orderIndex:  5,
      },
      {
        title:       "Day 5 — Escalation Rules Setup",
        description: "Define escalation categories and notification routing. Deliverable: Escalation rules active with 3+ categories. All plans.",
        proofPrompt: "List your 3+ escalation categories and the notification routing for each (e.g. category: Complaint → notify: manager@yourbusiness.com).",
        dayNumber:   5,
        orderIndex:  6,
      },
      {
        title:       "Day 6 — After-Hours + Fallback Handling",
        description: "Configure after-hours messaging and fallback responses for unrecognised queries. Deliverable: After-hours message and fallback tested. All plans.",
        proofPrompt: "Paste your after-hours message text and describe your fallback response rule (what the AI does when it cannot match a query).",
        dayNumber:   6,
        orderIndex:  7,
      },
      {
        title:       "Day 7 — Week 1 Review + First 10 Tests",
        description: "Run the First 10 Tests, identify gaps, and submit your gap log. Deliverable: First 10 Tests passed, gap log submitted. All plans.",
        proofPrompt: "State how many of the First 10 Tests passed (e.g. 8/10). List any gaps you identified and what you will fix.",
        dayNumber:   7,
        orderIndex:  8,
      },
    ],
    quizQuestions: [
      {
        question:           "Your AI receives a message asking about a service you do not offer. What should it do?",
        options:            [
          "Reply with a generic 'I don't know' message",
          "Trigger the fallback response and suggest the customer contact you directly",
          "Ignore the message and wait for the customer to send another one",
          "Escalate immediately to a human agent",
        ],
        correctAnswerIndex: 1,
        orderIndex:         0,
      },
      {
        question:           "A customer messages after your business hours. What is the correct system behaviour?",
        options:            [
          "No response until business hours resume",
          "Send the standard welcome menu",
          "Reply with the after-hours message and capture their details for follow-up",
          "Forward the message to the owner's personal phone",
        ],
        correctAnswerIndex: 2,
        orderIndex:         1,
      },
      {
        question:           "When should an escalation rule trigger?",
        options:            [
          "Only when a customer explicitly asks to speak to a human",
          "Any time the AI is unsure or a pre-defined escalation category is matched",
          "Only for complaints",
          "After three failed AI responses in a row",
        ],
        correctAnswerIndex: 1,
        orderIndex:         2,
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
        proofPrompt: "Identify the conversation-to-booking drop-off stage you found. What percentage of conversations made it to a completed booking this week? (Lite plan: describe your highest-volume query type instead)",
        dayNumber:   8,
        orderIndex:  0,
      },
      {
        title:       "Day 9 — Payment + Deposit Integration",
        description: "Connect payment links and configure deposit triggers inside the booking flow. Deliverable: Payment trigger live and tested. Standard & Pro plans.",
        proofPrompt: "Confirm your payment link is active in the booking flow. State the deposit amount or trigger condition you configured. (Lite plan: enter N/A)",
        dayNumber:   9,
        orderIndex:  1,
      },
      {
        title:       "Day 10 — Expand Knowledge Base +10 FAQs",
        description: "Add 10 more FAQ entries to reach 20+ total in your knowledge base. Deliverable: KB at 20+ entries. All plans.",
        proofPrompt: "List 5 of the 10 new FAQ entries you added (your KB must now have 20+ entries total).",
        dayNumber:   10,
        orderIndex:  2,
      },
      {
        title:       "Day 11 — Upsell + Add-On Prompts",
        description: "Build upsell prompts and add-on suggestions into the booking flow. Deliverable: Upsell prompt live in booking flow. Standard & Pro plans.",
        proofPrompt: "Describe the upsell prompt you built: what service or add-on does it offer, and at what point in the booking conversation does it trigger? (Lite plan: enter N/A)",
        dayNumber:   11,
        orderIndex:  3,
      },
      {
        title:       "Day 12 — Waitlist + Fully-Booked Handling",
        description: "Configure waitlist flows and fully-booked responses to retain leads. Deliverable: Waitlist flow live and tested. Standard & Pro plans.",
        proofPrompt: "Confirm the waitlist flow is live. Describe exactly what the AI says and does when responding to a fully-booked time slot request. (Lite plan: enter N/A)",
        dayNumber:   12,
        orderIndex:  4,
      },
      {
        title:       "Day 13 — Channel Expansion Prep",
        description: "Configure your second messaging channel (not yet live). Deliverable: Second channel configured and ready. Standard & Pro plans.",
        proofPrompt: "Name the second channel you have configured and list any settings you adjusted to make it ready. (Lite plan: enter N/A)",
        dayNumber:   13,
        orderIndex:  5,
      },
      {
        title:       "Day 14 — Check-In Milestone",
        description: "5-point check: (1) Channel connected and responding · (2) KB has 15+ entries · (3) Escalation rules with notifications · (4) At least one booking or conversation logged · (5) After-hours handling set. 3+ fails → CSM review flagged. All plans.",
        proofPrompt: "Answer all 5 check-in points (YES or NO + a brief note for each):\n1. Channel connected and responding?\n2. KB has 15+ entries?\n3. Escalation rules with notifications active?\n4. At least one booking or conversation logged?\n5. After-hours handling configured and tested?",
        dayNumber:   14,
        orderIndex:  6,
      },
    ],
    quizQuestions: [
      {
        question:           "What is the most effective point to introduce a payment or deposit prompt in a booking conversation?",
        options:            [
          "At the very start of the conversation before any details are captured",
          "After the customer has confirmed their booking details but before the booking is finalised",
          "Only if the customer asks about pricing first",
          "After the booking is fully confirmed as a follow-up message",
        ],
        correctAnswerIndex: 1,
        orderIndex:         0,
      },
      {
        question:           "A customer asks about a fully-booked time slot. What is the correct system response?",
        options:            [
          "Apologise and end the conversation",
          "Trigger the waitlist flow and capture the customer's details for follow-up",
          "Redirect to the FAQ section",
          "Offer a discount to book a different slot",
        ],
        correctAnswerIndex: 1,
        orderIndex:         1,
      },
      {
        question:           "Why are upsell prompts placed inside the booking flow rather than after it?",
        options:            [
          "Because it is easier to configure inside the flow",
          "Because the customer is already in a buying mindset during the booking process",
          "Because it reduces the escalation rate",
          "Because it improves the AI accuracy score",
        ],
        correctAnswerIndex: 1,
        orderIndex:         2,
      },
      {
        question:           "Conversations are reaching the booking step but not completing. What is the most likely cause?",
        options:            [
          "The knowledge base has too many entries",
          "Friction in the payment or confirmation step",
          "The welcome menu is too complex",
          "After-hours handling is missing",
        ],
        correctAnswerIndex: 1,
        orderIndex:         3,
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
        proofPrompt: "Name the second channel you activated and describe the test you ran to confirm it is live and responding. (Lite plan: confirm your primary channel is still performing or enter N/A)",
        dayNumber:   15,
        orderIndex:  0,
      },
      {
        title:       "Day 16 — Routing Rules Design",
        description: "Design and activate routing rules covering 4+ scenarios (VIP, location, category, agent). Deliverable: Routing rules live for 4+ scenarios. Pro plan only.",
        proofPrompt: "List your 4+ routing rules. For each, describe the trigger scenario and where it routes (e.g. VIP tag → route to senior agent). (Lite/Std plan: enter N/A)",
        dayNumber:   16,
        orderIndex:  1,
      },
      {
        title:       "Day 17 — Governance Playbook Setup",
        description: "Complete your AI governance document and lock approved response templates. Deliverable: Governance doc complete, templates locked. Pro plan only.",
        proofPrompt: "Confirm your governance document is complete. List 3 response categories you have reviewed and locked as approved templates. (Lite/Std plan: enter N/A)",
        dayNumber:   17,
        orderIndex:  2,
      },
      {
        title:       "Day 18 — Industry-Specific Optimisation",
        description: "Build and test 3+ vertical-specific response templates tailored to your industry. Deliverable: 3+ industry templates live and tested. All plans.",
        proofPrompt: "Name the 3 industry-specific templates you have built and describe the scenario each one addresses.",
        dayNumber:   18,
        orderIndex:  3,
      },
      {
        title:       "Day 19 — Complaint + Reputation Handling",
        description: "Configure complaint escalation flow and automated review request sequences. Deliverable: Complaint flow live, review request configured. All plans.",
        proofPrompt: "Describe the complaint escalation flow you configured. What triggers the review request automation and what message does it send?",
        dayNumber:   19,
        orderIndex:  4,
      },
      {
        title:       "Day 20 — Weekly Ops Routine Lock-In",
        description: "Establish and complete your first weekly operations review routine. Deliverable: Weekly routine confirmed, first review completed. All plans.",
        proofPrompt: "Confirm you have completed your first weekly operations review. What was the main finding or adjustment you made as a result?",
        dayNumber:   20,
        orderIndex:  5,
      },
      {
        title:       "Day 21 — Check-In Milestone",
        description: "5-point check: (1) Booking conversion trend up vs Week 1 · (2) Escalation rate trending down · (3) Second channel live (Std/Pro) · (4) Governance or routing set (Pro) · (5) Weekly review habit confirmed. Upgrade trigger for candidates. All plans.",
        proofPrompt: "Answer all 5 check-in points with a status and brief note:\n1. Booking conversion trend vs Week 1?\n2. Escalation rate trending down?\n3. Second channel live (Std/Pro — N/A for Lite)?\n4. Governance or routing configured (Pro — N/A for others)?\n5. Weekly review habit confirmed?",
        dayNumber:   21,
        orderIndex:  6,
      },
    ],
    quizQuestions: [
      {
        question:           "What is the primary purpose of routing rules in a multi-channel AI system?",
        options:            [
          "To reduce the number of AI responses sent",
          "To direct messages to the right agent, team, or channel based on defined triggers",
          "To prevent after-hours messages from being delivered",
          "To automatically improve knowledge base accuracy",
        ],
        correctAnswerIndex: 1,
        orderIndex:         0,
      },
      {
        question:           "A governance playbook is most critical for which situation?",
        options:            [
          "When the AI is first being set up",
          "When multiple staff or locations are using the same AI system and consistency must be enforced",
          "Only for Pro plan clients with advanced routing",
          "When the knowledge base exceeds 50 entries",
        ],
        correctAnswerIndex: 1,
        orderIndex:         1,
      },
      {
        question:           "Why should complaint escalations be handled by a dedicated routing rule rather than the standard escalation flow?",
        options:            [
          "To make the system process faster",
          "To ensure complaints are seen immediately by the right person and not handled by AI alone",
          "To reduce the total number of escalations",
          "Because the AI cannot detect complaints",
        ],
        correctAnswerIndex: 1,
        orderIndex:         2,
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
        proofPrompt: "Confirm your weekly reporting template is active. Describe the 3 key metrics it tracks. (Lite plan: describe the performance data you are manually reviewing each week)",
        dayNumber:   22,
        orderIndex:  0,
      },
      {
        title:       "Day 23 — Retention Sequences",
        description: "Build and activate renewal and re-engagement automation sequences. Deliverable: Renewal and re-engagement sequences active. Standard & Pro plans.",
        proofPrompt: "Confirm your renewal and re-engagement sequences are live. Describe the trigger condition for each sequence. (Lite plan: enter N/A)",
        dayNumber:   23,
        orderIndex:  1,
      },
      {
        title:       "Day 24 — Peak Season Playbook",
        description: "Document and pre-load your peak season playbook into the platform. Deliverable: Peak season playbook documented and pre-loaded. Pro plan only.",
        proofPrompt: "Confirm your peak season playbook is documented and pre-loaded. List the 3 key scenarios it covers. (Lite/Std plan: enter N/A)",
        dayNumber:   24,
        orderIndex:  2,
      },
      {
        title:       "Day 25 — Multi-Location Config Check",
        description: "Run a full multi-location configuration audit and resolve any discrepancies. Deliverable: Multi-location audit complete. Pro plan only.",
        proofPrompt: "Confirm the multi-location audit is complete. List any discrepancies found and how they were resolved. (Lite/Std plan: enter N/A)",
        dayNumber:   25,
        orderIndex:  3,
      },
      {
        title:       "Day 26 — Social Proof + Case Study Build",
        description: "Compile your 30-day stats and draft your first client case study. Deliverable: 30-day stats compiled, case study drafted. All plans.",
        proofPrompt: "Paste your 30-day performance stats (conversations handled, bookings, escalation rate) and write a 2–3 sentence summary of the business impact.",
        dayNumber:   26,
        orderIndex:  4,
      },
      {
        title:       "Day 27 — Staff Training + Handoff Review",
        description: "Complete staff training on handoff protocols and review the escalation log. Deliverable: Staff training log completed. All plans.",
        proofPrompt: "Confirm staff training is complete. List the staff members trained and their role in the handoff protocol.",
        dayNumber:   27,
        orderIndex:  5,
      },
      {
        title:       "Day 28 — Knowledge Base Audit + Refresh",
        description: "Audit your full knowledge base and update at least 3 entries based on 30-day conversation data. Deliverable: KB audited, 3+ entries updated. All plans.",
        proofPrompt: "List the 3 knowledge base entries you updated and describe what changed in each one based on your conversation data.",
        dayNumber:   28,
        orderIndex:  6,
      },
      {
        title:       "Day 29 — 30-Day Prep + Upgrade Review",
        description: "Complete your 30-Day Performance Report and review upgrade eligibility. Deliverable: 30-Day Report complete. All plans.",
        proofPrompt: "Confirm your 30-Day Performance Report is complete. Are you eligible for an upgrade? Answer YES or NO and give a brief reason.",
        dayNumber:   29,
        orderIndex:  7,
      },
      {
        title:       "Day 30 — Graduation + ClearPath Certification",
        description: "Day 30 Graduation: 30-Day Performance Report issued · Ongoing Maintenance Playbook · ClearPath Tier 1 Certificate auto-issued · Upgrade conversation · Referral ask. CRM moves to Active Client stage. All plans.",
        proofPrompt: "Confirm each graduation step (YES or NO):\n1. 30-Day Performance Report issued?\n2. Ongoing Maintenance Playbook reviewed?\n3. ClearPath Tier 1 Certificate received?\n4. Upgrade conversation completed?\n5. Referral ask made?",
        dayNumber:   30,
        orderIndex:  8,
      },
    ],
    quizQuestions: [
      {
        question:           "Which metric best indicates whether your AI system is generating measurable value for the business?",
        options:            [
          "Total number of AI responses sent per week",
          "Conversation-to-booking conversion rate and booking volume trend",
          "Total number of knowledge base entries",
          "Number of escalations handled per month",
        ],
        correctAnswerIndex: 1,
        orderIndex:         0,
      },
      {
        question:           "Why should re-engagement automation sequences be built before Day 30?",
        options:            [
          "Because they are the most technically complex to configure",
          "Because re-engaging existing contacts costs less than acquiring new ones and protects retention",
          "Because they are required for ClearPath Certification",
          "Because they replace the need for a weekly operations routine",
        ],
        correctAnswerIndex: 1,
        orderIndex:         1,
      },
      {
        question:           "At Day 29 upgrade review, what is the strongest signal a client is ready to move to a higher plan?",
        options:            [
          "They have completed all 30 daily exercises",
          "Booking conversion is up, escalation rate is down, and second channel is live",
          "They have 50+ knowledge base entries",
          "They passed both the Day 14 and Day 21 check-ins",
        ],
        correctAnswerIndex: 1,
        orderIndex:         2,
      },
      {
        question:           "What is the primary purpose of a Knowledge Base Audit at Day 28?",
        options:            [
          "To delete outdated entries and reduce the knowledge base size",
          "To update entries based on real conversation gaps identified over the 30-day programme",
          "To prepare the KB for a new staff member joining the team",
          "To check the KB meets the minimum entry count for ClearPath Certification",
        ],
        correctAnswerIndex: 1,
        orderIndex:         3,
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
    console.log("[seed-modules] --force: clearing existing quiz questions, exercises and modules…");
    await db.delete(quizQuestions);
    await db.delete(exercises);
    await db.delete(modules);
    console.log("[seed-modules] Cleared.");
  }

  let totalModules       = 0;
  let totalExercises     = 0;
  let totalQuizQuestions = 0;

  for (const mod of PROGRAMME) {
    const { exercises: exList, quizQuestions: qqList, ...modData } = mod;

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

    for (const qq of qqList) {
      await db.insert(quizQuestions).values({
        moduleId,
        ...qq,
        isActive: true,
      });
      totalQuizQuestions++;
    }

    console.log(`[seed-modules] ✓ ${mod.title} — ${exList.length} exercises, ${qqList.length} quiz questions`);
  }

  console.log(
    `\n[seed-modules] Done. ${totalModules} modules, ${totalExercises} exercises, ${totalQuizQuestions} quiz questions seeded.`
  );
  await pool.end();
}

run().catch((err) => {
  console.error("[seed-modules] Fatal:", err);
  process.exit(1);
});
