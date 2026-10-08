import type { EstadoParcela, EstadoReserva, ModalidadContrato, ParcelaConReserva } from "@/lib/schema";

// Fila de GET /api/crm/reservas (ver getFilteredReservas). createdAt es del lote;
// la fecha de creacion de la reserva viene en reservaCreatedAt.
export type ReservaRow = Omit<ParcelaConReserva, "id" | "estado" | "createdAt" | "updatedAt"> & {
  id: number;
  parcelaId: number;
  leadId: number | null;
  estado: EstadoReserva;
  nombreComprador: string | null;
  dniCuit: string | null;
  telefono: string | null;
  emailComprador: string | null;
  reservadoPor: string | null;
  fechaReserva: string | null;
  fechaVencimiento: string | null;
  fechaFirma: string | null;
  formaPago: string | null;
  modalidadContrato: ModalidadContrato | null;
  precioTotalNum: string | null;
  observaciones: string | null;
  cantidadCuotas: string | null;
  cuotaMensual: string | null;
  createdAt: string;
  updatedAt: string;
  reservaCreatedAt: string;
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
  loteEstado: EstadoParcela;
};

export const estadoLabels: Record<EstadoReserva, string> = {
  activa: "Activa",
  cancelada: "Cancelada",
  vencida: "Vencida",
  realizada: "Realizada",
};

export const estadoColors: Record<EstadoReserva, string> = {
  activa: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-700",
  vencida: "bg-amber-100 text-amber-700",
  realizada: "bg-blue-100 text-blue-700",
};

const modalidadContratoLabels: Record<ModalidadContrato, string> = {
  usd_fijo: "Financiado USD",
  pesos_cac: "Financiado CAC",
  requiere_revision: "Requiere revision",
};

const financedPaymentValues = new Set(["cuotas", "financiado"]);

// Activa o realizada: la reserva que ocupa el lote. Solo puede haber una por lote.
export function isVigente(estado: EstadoReserva | null | undefined) {
  return estado === "activa" || estado === "realizada";
}

export function normalizeDateKey(value: string | null) {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

export function formatDate(value: string | null) {
  const dateKey = normalizeDateKey(value);
  if (!dateKey) return "-";
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function hasInstallments(reserva: Pick<ReservaRow, "cantidadCuotas" | "cuotaMensual">) {
  return Boolean(reserva.cantidadCuotas?.trim() || reserva.cuotaMensual?.trim());
}

export function formatPaymentMode(
  reserva: Pick<ReservaRow, "formaPago" | "modalidadContrato" | "cantidadCuotas" | "cuotaMensual">
) {
  if (reserva.modalidadContrato) return modalidadContratoLabels[reserva.modalidadContrato];

  const formaPago = reserva.formaPago?.trim().toLowerCase();
  if (formaPago === "contado") return "Contado";
  if (formaPago && formaPago !== "-" && financedPaymentValues.has(formaPago)) return "Requiere revision";
  if (hasInstallments(reserva)) return "Requiere revision";
  return "-";
}

// Los dialogos de Reserva y Boleto esperan un lote con su reserva aplanada.
export function parcelaFromReserva(reserva: ReservaRow): ParcelaConReserva {
  return {
    ...reserva,
    id: reserva.parcelaId,
    estado: reserva.loteEstado,
    reservaId: reserva.id,
    reservaEstado: reserva.estado,
  } as unknown as ParcelaConReserva;
}

export function sortByCreatedDesc(rows: ReservaRow[]) {
  return [...rows].sort((a, b) => b.reservaCreatedAt.localeCompare(a.reservaCreatedAt));
}
