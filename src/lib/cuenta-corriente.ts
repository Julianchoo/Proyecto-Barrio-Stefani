import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureCurrentBnaRate } from "@/lib/tipos-cambio";
import { contratos, cuotas, indicesCac, leads, pagos, parcelas, reservas } from "@/lib/schema";
import type {
  Contrato,
  Cuota,
  EstadoCuota,
  IndiceCac,
  ModalidadContrato,
  MonedaPago,
  Pago,
  Reserva,
} from "@/lib/schema";

export type CuentaCorrienteSummary = {
  contratoId: number | null;
  reservaId: number;
  parcelaId: number;
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
  comprador: string | null;
  dniCuit: string | null;
  telefono: string | null;
  email: string | null;
  reservadoPor: string | null;
  modalidad: ModalidadContrato;
  requiereRevision: boolean;
  totalVencido: number;
  saldoPendiente: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  cuotasPendienteIndice: number;
  cuotasProyectadas: number;
  proximoVencimiento: string | null;
  proximaCuotaMonto: number | null;
  moneda: MonedaPago;
  cuentaEstado: "creada" | "pendiente";
  mensajeCuotas: string;
};

export type CuentaCorrienteDetail = CuentaCorrienteSummary & {
  contrato: Contrato;
  reserva: Reserva;
  cuotas: Cuota[];
  pagos: Pago[];
  indices: IndiceCac[];
  totalCobradoUsd: number | null;
  totalFuturoUsd: number | null;
  anticipoCobradoUsd: number;
  tipoCambioActual: number | null;
  fechasPagoSinTipoCambio: string[];
};

export type CreateContratoInput = {
  modalidad: ModalidadContrato;
  fechaInicio?: string | null | undefined;
  fechaPrimerVencimiento?: string | null | undefined;
  cantidadCuotas?: number | null | undefined;
  cuotaBase?: number | null | undefined;
  saldoInicial?: number | null | undefined;
  tipoCambioBna?: number | null | undefined;
  diaVencimiento?: number | null | undefined;
  periodoBaseCac?: string | null | undefined;
  observaciones?: string | null | undefined;
};

