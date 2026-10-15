CREATE TYPE "public"."origen_lead" AS ENUM('web', 'link_comercial', 'crm');--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "origen" "origen_lead" DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "referido_por" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_referido_por_user_id_fk" FOREIGN KEY ("referido_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Leads ya existentes cargados desde el CRM: su alta en la auditoría tiene el email de quien lo cargó.
UPDATE "leads" SET "origen" = 'crm', "referido_por" = u."id"
FROM "audit_log" a JOIN "user" u ON u."email" = a."usuario"
WHERE a."entidad" = 'lead' AND a."accion" = 'crear' AND a."entidad_id" = "leads"."id";