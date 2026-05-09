ALTER TABLE "parcelas" ADD COLUMN "precio_base" numeric;--> statement-breakpoint
UPDATE "parcelas" SET "precio_base" = "precio_etapa1";
