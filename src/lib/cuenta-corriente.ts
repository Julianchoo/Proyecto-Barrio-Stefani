import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
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
import { argentinaTodayKey, ensureCurrentBnaRate } from "@/lib/tipos-cambio";

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

type MensajeCuentaCorrienteInput = Pick<
  CuentaCorrienteSummary,
  "comprador" | "manzana" | "parcela" | "modalidad"
> & {
  contrato: Pick<Contrato, "indiceBaseCac">;
  cuotas: Cuota[];
  tipoCambioActual: number | null;
  fechaTipoCambioActual: string | null;
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
  fechaTipoCambioActual: string | null;
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
  return argentinaTodayKey();
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
        tipoCambioBna:
          input.modalidad === "pesos_cac" ? moneyString(conversionRate) : null,
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

  const summary = buildSummary(row, cuotaRows, currentRate);
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
    fechaTipoCambioActual: currentRate?.fecha ?? null,
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

  const currentRate = await ensureCurrentBnaRate();

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
    ...rows.map((row) =>
      buildSummary(row, cuotasByContrato.get(row.contrato.id) ?? [], currentRate)
    ),
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

const DATOS_CUENTA = [
  "Los datos de la cuenta Bancaria para TRANSFERIR son:",
  "Nombre: Edgardo Fernando Pashkowec",
  "CUIT: 20-31144417-5",
  "Alias: zuaque.cubren.zanoni",
  "CVU: 0000397900000000001317",
].join("\n");

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatCommunicationDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

function formatCommunicationPeriod(value: string) {
  const [year, month] = value.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    month: "short",
  })
    .format(new Date(Date.UTC(year!, month! - 1, 1)))
    .replace(".", "");
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}${String(year).slice(-2)}`;
}

function selectCuotaForCommunication(items: Cuota[]) {
  const today = todayKey();
  const calculated = items.filter(
    (cuota) =>
      !FINAL_CUOTA_STATES.includes(cuota.estado) &&
      cuota.estado !== "proyectada" &&
      cuota.importeAjustado !== null
  );
  return (
    calculated
      .filter((cuota) => cuota.fechaVencimiento >= today)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))[0] ??
    calculated
      .filter((cuota) => cuota.fechaVencimiento < today)
      .sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento))[0] ??
    null
  );
}

export function buildMensajeCuentaCorriente(input: MensajeCuentaCorrienteInput) {
  const comprador = input.comprador ?? "cliente";
  const lote = input.parcela ?? "-";
  const manzana = input.manzana ?? "-";
  const encabezado = `Estimado/a ${comprador} (M${manzana}-L${lote}):`;
  const introduccion =
    "Antes que nada, le agradecemos la confianza depositada al acompañarnos en este proyecto.";
  const cuota = selectCuotaForCommunication(input.cuotas);

  if (input.modalidad === "requiere_revision") {
    return [
      encabezado,
      introduccion,
      "No se pudo generar la liquidación porque la modalidad del contrato requiere revisión.",
    ].join("\n\n");
  }

  if (!cuota) {
    const hasPendingCuotas = input.cuotas.some(
      (item) => !FINAL_CUOTA_STATES.includes(item.estado)
    );
    return [
      encabezado,
      introduccion,
      hasPendingCuotas
        ? "La próxima cuota se encuentra pendiente de cálculo por falta del índice CAC correspondiente."
        : "No registra cuotas pendientes a la fecha.",
    ].join("\n\n");
  }

  const period = formatCommunicationPeriod(cuota.fechaVencimiento.slice(0, 7));
  const dueDate = formatCommunicationDate(cuota.fechaVencimiento);
  const adjustedAmount = toNumber(cuota.importeAjustado);
  if (adjustedAmount === null) {
    return [encabezado, introduccion, "No se pudo determinar el importe de la cuota."].join(
      "\n\n"
    );
  }

  if (input.modalidad === "pesos_cac") {
    const baseAmount = toNumber(cuota.importeBase);
    const baseIndex = toNumber(input.contrato.indiceBaseCac);
    const currentIndex = toNumber(cuota.indiceCac);
    if (baseAmount === null || baseIndex === null || currentIndex === null) {
      return [
        encabezado,
        introduccion,
        "La próxima cuota se encuentra pendiente de cálculo por falta del índice CAC correspondiente.",
      ].join("\n\n");
    }
    return [
      encabezado,
      introduccion,
      `El valor de la cuota ${period}, con vencimiento el ${dueDate}, es de $${formatNumber(adjustedAmount)} pesos.`,
      [
        "Detalle de liquidación:",
        `Monto Base = $${formatNumber(baseAmount)}`,
        `Índice Base = ${formatNumber(baseIndex, 3)}`,
        `Índice Actual = ${formatNumber(currentIndex, 3)}`,
        `Cuota Actual = Índice Actual / Índice Base * Monto Base = $${formatNumber(adjustedAmount)}`,
      ].join("\n"),
      DATOS_CUENTA,
      "Por otro lado, les recordamos que para aquellos casos de fuerza mayor en los que se tenga que abonar en pesos en efectivo, deberán coordinar la visita presencial con un mínimo de 48 horas de anticipación.",
    ].join("\n\n");
  }

  if (!input.tipoCambioActual || !input.fechaTipoCambioActual) {
    return [
      encabezado,
      introduccion,
      "No se pudo generar la liquidación porque falta el Tipo de Cambio BNA vendedor del día.",
    ].join("\n\n");
  }
  const amountArs = adjustedAmount * input.tipoCambioActual;
  return [
    encabezado,
    introduccion,
    `El valor de la cuota ${period}, con vencimiento el ${dueDate}, es de $${formatNumber(amountArs)} pesos. Correspondiente a ${formatNumber(adjustedAmount)} USD a ${formatNumber(input.tipoCambioActual)} Tipo de Cambio BNA del día ${formatCommunicationDate(input.fechaTipoCambioActual)}.`,
    DATOS_CUENTA,
    "Por otro lado, les recordamos que para aquellos casos de fuerza mayor en los que se tenga que abonar en dólares en efectivo, deberán coordinar la visita presencial con un mínimo de 48 horas de anticipación.",
    "Les recordamos que los únicos medios habilitados de comunicación oficial para recepción de LOS COMPROBANTES DE TRANSFERENCIA Y LA COORDINACIÓN DE LA VISITA PARA PAGO son el correo electrónico INFO@EULERDESARROLLOS.COM.AR",
  ].join("\n\n");
}

function buildSummary(
  row: {
    contrato: Contrato;
    reserva: Reserva;
    parcela: typeof parcelas.$inferSelect;
    lead: typeof leads.$inferSelect | null;
  },
  cuotaRows: Cuota[],
  currentRate: { valor: unknown; fecha: string } | null = null
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
    mensajeCuotas: buildMensajeCuentaCorriente({
      ...summary,
      contrato: row.contrato,
      cuotas: cuotaRows,
      tipoCambioActual: toNumber(currentRate?.valor),
      fechaTipoCambioActual: currentRate?.fecha ?? null,
    }),
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