const FINAL_CUOTA_STATES: EstadoCuota[] = ["pagada", "cancelada"];

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyString(value: number) {
  return String(Math.max(0, Math.round(value * 100) / 100));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function periodFromDate(value: string) {
  return value.slice(0, 7);
}

function addMonthsToPeriod(period: string, monthsToAdd: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1 + monthsToAdd, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cacPeriodForDueDate(fechaVencimiento: string) {
  return addMonthsToPeriod(periodFromDate(fechaVencimiento), -2);
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

function sumActivePayments(items: Pago[]) {
  return items
    .filter((pago) => pago.estado === "activo")
    .reduce((total, pago) => total + (toNumber(pago.monto) ?? 0), 0);
}

function statusForCuota(
  fechaVencimiento: string,
  saldo: number,
  paid: number,
  amountKind: "real" | "projected" | "missing",
  currentEstado: EstadoCuota
): EstadoCuota {
  if (currentEstado === "cancelada") return "cancelada";
  if (saldo <= 0) return "pagada";
  const isOverdue = fechaVencimiento < todayKey();
  if (amountKind === "missing") return "pendiente_indice";
  if (isOverdue && paid > 0) return "parcial_vencida";
  if (isOverdue) return "vencida";
  return amountKind === "projected" ? "proyectada" : "calculada";
}

function latestKnownCacIndex(indexRows: IndiceCac[]) {
  const sorted = [...indexRows].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const latest = sorted.find((item) => {
    const value = toNumber(item.valor);
    return value !== null && value > 0;
  });
  const value = latest ? toNumber(latest.valor) : null;
  return latest && value !== null ? { periodo: latest.periodo, valor: value } : null;
}

function computeCuotaAmount(
  contrato: Contrato,
  cuota: Cuota,
  indicesByPeriodo: Map<string, number>,
  latestIndex: { periodo: string; valor: number } | null
) {
  const base = toNumber(cuota.importeBase) ?? 0;
  if (contrato.modalidad !== "pesos_cac") {
    return { amount: base, indiceCac: null, amountKind: "real" as const };
  }

  const basePeriod = contrato.periodoBaseCac;
  const cuotaPeriod = cacPeriodForDueDate(cuota.fechaVencimiento);
  const baseIndex =
    toNumber(contrato.indiceBaseCac) ?? (basePeriod ? indicesByPeriodo.get(basePeriod) : undefined);
  const cuotaIndex = indicesByPeriodo.get(cuotaPeriod);
  if (!baseIndex || baseIndex <= 0) {
    return { amount: null, indiceCac: null, amountKind: "missing" as const };
  }
  if (cuotaIndex && cuotaIndex > 0) {
    return {
      amount: base * (cuotaIndex / baseIndex),
      indiceCac: cuotaIndex,
      amountKind: "real" as const,
    };
  }
  if (cuota.fechaVencimiento >= todayKey() && latestIndex) {
    return {
      amount: base * (latestIndex.valor / baseIndex),
      indiceCac: latestIndex.valor,
      amountKind: "projected" as const,
    };
  }

  return { amount: null, indiceCac: null, amountKind: "missing" as const };
}

export async function recomputeContratoCuotas(contratoId: number) {
  const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId));
  if (!contrato) return;

  const [cuotaRows, pagoRows, indexRows] = await Promise.all([
    db.select().from(cuotas).where(eq(cuotas.contratoId, contratoId)).orderBy(asc(cuotas.numero)),
    db.select().from(pagos).where(eq(pagos.contratoId, contratoId)),
    db.select().from(indicesCac),
  ]);
  const indicesByPeriodo = new Map(
    indexRows.map((item) => [item.periodo, toNumber(item.valor) ?? 0])
  );
  const latestIndex = latestKnownCacIndex(indexRows);

  for (const cuota of cuotaRows) {
    if (cuota.estado === "cancelada") continue;
    const cuotaPagos = pagoRows.filter((pago) => pago.cuotaId === cuota.id);
    const paid = sumActivePayments(cuotaPagos);
    const computed = computeCuotaAmount(contrato, cuota, indicesByPeriodo, latestIndex);
    const saldo = computed.amount === null ? (toNumber(cuota.saldo) ?? 0) : computed.amount - paid;
    const nextEstado = statusForCuota(
      cuota.fechaVencimiento,
      Math.max(saldo, 0),
      paid,
      computed.amountKind,
      cuota.estado
    );

    await db
      .update(cuotas)
      .set({
        periodoCac:
          contrato.modalidad === "pesos_cac" ? cacPeriodForDueDate(cuota.fechaVencimiento) : null,
        indiceCac: computed.indiceCac === null ? null : moneyString(computed.indiceCac),
        importeAjustado: computed.amount === null ? null : moneyString(computed.amount),
        saldo: moneyString(saldo),
        estado: nextEstado,
        updatedAt: new Date(),
      })
      .where(eq(cuotas.id, cuota.id));
  }
}

export async function recomputeAllPesosCacCuotas() {
  const rows = await db
    .select({ id: contratos.id })
    .from(contratos)
    .where(eq(contratos.modalidad, "pesos_cac"));

  for (const row of rows) {
    await recomputeContratoCuotas(row.id);
  }
}

export async function createContratoForReserva(
  reservaId: number,
  input: CreateContratoInput,
  userEmail: string
) {
  const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!reserva) return { kind: "not-found" as const };
  if (reserva.estado !== "realizada") return { kind: "not-realizada" as const };

  const [existing] = await db
    .select({ id: contratos.id })
    .from(contratos)
    .where(eq(contratos.reservaId, reservaId));
  if (existing) return { kind: "exists" as const, contratoId: existing.id };

  const cantidadCuotas = input.cantidadCuotas ?? toNumber(reserva.cantidadCuotas);
  const cuotaBaseUsd = input.cuotaBase ?? toNumber(reserva.cuotaMensual);
  const saldoInicialUsd = input.saldoInicial ?? toNumber(reserva.saldoNum);
  const fechaInicio = input.fechaInicio ?? reserva.fechaFirma ?? reserva.fechaReserva;

  if (!cantidadCuotas || !cuotaBaseUsd || !saldoInicialUsd || !fechaInicio) {
    return { kind: "missing-data" as const };
  }
  if (input.modalidad === "pesos_cac" && (!input.tipoCambioBna || input.tipoCambioBna <= 0)) {
    return { kind: "missing-exchange-rate" as const };
  }

  const diaVencimiento = 10;
  const fechaPrimerVencimiento = addMonthsOnDay(fechaInicio, 1, diaVencimiento);
  const periodoBaseCac =
    input.modalidad === "pesos_cac" ? (input.periodoBaseCac ?? periodFromDate(fechaInicio)) : null;
  let indiceBaseCac: number | null = null;
  if (input.modalidad === "pesos_cac") {
    const [baseIndexRow] = await db
      .select({ valor: indicesCac.valor })
      .from(indicesCac)
      .where(eq(indicesCac.periodo, periodoBaseCac!))
      .limit(1);
    indiceBaseCac = toNumber(baseIndexRow?.valor);
    if (!indiceBaseCac || indiceBaseCac <= 0) {
      return { kind: "missing-base-cac" as const };
    }
  }
  const monedaBase: MonedaPago = input.modalidad === "pesos_cac" ? "ars" : "usd";
  const conversionRate = input.modalidad === "pesos_cac" ? input.tipoCambioBna! : 1;
  const cuotaBase = cuotaBaseUsd * conversionRate;
  const saldoInicial = saldoInicialUsd * conversionRate;

  const result = await db.transaction(async (tx) => {
    const [contrato] = await tx
      .insert(contratos)
      .values({
        reservaId,
        modalidad: input.modalidad,
        fechaInicio,
        fechaPrimerVencimiento,
        cantidadCuotas,
        diaVencimiento,
        saldoInicial: moneyString(saldoInicial),
        cuotaBase: moneyString(cuotaBase),
        monedaBase,
        periodoBaseCac,
        indiceBaseCac: indiceBaseCac === null ? null : moneyString(indiceBaseCac),
        requiereRevision: input.modalidad === "requiere_revision",
        observaciones: input.observaciones ?? null,
        creadoPor: userEmail,
      })
      .returning();
    if (!contrato) throw new Error("No se pudo crear el contrato");

    const cuotaValues = Array.from({ length: cantidadCuotas }, (_, index) => {
      const fechaVencimiento = addMonthsOnDay(fechaPrimerVencimiento, index, diaVencimiento);
      return {
        contratoId: contrato.id,
        numero: index + 1,
        fechaVencimiento,
        periodoCac: input.modalidad === "pesos_cac" ? cacPeriodForDueDate(fechaVencimiento) : null,
        importeBase: moneyString(cuotaBase),
        importeAjustado: input.modalidad === "usd_fijo" ? moneyString(cuotaBase) : null,
        moneda: monedaBase,
        saldo: moneyString(cuotaBase),
        estado:
          input.modalidad === "pesos_cac" ? ("pendiente_indice" as const) : ("pendiente" as const),
      };
    });

    await tx.insert(cuotas).values(cuotaValues);
    return contrato;
  });

  if (!result) throw new Error("No se pudo crear el contrato");
  await recomputeContratoCuotas(result.id);
  return { kind: "ok" as const, contratoId: result.id };
}

