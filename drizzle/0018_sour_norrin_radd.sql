ALTER TYPE "public"."estado_cuota" ADD VALUE 'calculada' BEFORE 'cancelada';--> statement-breakpoint
ALTER TYPE "public"."estado_cuota" ADD VALUE 'proyectada' BEFORE 'cancelada';--> statement-breakpoint
ALTER TYPE "public"."estado_cuota" ADD VALUE 'parcial_vencida' BEFORE 'cancelada';--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "indice_base_cac" numeric;--> statement-breakpoint
ALTER TABLE "cuotas" ADD COLUMN "indice_cac" numeric;