CREATE TABLE "tipos_cambio" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" date NOT NULL,
	"tipo" text DEFAULT 'bna_vendedor' NOT NULL,
	"valor" numeric NOT NULL,
	"fuente" text,
	"creado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "tipo_cambio_aplicado" numeric;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "monto_usd" numeric;--> statement-breakpoint
CREATE UNIQUE INDEX "tipos_cambio_fecha_tipo_idx" ON "tipos_cambio" USING btree ("fecha","tipo");