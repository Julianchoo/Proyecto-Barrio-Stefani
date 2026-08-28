import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getBnaBilleteVendedor } from "@/lib/bna-exchange-rate";
import { db } from "@/lib/db";
import { pagos, tiposCambio } from "@/lib/schema";

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

export async function getTipoCambioOnOrBefore(fecha: string) {
  const [row] = await db
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
}) {
  const [row] = await db
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

  await refreshPagoUsdValues();
  return row;
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
  return saveTipoCambioBna({
    fecha: today,
    valor: current.sell,
    fuente: current.source,
    creadoPor: "sistema",
  });
}

export async function refreshPagoUsdValues() {
  const [paymentRows, rateRows] = await Promise.all([
    db.select().from(pagos).orderBy(asc(pagos.fechaPago)),
    db
      .select()
      .from(tiposCambio)
      .where(eq(tiposCambio.tipo, BNA_VENDEDOR))
      .orderBy(asc(tiposCambio.fecha)),
  ]);

  for (const pago of paymentRows) {
    const monto = Number(pago.monto);
    if (pago.moneda === "usd") {
      await db
        .update(pagos)
        .set({ tipoCambioAplicado: null, montoUsd: moneyString(monto) })
        .where(eq(pagos.id, pago.id));
      continue;
    }

    const rate = [...rateRows].reverse().find((item) => item.fecha <= pago.fechaPago);
    const valor = rate ? Number(rate.valor) : null;
    await db
      .update(pagos)
      .set({
        tipoCambioAplicado: valor && valor > 0 ? moneyString(valor) : null,
        montoUsd: valor && valor > 0 ? moneyString(monto / valor) : null,
      })
      .where(eq(pagos.id, pago.id));
  }
}
