CREATE TYPE "public"."estado_contrato" AS ENUM('vigente', 'cancelada');--> statement-breakpoint
DROP INDEX "contratos_reserva_idx";--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "estado" "estado_contrato" DEFAULT 'vigente' NOT NULL;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "cancelado_por" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "cancelado_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "contratos_reserva_vigente_idx" ON "contratos" USING btree ("reserva_id") WHERE "contratos"."estado" = 'vigente';--> statement-breakpoint
CREATE INDEX "contratos_reserva_idx" ON "contratos" USING btree ("reserva_id");--> statement-breakpoint
-- Las cuentas de reservas que dejaron de estar realizadas quedaban ocultas: pasan a canceladas (historial).
UPDATE "contratos" SET "estado" = 'cancelada', "cancelado_por" = 'sistema (migración)', "cancelado_at" = now()
FROM "reservas" WHERE "reservas"."id" = "contratos"."reserva_id" AND "reservas"."estado" <> 'realizada';