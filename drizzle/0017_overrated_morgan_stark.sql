CREATE TYPE "public"."estado_cuota" AS ENUM('pendiente', 'pendiente_indice', 'parcial', 'pagada', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('activo', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."modalidad_contrato" AS ENUM('usd_fijo', 'pesos_cac', 'requiere_revision');--> statement-breakpoint
CREATE TYPE "public"."moneda_pago" AS ENUM('usd', 'ars');--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserva_id" integer NOT NULL,
	"modalidad" "modalidad_contrato" NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_primer_vencimiento" date NOT NULL,
	"cantidad_cuotas" integer NOT NULL,
	"dia_vencimiento" integer NOT NULL,
	"saldo_inicial" numeric NOT NULL,
	"cuota_base" numeric NOT NULL,
	"moneda_base" "moneda_pago" NOT NULL,
	"periodo_base_cac" text,
	"requiere_revision" boolean DEFAULT false NOT NULL,
	"observaciones" text,
	"creado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"periodo_cac" text,
	"importe_base" numeric NOT NULL,
	"importe_ajustado" numeric,
	"moneda" "moneda_pago" NOT NULL,
	"saldo" numeric NOT NULL,
	"estado" "estado_cuota" DEFAULT 'pendiente' NOT NULL,
	"observaciones" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indices_cac" (
	"id" serial PRIMARY KEY NOT NULL,
	"periodo" text NOT NULL,
	"valor" numeric NOT NULL,
	"fuente" text,
	"nota" text,
	"creado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"cuota_id" integer,
	"fecha_pago" date NOT NULL,
	"monto" numeric NOT NULL,
	"moneda" "moneda_pago" NOT NULL,
	"medio" text,
	"observacion" text,
	"estado" "estado_pago" DEFAULT 'activo' NOT NULL,
	"creado_por" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservas" ADD COLUMN "modalidad_contrato" "modalidad_contrato";--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuota_id_cuotas_id_fk" FOREIGN KEY ("cuota_id") REFERENCES "public"."cuotas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contratos_reserva_idx" ON "contratos" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "contratos_modalidad_idx" ON "contratos" USING btree ("modalidad");--> statement-breakpoint
CREATE UNIQUE INDEX "cuotas_contrato_numero_idx" ON "cuotas" USING btree ("contrato_id","numero");--> statement-breakpoint
CREATE INDEX "cuotas_contrato_idx" ON "cuotas" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX "cuotas_vencimiento_idx" ON "cuotas" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "cuotas_estado_idx" ON "cuotas" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "indices_cac_periodo_idx" ON "indices_cac" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "pagos_contrato_idx" ON "pagos" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX "pagos_cuota_idx" ON "pagos" USING btree ("cuota_id");--> statement-breakpoint
CREATE INDEX "pagos_fecha_idx" ON "pagos" USING btree ("fecha_pago");