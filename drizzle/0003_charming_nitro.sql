ALTER TABLE "leads" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "estado" SET DEFAULT 'nuevo'::text;--> statement-breakpoint
DROP TYPE "public"."estado_lead";--> statement-breakpoint
CREATE TYPE "public"."estado_lead" AS ENUM('nuevo', 'asignado', 'a_contactar', 'contactado', 'sin_respuesta', 'closed_won', 'closed_lost');--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "estado" SET DEFAULT 'nuevo'::"public"."estado_lead";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "estado" SET DATA TYPE "public"."estado_lead" USING "estado"::"public"."estado_lead";