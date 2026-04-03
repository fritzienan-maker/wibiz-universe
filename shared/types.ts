// Shared type-only re-exports from the Drizzle schema.
// The frontend imports these as `import type { ... }` — no runtime drizzle code
// is included in the browser bundle (all types are erased at compile time).
export type {
  User,
  NewUser,
  SyncEvent,
  NewSyncEvent,
  WebhookLog,
  NewWebhookLog,
} from "../drizzle/schema";
