import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", [
  "client_admin",
  "client_staff",
  "operator",
  "wibiz_admin",
]);

export const planTierEnum = pgEnum("plan_tier", ["lite", "standard", "pro"]);

export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "success",
  "failed",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         roleEnum("role").notNull().default("client_admin"),
  // nullable — wibiz_admin users are seeded without a GHL contact ID
  ghlContactId:  varchar("ghl_contact_id", { length: 255 }).unique(),
  ghlLocationId: varchar("ghl_location_id", { length: 255 }),
  firstName:     varchar("first_name", { length: 100 }),
  lastName:      varchar("last_name", { length: 100 }),
  planTier:      planTierEnum("plan_tier"),
  vertical:      varchar("vertical", { length: 100 }),
  hskdRequired:  boolean("hskd_required").default(false),
  isActive:      boolean("is_active").default(true),
  activatedAt:   timestamp("activated_at"),
  lastLoginAt:   timestamp("last_login_at"),
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ─── Sync Events ──────────────────────────────────────────────────────────────
export const syncEvents = pgTable("sync_events", {
  id:            uuid("id").primaryKey().defaultRandom(),
  entityType:    varchar("entity_type", { length: 50 }),
  entityId:      uuid("entity_id"),
  eventType:     varchar("event_type", { length: 100 }),
  payloadJson:   jsonb("payload_json"),
  status:        syncStatusEnum("status").default("pending"),
  attemptCount:  integer("attempt_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  errorMessage:  text("error_message"),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ─── Webhook Log ──────────────────────────────────────────────────────────────
export const webhookLog = pgTable("webhook_log", {
  id:         uuid("id").primaryKey().defaultRandom(),
  source:     varchar("source", { length: 50 }),
  rawPayload: jsonb("raw_payload"),
  receivedAt: timestamp("received_at").defaultNow(),
  processed:  boolean("processed").default(false),
  error:      text("error"),
});

// ─── Modules ──────────────────────────────────────────────────────────────────
export const modules = pgTable("modules", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dayStart:    integer("day_start"),
  dayEnd:      integer("day_end"),
  orderIndex:  integer("order_index").notNull().default(0),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

// ─── Exercises ────────────────────────────────────────────────────────────────
export const exercises = pgTable("exercises", {
  id:          uuid("id").primaryKey().defaultRandom(),
  moduleId:    uuid("module_id").notNull(),
  title:       varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  proofPrompt: text("proof_prompt"), // what the client must submit as proof before marking complete
  dayNumber:   integer("day_number"),
  orderIndex:  integer("order_index").notNull().default(0),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

// ─── User Progress ────────────────────────────────────────────────────────────
// One row per (user, exercise) pair — created when client submits proof + confirms completion
export const userProgress = pgTable("user_progress", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull(),
  exerciseId:  uuid("exercise_id").notNull(),
  proofText:   text("proof_text"),   // client's proof submission
  completedAt: timestamp("completed_at").defaultNow(),
});

// Module gate confirmations — created when client submits in-portal sign-off
export const userModuleCompletions = pgTable("user_module_completions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull(),
  moduleId:    uuid("module_id").notNull(),
  confirmedAt: timestamp("confirmed_at").defaultNow(),
});

// ─── Quiz Questions ───────────────────────────────────────────────────────────
// 3-5 questions per module; correct answer is server-side only (never sent to client)
export const quizQuestions = pgTable("quiz_questions", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  moduleId:           uuid("module_id").notNull(),
  question:           text("question").notNull(),
  options:            jsonb("options").$type<string[]>().notNull(),
  correctAnswerIndex: integer("correct_answer_index").notNull(),
  orderIndex:         integer("order_index").notNull().default(0),
  isActive:           boolean("is_active").notNull().default(true),
  createdAt:          timestamp("created_at").defaultNow(),
});

// ─── Quiz Responses ───────────────────────────────────────────────────────────
// One row per (user, module) attempt — most recent attempt is authoritative
export const quizResponses = pgTable("quiz_responses", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         uuid("user_id").notNull(),
  moduleId:       uuid("module_id").notNull(),
  answers:        jsonb("answers").$type<number[]>().notNull(),
  score:          integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed:         boolean("passed").notNull().default(false),
  passedAt:       timestamp("passed_at"),
  createdAt:      timestamp("created_at").defaultNow(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type User         = typeof users.$inferSelect;
export type NewUser      = typeof users.$inferInsert;
export type SyncEvent    = typeof syncEvents.$inferSelect;
export type NewSyncEvent = typeof syncEvents.$inferInsert;
export type WebhookLog    = typeof webhookLog.$inferSelect;
export type NewWebhookLog = typeof webhookLog.$inferInsert;
export type Module        = typeof modules.$inferSelect;
export type NewModule     = typeof modules.$inferInsert;
