import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  index,
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

export const userRoleEnum = pgEnum("user_role", ["admin", "comercial"]);

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

    // Estado y pricing
    estado: estadoParcelaEnum("estado").default("disponible").notNull(),
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
    nombreCorredor: text("nombre_corredor"),
    emailCorredor: text("email_corredor"),
    formaPago: text("forma_pago"),
    fechaReserva: date("fecha_reserva"),
    fechaVencimiento: date("fecha_vencimiento"),
    modificadoPor: text("modificado_por"),
    observaciones: text("observaciones"),

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("leads_estado_idx").on(table.estado)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type Parcela = typeof parcelas.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type EstadoParcela = (typeof estadoParcelaEnum.enumValues)[number];
export type EstadoLead = (typeof estadoLeadEnum.enumValues)[number];
