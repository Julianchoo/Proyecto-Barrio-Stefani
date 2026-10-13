import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getBnaBilleteVendedor } from "@/lib/bna-exchange-rate";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";
import { crmTransaction, type CrmTransaction } from "@/lib/crm-transaction";
import { contratos, cuotas, pagos, reservas, tiposCambio } from "@/lib/schema";

export const BNA_VENDEDOR = "bna_vendedor";

function moneyString(value: number) {
  return String(Math.round(value * 100) / 100);
}

export function argentinaTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getTipoCambioOnOrBefore(fecha: string, tx?: CrmTransaction) {
  const [row] = await (tx ?? db)
    .select()
    .from(tiposCambio)
    .where(and(eq(tiposCambio.tipo, BNA_VENDEDOR), lte(tiposCambio.fecha, fecha)))
    .orderBy(desc(tiposCambio.fecha))
    .limit(1);
  return row ?? null;
}

export async function listTiposCambioBna() {
  return db
    .select()
    .from(tiposCambio)
    .where(eq(tiposCambio.tipo, BNA_VENDEDOR))
    .orderBy(desc(tiposCambio.fecha));
}

export async function saveTipoCambioBna(input: {
  fecha: string;
  valor: number;
  fuente?: string | null;
  creadoPor?: string | null;
  confirmarImpacto?: string | undefined;
}) {
  return crmTransaction(async (tx) => {
    const [paymentRows, rateRows, contractRows] = await Promise.all([
      tx.select().from(pagos),
      tx.select().from(tiposCambio).where(eq(tiposCambio.tipo, BNA_VENDEDOR)),
      tx
        .select({ contrato: contratos, reserva: reservas })
        .from(contratos)
        .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
        .where(and(eq(contratos.modalidad, "pesos_cac"), eq(reservas.fechaFirma, input.fecha))),
    ]);
    const nextValue = Number(moneyString(input.valor));
    const nextRates = [
      ...rateRows.filter((rate) => rate.fecha !== input.fecha),
      { fecha: input.fecha, valor: String(nextValue) },
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const affectedPayments = paymentRows
      .filter((payment) => payment.moneda === "ars")
      .flatMap((payment) => {
        const rate = nextRates.find((item) => item.fecha <= payment.fechaPago);
        if (rate?.fecha !== input.fecha) return [];
        const value = rate ? Number(rate.valor) : null;
        const usd = value && value > 0 ? moneyString(Number(payment.monto) / value) : null;
        return Number(payment.tipoCambioAplicado) === value &&
          (payment.montoUsd === null ? null : moneyString(Number(payment.montoUsd))) === usd
          ? []
          : [
              {
                id: payment.id,
                monto: payment.monto,
                fecha: payment.fechaPago,
                antes: payment.montoUsd,
                despues: usd,
              },
            ];
      });
    const affectedContracts = contractRows
      .filter(
        (row) =>
          !paymentRows.some(
            (payment) => payment.contratoId === row.contrato.id && payment.estado === "activo"
          ) &&
          Number(row.reserva.cuotaMensual) > 0 &&
          Number(row.reserva.saldoNum) > 0 &&
          (Number(row.contrato.tipoCambioBna) !== nextValue ||
            Number(row.contrato.cuotaBase) !==
              Number(moneyString(Number(row.reserva.cuotaMensual) * nextValue)) ||
            Number(row.contrato.saldoInicial) !==
              Number(moneyString(Number(row.reserva.saldoNum) * nextValue)))
      )
      .map((row) => ({
        id: row.contrato.id,
        antes: row.contrato.tipoCambioBna,
        cuota: row.reserva.cuotaMensual,
        saldo: row.reserva.saldoNum,
      }));
    const impact = { pagos: affectedPayments.length, contratos: affectedContracts.length };
    const confirmation = createHash("sha256")
      .update(
        JSON.stringify({
          fecha: input.fecha,
          valor: nextValue,
          payments: affectedPayments,
          contracts: affectedContracts,
        })
      )
      .digest("hex");
    if ((impact.pagos > 0 || impact.contratos > 0) && input.confirmarImpacto !== confirmation) {
      return { kind: "confirmation-required" as const, impact, confirmation };
    }
    const [row] = await tx
      .insert(tiposCambio)
      .values({
        fecha: input.fecha,
        tipo: BNA_VENDEDOR,
        valor: moneyString(input.valor),
        fuente: input.fuente ?? null,
        creadoPor: input.creadoPor ?? null,
      })
      .onConflictDoUpdate({
        target: [tiposCambio.fecha, tiposCambio.tipo],
        set: {
          valor: moneyString(input.valor),
          fuente: input.fuente ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await refreshPagoUsdValues(tx, input.fecha);
    await refreshUnpaidContractsForSigningDate(
      input.fecha,
      nextValue,
      tx,
      affectedContracts.map((item) => item.id)
    );
    return { kind: "ok" as const, row };
  });
}

async function refreshUnpaidContractsForSigningDate(
  fecha: string,
  tipoCambio: number,
  tx: CrmTransaction,
  affectedIds: number[]
) {
  const rows = await tx
    .select({ contrato: contratos, reserva: reservas })
    .from(contratos)
    .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
    .where(and(eq(contratos.modalidad, "pesos_cac"), eq(reservas.fechaFirma, fecha)));
  const updatedContractIds: number[] = [];

  for (const row of rows) {
    if (!affectedIds.includes(row.contrato.id)) continue;
    const activePayments = await tx
      .select({ id: pagos.id })
      .from(pagos)
      .where(and(eq(pagos.contratoId, row.contrato.id), eq(pagos.estado, "activo")))
      .limit(1);
    if (activePayments.length > 0) continue;

    const cuotaBaseUsd = Number(row.reserva.cuotaMensual);
    const saldoInicialUsd = Number(row.reserva.saldoNum);
    if (
      !Number.isFinite(cuotaBaseUsd) ||
      cuotaBaseUsd <= 0 ||
      !Number.isFinite(saldoInicialUsd) ||
      saldoInicialUsd <= 0
    ) {
      continue;
    }

    const cuotaBase = cuotaBaseUsd * tipoCambio;
    const saldoInicial = saldoInicialUsd * tipoCambio;
    await tx
      .update(contratos)
      .set({
        tipoCambioBna: moneyString(tipoCambio),
        cuotaBase: moneyString(cuotaBase),
        saldoInicial: moneyString(saldoInicial),
        updatedAt: new Date(),
      })
      .where(eq(contratos.id, row.contrato.id));
    await tx
      .update(cuotas)
      .set({
        importeBase: moneyString(cuotaBase),
        importeAjustado: null,
        saldo: moneyString(cuotaBase),
        estado: "pendiente_indice",
        updatedAt: new Date(),
      })
      .where(eq(cuotas.contratoId, row.contrato.id));
    updatedContractIds.push(row.contrato.id);
  }

  if (updatedContractIds.length > 0) {
    const { recomputeContratoCuotas } = await import("@/lib/cuenta-corriente");
    for (const contratoId of updatedContractIds) {
      await recomputeContratoCuotas(contratoId, tx);
    }
  }
}

export async function ensureCurrentBnaRate() {
  const today = argentinaTodayKey();
  const [stored] = await db
    .select()
    .from(tiposCambio)
    .where(and(eq(tiposCambio.tipo, BNA_VENDEDOR), eq(tiposCambio.fecha, today)))
    .limit(1);
  if (stored) return stored;

  const current = await getBnaBilleteVendedor();
  if (!current.available || current.sell === null) return null;
  return crmTransaction(async (tx) => {
    // La consulta automática solo agrega la cotización de hoy; nunca reescribe importes históricos.
    await tx
      .insert(tiposCambio)
      .values({
        fecha: today,
        tipo: BNA_VENDEDOR,
        valor: moneyString(current.sell!),
        fuente: current.source,
        creadoPor: "sistema",
      })
      .onConflictDoNothing({ target: [tiposCambio.fecha, tiposCambio.tipo] });
    const [row] = await tx
      .select()
      .from(tiposCambio)
      .where(and(eq(tiposCambio.tipo, BNA_VENDEDOR), eq(tiposCambio.fecha, today)));
    return row ?? null;
  });
}

async function refreshPagoUsdValues(tx: CrmTransaction, fecha: string): Promise<void> {
  const [paymentRows, rateRows] = await Promise.all([
    tx.select().from(pagos).orderBy(asc(pagos.fechaPago)),
    tx
      .select()
      .from(tiposCambio)
      .where(eq(tiposCambio.tipo, BNA_VENDEDOR))
      .orderBy(asc(tiposCambio.fecha)),
  ]);

  for (const pago of paymentRows) {
    const monto = Number(pago.monto);
    if (pago.moneda === "usd") {
      continue;
    }

    const rate = [...rateRows].reverse().find((item) => item.fecha <= pago.fechaPago);
    if (rate?.fecha !== fecha) continue;
    const valor = rate ? Number(rate.valor) : null;
    const montoUsd = valor && valor > 0 ? moneyString(monto / valor) : null;
    if (
      Number(pago.tipoCambioAplicado) === valor &&
      (pago.montoUsd === null ? null : moneyString(Number(pago.montoUsd))) === montoUsd
    )
      continue;
    await tx
      .update(pagos)
      .set({
        tipoCambioAplicado: valor && valor > 0 ? moneyString(valor) : null,
        montoUsd,
      })
      .where(eq(pagos.id, pago.id));
  }
}
