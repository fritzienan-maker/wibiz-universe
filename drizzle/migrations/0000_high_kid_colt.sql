CREATE TYPE "public"."plan_tier" AS ENUM('lite', 'standard', 'pro');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('client_admin', 'client_staff', 'operator', 'wibiz_admin');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"event_type" varchar(100),
	"payload_json" jsonb,
	"status" "sync_status" DEFAULT 'pending',
	"attempt_count" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'client_admin' NOT NULL,
	"ghl_contact_id" varchar(255),
	"ghl_location_id" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"plan_tier" "plan_tier",
	"vertical" varchar(100),
	"hskd_required" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"activated_at" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_ghl_contact_id_unique" UNIQUE("ghl_contact_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50),
	"raw_payload" jsonb,
	"received_at" timestamp DEFAULT now(),
	"processed" boolean DEFAULT false,
	"error" text
);
