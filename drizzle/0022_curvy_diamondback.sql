CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" integer NOT NULL,
	"accion" text NOT NULL,
	"usuario" text NOT NULL,
	"cambios" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_entidad_idx" ON "audit_log" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");