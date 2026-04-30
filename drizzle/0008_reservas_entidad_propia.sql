CREATE TYPE "public"."estado_reserva" AS ENUM('activa', 'cancelada');--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"parcela_id" integer NOT NULL,
	"lead_id" integer,
	"estado" "estado_reserva" DEFAULT 'activa' NOT NULL,
	"nombre_comprador" text,
	"dni_cuit" text,
	"telefono" text,
	"email_comprador" text,
	"domicilio_comprador" text,
	"nacionalidad" text,
	"fecha_nacimiento" date,
	"estado_civil" text,
	"cuit_comprador" text,
	"nombre_co_comprador" text,
	"dni_co_comprador" text,
	"cuit_co_comprador" text,
	"estado_civil_co_comprador" text,
	"porcentaje_co_comprador" text,
	"tipo_entrega" text,
	"mes_entrega" text,
	"anio_entrega" text,
	"nombre_corredor" text,
	"email_corredor" text,
	"forma_pago" text,
	"fecha_reserva" date,
	"fecha_vencimiento" date,
	"fecha_firma" date,
	"modificado_por" text,
	"reservado_por" text,
	"observaciones" text,
	"precio_total_palabras" text,
	"precio_total_num" text,
	"anticipo_palabras" text,
	"anticipo_num" text,
	"saldo_palabras" text,
	"saldo_num" text,
	"cantidad_cuotas" text,
	"cuota_mensual_palabras" text,
	"cuota_mensual" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_parcela_id_parcelas_id_fk" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcelas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "reservas" (
	"parcela_id",
	"estado",
	"nombre_comprador",
	"dni_cuit",
	"telefono",
	"email_comprador",
	"domicilio_comprador",
	"tipo_entrega",
	"mes_entrega",
	"anio_entrega",
	"nombre_corredor",
	"email_corredor",
	"forma_pago",
	"fecha_reserva",
	"fecha_vencimiento",
	"fecha_firma",
	"modificado_por",
	"reservado_por",
	"observaciones",
	"precio_total_palabras",
	"precio_total_num",
	"anticipo_palabras",
	"anticipo_num",
	"saldo_palabras",
	"saldo_num",
	"cantidad_cuotas",
	"cuota_mensual_palabras",
	"cuota_mensual",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	CASE WHEN "estado" = 'reservado' THEN 'activa'::"estado_reserva" ELSE 'cancelada'::"estado_reserva" END,
	"nombre_comprador",
	"dni_cuit",
	"telefono",
	"email_comprador",
	"domicilio_comprador",
	"tipo_entrega",
	"mes_entrega",
	"anio_entrega",
	"nombre_corredor",
	"email_corredor",
	"forma_pago",
	"fecha_reserva",
	"fecha_vencimiento",
	"fecha_firma",
	"modificado_por",
	"reservado_por",
	"observaciones",
	"precio_total_palabras",
	"precio_total_num",
	"anticipo_palabras",
	"anticipo_num",
	"saldo_palabras",
	"saldo_num",
	"cantidad_cuotas",
	"cuota_mensual_palabras",
	"cuota_mensual",
	"created_at",
	"updated_at"
FROM "parcelas"
WHERE
	"estado" = 'reservado'
	OR "nombre_comprador" IS NOT NULL
	OR "dni_cuit" IS NOT NULL
	OR "telefono" IS NOT NULL
	OR "email_comprador" IS NOT NULL
	OR "domicilio_comprador" IS NOT NULL
	OR "fecha_reserva" IS NOT NULL
	OR "fecha_vencimiento" IS NOT NULL
	OR "observaciones" IS NOT NULL
	OR "precio_total_num" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "reservas_parcela_idx" ON "reservas" USING btree ("parcela_id");--> statement-breakpoint
CREATE INDEX "reservas_lead_idx" ON "reservas" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservas_active_parcela_idx" ON "reservas" USING btree ("parcela_id") WHERE "reservas"."estado" = 'activa';