export async function getCuentaCorrienteDetailByReserva(reservaId: number) {
  const [row] = await db
    .select({
      contrato: contratos,
      reserva: reservas,
      parcela: parcelas,
      lead: leads,
    })
    .from(contratos)
    .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
    .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(and(eq(contratos.reservaId, reservaId), eq(reservas.estado, "realizada")));

  if (!row) return null;

  const currentRate = await ensureCurrentBnaRate();
  const [cuotaRows, pagoRows, indexRows] = await Promise.all([
    db
      .select()
      .from(cuotas)
      .where(eq(cuotas.contratoId, row.contrato.id))
      .orderBy(asc(cuotas.numero)),
    db
      .select()
      .from(pagos)
      .where(eq(pagos.contratoId, row.contrato.id))
      .orderBy(asc(pagos.fechaPago), asc(pagos.id)),
    db.select().from(indicesCac).orderBy(asc(indicesCac.periodo)),
  ]);

  const summary = buildSummary(row, cuotaRows);
  const activePayments = pagoRows.filter((pago) => pago.estado === "activo");
  const fechasPagoSinTipoCambio = Array.from(
    new Set(
      activePayments
        .filter((pago) => pago.moneda === "ars" && toNumber(pago.montoUsd) === null)
        .map((pago) => pago.fechaPago)
    )
  ).sort();
  const anticipoCobradoUsd = toNumber(row.reserva.anticipoNum) ?? 0;
  const pagosCobradosUsd = activePayments.reduce((total, pago) => {
    if (pago.moneda === "usd") return total + (toNumber(pago.monto) ?? 0);
    return total + (toNumber(pago.montoUsd) ?? 0);
  }, 0);
  const tipoCambioActual = toNumber(currentRate?.valor);
  const hasPendingArs = cuotaRows.some(
    (cuota) => !FINAL_CUOTA_STATES.includes(cuota.estado) && cuota.moneda === "ars"
  );
  const totalFuturoUsd =
    hasPendingArs && (!tipoCambioActual || tipoCambioActual <= 0)
      ? null
      : cuotaRows
          .filter((cuota) => !FINAL_CUOTA_STATES.includes(cuota.estado))
          .reduce((total, cuota) => {
            const saldo = toNumber(cuota.saldo) ?? 0;
            return total + (cuota.moneda === "ars" ? saldo / tipoCambioActual! : saldo);
          }, 0);
  return {
    ...summary,
    contrato: row.contrato,
    reserva: row.reserva,
    cuotas: cuotaRows,
    pagos: pagoRows,
    indices: indexRows,
    totalCobradoUsd:
      fechasPagoSinTipoCambio.length > 0 ? null : anticipoCobradoUsd + pagosCobradosUsd,
    totalFuturoUsd,
    anticipoCobradoUsd,
    tipoCambioActual,
    fechasPagoSinTipoCambio,
  };
}

