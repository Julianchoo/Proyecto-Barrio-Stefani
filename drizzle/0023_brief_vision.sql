ALTER TABLE "leads" ADD COLUMN "parcela_id" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "simulacion" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_parcela_id_parcelas_id_fk" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcelas"("id") ON DELETE set null ON UPDATE no action;