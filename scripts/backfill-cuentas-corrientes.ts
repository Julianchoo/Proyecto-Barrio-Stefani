import { and, eq, ilike, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";
import postgres from "postgres";
import { contratos, cuotas, reservas } from "../src/lib/schema";
import type { MonedaPago } from "../src/lib/schema";

dotenv.config({ path: ".env" });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL environment variable is not set");
}

const client = postgres(connectionString);
const db = drizzle(client);

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyString(value: number) {
  return String(Math.max(0, Math.round(value * 100) / 100));
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1));
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonthsOnDay(start: string, monthsToAdd: number, preferredDay: number) {
  const startDate = parseDateKey(start);
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth() + monthsToAdd;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(preferredDay, 1), lastDay);
  return formatDateKey(new Date(Date.UTC(year, month, day)));
}

async function main() {
  const rows = await db
    .select({ reserva: reservas })
    .from(reservas)
    .leftJoin(contratos, eq(contratos.reservaId, reservas.id))
    .where(
      and(
        eq(reservas.estado, "realizada"),
        ilike(reservas.formaPago, "%financi%"),
        isNull(contratos.id)
      )
    );

  let created = 0;
  let skipped = 0;

  for (const { reserva } of rows) {
    const cantidadCuotas = toNumber(reserva.cantidadCuotas);
    const cuotaBase = toNumber(reserva.cuotaMensual);
    const saldoInicial = toNumber(reserva.saldoNum);
    const fechaInicio = reserva.fechaFirma ?? reserva.fechaReserva;

    if (!cantidadCuotas || !cuotaBase || !saldoInicial || !fechaInicio) {
      skipped += 1;
      continue;
    }
    if (reserva.modalidadContrato === "pesos_cac") {
      skipped += 1;
      continue;
    }

    const diaVencimiento = Number(fechaInicio.slice(8, 10)) || 10;
    const fechaPrimerVencimiento = addMonthsOnDay(fechaInicio, 1, diaVencimiento);

    await db.transaction(async (tx) => {
      const [contrato] = await tx
        .insert(contratos)
        .values({
          reservaId: reserva.id,
          modalidad: reserva.modalidadContrato ?? "requiere_revision",
          fechaInicio,
          fechaPrimerVencimiento,
          cantidadCuotas,
          diaVencimiento,
          saldoInicial: moneyString(saldoInicial),
          cuotaBase: moneyString(cuotaBase),
          monedaBase: reserva.modalidadContrato === "pesos_cac" ? "ars" : "usd",
          periodoBaseCac:
            reserva.modalidadContrato === "pesos_cac" ? fechaInicio.slice(0, 7) : null,
          requiereRevision: reserva.modalidadContrato === null,
          observaciones:
            reserva.modalidadContrato === null
              ? "Backfill automatico: modalidad historica no inferida."
              : "Backfill automatico desde reserva realizada.",
          creadoPor: "backfill",
      })
      .returning();
      if (!contrato) throw new Error("No se pudo crear el contrato");

      await tx.insert(cuotas).values(
        Array.from({ length: cantidadCuotas }, (_, index) => {
          const fechaVencimiento = addMonthsOnDay(
            fechaPrimerVencimiento,
            index,
            diaVencimiento
          );
          const moneda: MonedaPago =
            reserva.modalidadContrato === "pesos_cac" ? "ars" : "usd";
          return {
            contratoId: contrato.id,
            numero: index + 1,
            fechaVencimiento,
            periodoCac:
              reserva.modalidadContrato === "pesos_cac"
                ? fechaVencimiento.slice(0, 7)
                : null,
            importeBase: moneyString(cuotaBase),
            importeAjustado:
              reserva.modalidadContrato === "pesos_cac" ? null : moneyString(cuotaBase),
            moneda,
            saldo: moneyString(cuotaBase),
            estado:
              reserva.modalidadContrato === "pesos_cac"
                ? ("pendiente_indice" as const)
                : ("pendiente" as const),
          };
        })
      );
    });

    created += 1;
  }

  console.log(`Backfill cuentas corrientes: ${created} creadas, ${skipped} omitidas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await client.end();
});