export async function getCuentaCorrienteDetailByContrato(contratoId: number) {
  const [row] = await db
    .select({ reservaId: contratos.reservaId })
    .from(contratos)
    .where(eq(contratos.id, contratoId));
  if (!row) return null;
  return getCuentaCorrienteDetailByReserva(row.reservaId);
}

export async function getCuentasCorrientesSummaries() {
  const rows = await db
    .select({
      contrato: contratos,
      reserva: reservas,
      parcela: parcelas,
      lead: leads,
    })
    .from(contratos)
    .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
    .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(eq(reservas.estado, "realizada"))
    .orderBy(asc(parcelas.numero));

  const pendingRows = await db
    .select({
      reserva: reservas,
      parcela: parcelas,
      lead: leads,
    })
    .from(reservas)
    .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .leftJoin(contratos, eq(contratos.reservaId, reservas.id))
    .where(
      and(eq(reservas.estado, "realizada"), ne(reservas.formaPago, "contado"), isNull(contratos.id))
    )
    .orderBy(asc(parcelas.numero));

  const pendingSummaries = pendingRows.map((row) => buildPendingSummary(row));

  if (rows.length === 0) return pendingSummaries;

  const contratoIds = rows.map((row) => row.contrato.id);
  const cuotaRows = await db
    .select()
    .from(cuotas)
    .where(inArray(cuotas.contratoId, contratoIds))
    .orderBy(asc(cuotas.numero));
  const cuotasByContrato = new Map<number, Cuota[]>();
  for (const cuota of cuotaRows) {
    const list = cuotasByContrato.get(cuota.contratoId) ?? [];
    list.push(cuota);
    cuotasByContrato.set(cuota.contratoId, list);
  }

  return [
    ...rows.map((row) => buildSummary(row, cuotasByContrato.get(row.contrato.id) ?? [])),
    ...pendingSummaries,
  ].sort((a, b) => a.loteNumero - b.loteNumero);
}

function buildPendingSummary(row: {
  reserva: Reserva;
  parcela: typeof parcelas.$inferSelect;
  lead: typeof leads.$inferSelect | null;
}): CuentaCorrienteSummary {
  const modalidad = row.reserva.modalidadContrato ?? "requiere_revision";
  return {
    contratoId: null,
    reservaId: row.reserva.id,
    parcelaId: row.parcela.id,
    loteNumero: row.parcela.numero,
    manzana: row.parcela.manzana,
    parcela: row.parcela.parcela,
    comprador: row.lead?.nombre ?? row.reserva.nombreComprador,
    dniCuit: row.lead?.dniCuit ?? row.reserva.dniCuit,
    telefono: row.lead?.telefono ?? row.reserva.telefono,
    email: row.lead?.email ?? row.reserva.emailComprador,
    reservadoPor: row.reserva.reservadoPor,
    modalidad,
    requiereRevision: modalidad === "requiere_revision",
    totalVencido: 0,
    saldoPendiente: 0,
    cuotasPendientes: 0,
    cuotasVencidas: 0,
    cuotasPendienteIndice: 0,
    cuotasProyectadas: 0,
    proximoVencimiento: null,
    proximaCuotaMonto: null,
    moneda: modalidad === "pesos_cac" ? "ars" : "usd",
    cuentaEstado: "pendiente",
    mensajeCuotas: "",
  };
}

