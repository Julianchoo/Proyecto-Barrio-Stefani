import * as XLSX from "xlsx";
import * as path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parcelas } from "../src/lib/schema";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const EXCEL_PATH = path.join(
  __dirname,
  "..",
  "docs",
  "business",
  "Listado Completo de Parcelas y Pricing.xlsx"
);

type EstadoParcela = "disponible" | "no_disponible" | "reservado" | "vendido";

function normalizeEstado(raw: unknown): EstadoParcela {
  if (!raw) return "disponible";
  const s = String(raw).toLowerCase().trim();
  if (s.includes("vendido")) return "vendido";
  if (s.includes("reservado")) return "reservado";
  if (s.includes("no disponible") || s.includes("no_disponible")) return "no_disponible";
  return "disponible";
}

function toNumeric(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return String(n);
}

function toText(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim();
}

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL env variable is not set");
  }

  const client = postgres(connectionString, { ssl: "require" });
  const db = drizzle(client);

  // Idempotency check
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(parcelas);
  const count = Number(existing[0]?.count ?? 0);
  if (count > 0) {
    console.log(`⏭  Parcelas already seeded (${count} rows). Skipping.`);
    await client.end();
    return;
  }

  // Read Excel
  console.log("📖 Reading Excel file...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0] ?? "";
  const sheet = workbook.Sheets[sheetName] ?? {};
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`   Found ${rows.length} rows in sheet "${sheetName}"`);

  if (rows.length === 0) {
    console.error("❌ No rows found in Excel file");
    await client.end();
    process.exit(1);
  }

  // Log headers found
  const firstRow = rows[0] as Record<string, unknown> | undefined;
  const headers = firstRow ? Object.keys(firstRow) : [];
  console.log("   Headers:", headers.join(", "));

  // Map rows to DB schema
  const inserts = (rows as Record<string, unknown>[]).map((row: Record<string, unknown>) => ({
    numero: parseInt(String(row["N°"] ?? row["N"] ?? row["Numero"] ?? "0")),
    circunscripcion: toText(row["Circunscripción"] ?? row["Circunscripcion"]),
    seccion: toText(row["Sección"] ?? row["Seccion"]),
    manzana: toText(row["Manzana"]),
    parcela: toText(row["Parcela"]),
    partidaArba: toText(row["Partida ARBA"] ?? row["Partida_ARBA"]),
    partidaMunicipal: toText(row["Partida Municipal"] ?? row["Partida_Municipal"]),
    escritura: toText(row["Escritura"]),
    matriculaFolio: toText(row["Matrícula / Folio"] ?? row["Matricula / Folio"] ?? row["Matricula"]),
    certificadoCatastral: toText(row["Certificado Catastral"]),
    valuacionFiscal: toNumeric(row["Valuación Fiscal"] ?? row["Valuacion Fiscal"]),
    vfAlActo: toNumeric(row["VF al Acto"] ?? row["VF_al_Acto"]),
    superficieM2: toNumeric(row[" Superficie M2 "] ?? row["Superficie M2"] ?? row["Superficie"]),
    estado: normalizeEstado(row["Estado"]),
    precioEtapa1: toNumeric(row["Precio Etapa 1"] ?? row["Precio_Etapa_1"]),
    valorM2: toNumeric(row["Valor / m2"] ?? row["Valor/m2"]),
    anticipoPct: toNumeric(row["Anticipo %"] ?? row["Anticipo_pct"]),
    tasaMensual: toNumeric(row["Tasa mensual"] ?? row["Tasa_mensual"]),
    anticipoUsd: toNumeric(row["Anticipo USD"] ?? row["Anticipo_USD"]),
    saldoUsd: toNumeric(row["Saldo USD"] ?? row["Saldo_USD"]),
    cuotas48: toNumeric(row["48 cuotas de"] ?? row["48_cuotas"]),
    cuotas60: toNumeric(row["60 cuotas de"] ?? row["60_cuotas"]),
    nota: toText(row["Nota"]),
  }));

  // Filter out rows without a valid numero
  const validInserts = inserts.filter((r) => r.numero > 0);
  console.log(`   Inserting ${validInserts.length} valid parcelas...`);

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < validInserts.length; i += BATCH_SIZE) {
    const batch = validInserts.slice(i, i + BATCH_SIZE);
    await db.insert(parcelas).values(batch);
    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH_SIZE, validInserts.length)}/${validInserts.length}`);
  }

  console.log(`\n✅ Seeded ${validInserts.length} parcelas successfully.`);
  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
