import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  serial,
  numeric,
  integer,
  date,
} from "drizzle-orm/pg-core";

// IMPORTANT! ID fields should ALWAYS use UUID types, EXCEPT the BetterAuth tables.

// ─── Enums ────────────────────────────────────────────────────────────────────

export const estadoParcelaEnum = pgEnum("estado_parcela", [
  "disponible",
  "no_disponible",
  "reservado",
  "vendido",
]);

export const estadoLeadEnum = pgEnum("estado_lead", [
  "nuevo",
  "asignado",
  "a_contactar",
  "contactado",
  "sin_respuesta",
  "closed_won",
  "closed_lost",
]);

export const estadoReservaEnum = pgEnum("estado_reserva", [
  "activa",
  "cancelada",
  "vencida",
  "realizada",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "comercial"]);

export const modalidadContratoEnum = pgEnum("modalidad_contrato", [
  "usd_fijo",
  "pesos_cac",
  "requiere_revision",
]);

export const estadoCuotaEnum = pgEnum("estado_cuota", [
  "pendiente",
  "pendiente_indice",
  "parcial",
  "pagada",
  "vencida",
  "calculada",
  "proyectada",
  "parcial_vencida",
  "cancelada",
]);

export const monedaPagoEnum = pgEnum("moneda_pago", ["usd", "ars"]);

export const estadoPagoEnum = pgEnum("estado_pago", ["activo", "anulado"]);

// ─── Better Auth Tables ───────────────────────────────────────────────────────

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role", { enum: ["admin", "comercial"] })
      .default("comercial")
      .notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Application Tables ───────────────────────────────────────────────────────

export const parcelas = pgTable(
  "parcelas",
  {
    id: serial("id").primaryKey(),

    // Datos catastrales del Excel
    numero: integer("numero").notNull(),
    circunscripcion: text("circunscripcion"),
    seccion: text("seccion"),
    manzana: text("manzana"),
    parcela: text("parcela"),
    partidaArba: text("partida_arba"),
    partidaMunicipal: text("partida_municipal"),
    escritura: text("escritura"),
    matriculaFolio: text("matricula_folio"),
    certificadoCatastral: text("certificado_catastral"),
    valuacionFiscal: numeric("valuacion_fiscal"),
    vfAlActo: numeric("vf_al_acto"),
    superficieM2: numeric("superficie_m2"),
    metrosFrente: numeric("metros_frente"),
    metrosFondo: numeric("metros_fondo"),
    calleFrente: text("calle_frente"),
    calleLindera1: text("calle_lindera_1"),
    calleLindera2: text("calle_lindera_2"),

    // Estado y pricing
    estado: estadoParcelaEnum("estado").default("disponible").notNull(),
    precioBase: numeric("precio_base"),
    precioEtapa1: numeric("precio_etapa1"),
    valorM2: numeric("valor_m2"),
    anticipoPct: numeric("anticipo_pct"),
    tasaMensual: numeric("tasa_mensual"),
    anticipoUsd: numeric("anticipo_usd"),
    saldoUsd: numeric("saldo_usd"),
    cuotas48: numeric("cuotas_48"),
    cuotas60: numeric("cuotas_60"),
    nota: text("nota"),

    // Datos de comprador / reserva (todos opcionales)
    nombreComprador: text("nombre_comprador"),
    dniCuit: text("dni_cuit"),
    telefono: text("telefono"),
    emailComprador: text("email_comprador"),
    domicilioComprador: text("domicilio_comprador"),
    tipoEntrega: text("tipo_entrega"),
    mesEntrega: text("mes_entrega"),
    anioEntrega: text("anio_entrega"),
    nombreCorredor: text("nombre_corredor"),
    emailCorredor: text("email_corredor"),
    formaPago: text("forma_pago"),
    fechaReserva: date("fecha_reserva"),
    fechaVencimiento: date("fecha_vencimiento"),
    fechaFirma: date("fecha_firma"),
    modificadoPor: text("modificado_por"),
    reservadoPor: text("reservado_por"),
    observaciones: text("observaciones"),

    // Datos de precio / financiación (opcionales, en letras y números)
    precioTotalPalabras: text("precio_total_palabras"),
    precioTotalNum: text("precio_total_num"),
    anticipoPalabras: text("anticipo_palabras"),
    anticipoNum: text("anticipo_num"),
    saldoPalabras: text("saldo_palabras"),
    saldoNum: text("saldo_num"),
    cantidadCuotas: text("cantidad_cuotas"),
    cuotaMensualPalabras: text("cuota_mensual_palabras"),
    cuotaMensual: text("cuota_mensual"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("parcelas_estado_idx").on(table.estado),
    index("parcelas_manzana_idx").on(table.manzana),
  ]
);

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    telefono: text("telefono").notNull(),
    email: text("email").notNull(),
    mensaje: text("mensaje"),
    estado: estadoLeadEnum("estado").default("nuevo").notNull(),
    notas: text("notas"),
    asignadoA: text("asignado_a").references(() => user.id, {
      onDelete: "set null",
    }),
    dniCuit: text("dni_cuit"),
    domicilio: text("domicilio"),
    nacionalidad: text("nacionalidad"),
    fechaNacimiento: date("fecha_nacimiento"),
    estadoCivil: text("estado_civil"),
    cuitComprador: text("cuit_comprador"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("leads_estado_idx").on(table.estado)]
);