export function buildMensajeCuentaCorriente(
  summary: Pick<
    CuentaCorrienteSummary,
    | "comprador"
    | "loteNumero"
    | "totalVencido"
    | "saldoPendiente"
    | "moneda"
    | "proximoVencimiento"
    | "proximaCuotaMonto"
  >
) {
  const comprador = summary.comprador ?? "cliente";
  if (summary.totalVencido > 0) {
    return [
      `Hola ${comprador}, te escribimos por el estado de cuenta del lote ${summary.loteNumero}.`,
      `A la fecha registra un saldo vencido de ${formatCuentaMoney(summary.totalVencido, summary.moneda)}.`,
      `El saldo total pendiente es ${formatCuentaMoney(summary.saldoPendiente, summary.moneda)}.`,
      "Por favor avisanos cuando realices el pago para registrarlo en la cuenta corriente.",
    ].join("\n");
  }

  return [
    `Hola ${comprador}, te escribimos por el estado de cuenta del lote ${summary.loteNumero}.`,
    summary.proximoVencimiento && summary.proximaCuotaMonto !== null
      ? `La proxima cuota vence el ${summary.proximoVencimiento} por ${formatCuentaMoney(summary.proximaCuotaMonto, summary.moneda)}.`
      : "No registra cuotas pendientes a la fecha.",
    `El saldo total pendiente es ${formatCuentaMoney(summary.saldoPendiente, summary.moneda)}.`,
  ].join("\n");
}

function buildSummary(
  row: {
    contrato: Contrato;
    reserva: Reserva;
    parcela: typeof parcelas.$inferSelect;
    lead: typeof leads.$inferSelect | null;
  },
  cuotaRows: Cuota[]
): CuentaCorrienteSummary {
  const today = todayKey();
  const activeCuotas = cuotaRows.filter((cuota) => !FINAL_CUOTA_STATES.includes(cuota.estado));
  const overdueCuotas = activeCuotas.filter((cuota) => cuota.fechaVencimiento < today);
  const nextCuota = activeCuotas
    .filter((cuota) => cuota.fechaVencimiento >= today)
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))[0];

  const summary: CuentaCorrienteSummary = {
    contratoId: row.contrato.id,
    reservaId: row.reserva.id,
    parcelaId: row.parcela.id,
    loteNumero: row.parcela.numero,
    manzana: row.parcela.manzana,
    parcela: row.parcela.parcela,
    comprador: row.lead?.nombre ?? row.reserva.nombreComprador,
    dniCuit: row.lead?.dniCuit ?? row.reserva.dniCuit,
    telefono: row.lead?.telefono ?? row.reserva.telefono,
    email: row.lead?.email ?? row.reserva.emailComprador,
    reservadoPor: row.reserva.reservadoPor,
    modalidad: row.contrato.modalidad,
    requiereRevision: row.contrato.requiereRevision,
    totalVencido: overdueCuotas.reduce((total, cuota) => total + (toNumber(cuota.saldo) ?? 0), 0),
    saldoPendiente: activeCuotas.reduce((total, cuota) => total + (toNumber(cuota.saldo) ?? 0), 0),
    cuotasPendientes: activeCuotas.length,
    cuotasVencidas: overdueCuotas.length,
    cuotasPendienteIndice: cuotaRows.filter((cuota) => cuota.estado === "pendiente_indice").length,
    cuotasProyectadas: cuotaRows.filter((cuota) => cuota.estado === "proyectada").length,
    proximoVencimiento: nextCuota?.fechaVencimiento ?? null,
    proximaCuotaMonto: nextCuota
      ? (toNumber(nextCuota.importeAjustado) ?? toNumber(nextCuota.importeBase))
      : null,
    moneda: row.contrato.monedaBase,
    cuentaEstado: "creada",
    mensajeCuotas: "",
  };

  return {
    ...summary,
    mensajeCuotas: buildMensajeCuentaCorriente(summary),
  };
}

export function formatCuentaMoney(value: number | string | null, moneda: MonedaPago) {
  const amount = toNumber(value);
  if (amount === null) return "-";
  const prefix = moneda === "usd" ? "USD" : "$";
  return `${prefix} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
