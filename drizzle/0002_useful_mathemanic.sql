CREATE TYPE "public"."estado_lead" AS ENUM('nuevo', 'contactado', 'interesado', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."estado_parcela" AS ENUM('disponible', 'no_disponible', 'reservado', 'vendido');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'comercial');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text NOT NULL,
	"mensaje" text,
	"estado" "estado_lead" DEFAULT 'nuevo' NOT NULL,
	"notas" text,
	"asignado_a" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcelas" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" integer NOT NULL,
	"circunscripcion" text,
	"seccion" text,
	"manzana" text,
	"parcela" text,
	"partida_arba" text,
	"partida_municipal" text,
	"escritura" text,
	"matricula_folio" text,
	"certificado_catastral" text,
	"valuacion_fiscal" numeric,
	"vf_al_acto" numeric,
	"superficie_m2" numeric,
	"estado" "estado_parcela" DEFAULT 'disponible' NOT NULL,
	"precio_etapa1" numeric,
	"valor_m2" numeric,
	"anticipo_pct" numeric,
	"tasa_mensual" numeric,
	"anticipo_usd" numeric,
	"saldo_usd" numeric,
	"cuotas_48" numeric,
	"cuotas_60" numeric,
	"nota" text,
	"nombre_comprador" text,
	"dni_cuit" text,
	"telefono" text,
	"email_comprador" text,
	"nombre_corredor" text,
	"email_corredor" text,
	"forma_pago" text,
	"fecha_reserva" date,
	"fecha_vencimiento" date,
	"modificado_por" text,
	"observaciones" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'comercial' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_asignado_a_user_id_fk" FOREIGN KEY ("asignado_a") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_estado_idx" ON "leads" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "parcelas_estado_idx" ON "parcelas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "parcelas_manzana_idx" ON "parcelas" USING btree ("manzana");