export const reservas = pgTable(
  "reservas",
  {
    id: serial("id").primaryKey(),
    parcelaId: integer("parcela_id")
      .notNull()
      .references(() => parcelas.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    estado: estadoReservaEnum("estado").default("activa").notNull(),

    nombreComprador: text("nombre_comprador"),
    dniCuit: text("dni_cuit"),
    telefono: text("telefono"),
    emailComprador: text("email_comprador"),
    domicilioComprador: text("domicilio_comprador"),
    nacionalidad: text("nacionalidad"),
    fechaNacimiento: date("fecha_nacimiento"),
    estadoCivil: text("estado_civil"),
    cuitComprador: text("cuit_comprador"),

    nombreCoComprador: text("nombre_co_comprador"),
    dniCoComprador: text("dni_co_comprador"),
    nacionalidadCoComprador: text("nacionalidad_co_comprador"),
    fechaNacimientoCoComprador: date("fecha_nacimiento_co_comprador"),
    domicilioCoComprador: text("domicilio_co_comprador"),
    cuitCoComprador: text("cuit_co_comprador"),
    estadoCivilCoComprador: text("estado_civil_co_comprador"),
    porcentajeCoComprador: text("porcentaje_co_comprador"),

    tipoEntrega: text("tipo_entrega"),
    mesEntrega: text("mes_entrega"),
    anioEntrega: text("anio_entrega"),
    nombreCorredor: text("nombre_corredor"),
    emailCorredor: text("email_corredor"),
    formaPago: text("forma_pago"),
    fechaReserva: date("fecha_reserva"),
    fechaVencimiento: date("fecha_vencimiento"),
    fechaFirma: date("fecha_firma"),
    modificadoPor: text("modificado_por"),
    reservadoPor: text("reservado_por"),
    observaciones: text("observaciones"),

    precioTotalPalabras: text("precio_total_palabras"),
    precioTotalNum: text("precio_total_num"),
    reservaPalabras: text("reserva_palabras"),
    reservaNum: text("reserva_num"),
    anticipoPalabras: text("anticipo_palabras"),
    anticipoNum: text("anticipo_num"),
    saldoPalabras: text("saldo_palabras"),
    saldoNum: text("saldo_num"),
    cantidadCuotas: text("cantidad_cuotas"),
    cuotaMensualPalabras: text("cuota_mensual_palabras"),
    cuotaMensual: text("cuota_mensual"),
    modalidadContrato: modalidadContratoEnum("modalidad_contrato"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reservas_parcela_idx").on(table.parcelaId),
    index("reservas_lead_idx").on(table.leadId),
    uniqueIndex("reservas_active_parcela_idx")
      .on(table.parcelaId)
      .where(sql`${table.estado} = 'activa'`),
  ]
);

export const contratos = pgTable(
  "contratos",
  {
    id: serial("id").primaryKey(),
    reservaId: integer("reserva_id")
      .notNull()
      .references(() => reservas.id, { onDelete: "cascade" }),
    modalidad: modalidadContratoEnum("modalidad").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaPrimerVencimiento: date("fecha_primer_vencimiento").notNull(),
    cantidadCuotas: integer("cantidad_cuotas").notNull(),
    diaVencimiento: integer("dia_vencimiento").notNull(),
    saldoInicial: numeric("saldo_inicial").notNull(),
    cuotaBase: numeric("cuota_base").notNull(),
    monedaBase: monedaPagoEnum("moneda_base").notNull(),
    periodoBaseCac: text("periodo_base_cac"),
    indiceBaseCac: numeric("indice_base_cac"),
    requiereRevision: boolean("requiere_revision").default(false).notNull(),
    observaciones: text("observaciones"),
    creadoPor: text("creado_por"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("contratos_reserva_idx").on(table.reservaId),
    index("contratos_modalidad_idx").on(table.modalidad),
  ]
);

export const cuotas = pgTable(
  "cuotas",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    periodoCac: text("periodo_cac"),
    indiceCac: numeric("indice_cac"),
    importeBase: numeric("importe_base").notNull(),
    importeAjustado: numeric("importe_ajustado"),
    moneda: monedaPagoEnum("moneda").notNull(),
    saldo: numeric("saldo").notNull(),
    estado: estadoCuotaEnum("estado").default("pendiente").notNull(),
    observaciones: text("observaciones"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("cuotas_contrato_numero_idx").on(table.contratoId, table.numero),
    index("cuotas_contrato_idx").on(table.contratoId),
    index("cuotas_vencimiento_idx").on(table.fechaVencimiento),
    index("cuotas_estado_idx").on(table.estado),
  ]
);

export const pagos = pgTable(
  "pagos",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    cuotaId: integer("cuota_id").references(() => cuotas.id, {
      onDelete: "set null",
    }),
    fechaPago: date("fecha_pago").notNull(),
    monto: numeric("monto").notNull(),
    moneda: monedaPagoEnum("moneda").notNull(),
    tipoCambioAplicado: numeric("tipo_cambio_aplicado"),
    montoUsd: numeric("monto_usd"),
    medio: text("medio"),
    observacion: text("observacion"),
    estado: estadoPagoEnum("estado").default("activo").notNull(),
    creadoPor: text("creado_por"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("pagos_contrato_idx").on(table.contratoId),
    index("pagos_cuota_idx").on(table.cuotaId),
    index("pagos_fecha_idx").on(table.fechaPago),
  ]
);

export const tiposCambio = pgTable(
  "tipos_cambio",
  {
    id: serial("id").primaryKey(),
    fecha: date("fecha").notNull(),
    tipo: text("tipo").default("bna_vendedor").notNull(),
    valor: numeric("valor").notNull(),
    fuente: text("fuente"),
    creadoPor: text("creado_por"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("tipos_cambio_fecha_tipo_idx").on(table.fecha, table.tipo)]
);

export const indicesCac = pgTable(
  "indices_cac",
  {
    id: serial("id").primaryKey(),
    periodo: text("periodo").notNull(),
    valor: numeric("valor").notNull(),
    fuente: text("fuente"),
    nota: text("nota"),
    creadoPor: text("creado_por"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("indices_cac_periodo_idx").on(table.periodo)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type Parcela = typeof parcelas.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Reserva = typeof reservas.$inferSelect;
export type Contrato = typeof contratos.$inferSelect;
export type Cuota = typeof cuotas.$inferSelect;
export type Pago = typeof pagos.$inferSelect;
export type TipoCambio = typeof tiposCambio.$inferSelect;
export type IndiceCac = typeof indicesCac.$inferSelect;
export type EstadoParcela = (typeof estadoParcelaEnum.enumValues)[number];
export type EstadoLead = (typeof estadoLeadEnum.enumValues)[number];
export type EstadoReserva = (typeof estadoReservaEnum.enumValues)[number];
export type ModalidadContrato = (typeof modalidadContratoEnum.enumValues)[number];
export type EstadoCuota = (typeof estadoCuotaEnum.enumValues)[number];
export type MonedaPago = (typeof monedaPagoEnum.enumValues)[number];
export type ParcelaConReserva = Parcela &
  Partial<
    Pick<
      Reserva,
      | "leadId"
      | "nombreComprador"
      | "dniCuit"
      | "telefono"
      | "emailComprador"
      | "domicilioComprador"
      | "nacionalidad"
      | "fechaNacimiento"
      | "estadoCivil"
      | "cuitComprador"
      | "nombreCoComprador"
      | "dniCoComprador"
      | "nacionalidadCoComprador"
      | "fechaNacimientoCoComprador"
      | "domicilioCoComprador"
      | "cuitCoComprador"
      | "estadoCivilCoComprador"
      | "porcentajeCoComprador"
      | "tipoEntrega"
      | "mesEntrega"
      | "anioEntrega"
      | "nombreCorredor"
      | "emailCorredor"
      | "formaPago"
      | "fechaReserva"
      | "fechaVencimiento"
      | "fechaFirma"
      | "modificadoPor"
      | "reservadoPor"
      | "observaciones"
      | "precioTotalPalabras"
      | "precioTotalNum"
      | "reservaPalabras"
      | "reservaNum"
      | "anticipoPalabras"
      | "anticipoNum"
      | "saldoPalabras"
      | "saldoNum"
      | "cantidadCuotas"
      | "cuotaMensualPalabras"
      | "cuotaMensual"
      | "modalidadContrato"
    >
  > & {
    reservaId: number | null;
    reservaEstado?: Reserva["estado"] | null;
    leadEstado?: Lead["estado"] | null;
    leadAsignadoA?: string | null;
  };
