import { and, eq } from "drizzle-orm";
import { parcelas, reservas } from "@/lib/schema";
import type { Lead, Parcela, ParcelaConReserva, Reserva } from "@/lib/schema";

export const RESERVA_FIELDS = [
  "leadId",
  "nombreComprador",
  "dniCuit",
  "telefono",
  "emailComprador",
  "domicilioComprador",
  "nacionalidad",
  "fechaNacimiento",
  "estadoCivil",
  "cuitComprador",
  "nombreCoComprador",
  "dniCoComprador",
  "cuitCoComprador",
  "estadoCivilCoComprador",
  "porcentajeCoComprador",
  "tipoEntrega",
  "mesEntrega",
  "anioEntrega",
  "nombreCorredor",
  "emailCorredor",
  "formaPago",
  "fechaReserva",
  "fechaVencimiento",
  "fechaFirma",
  "observaciones",
  "precioTotalPalabras",
  "precioTotalNum",
  "anticipoPalabras",
  "anticipoNum",
  "saldoPalabras",
  "saldoNum",
  "cantidadCuotas",
  "cuotaMensualPalabras",
  "cuotaMensual",
] as const;

export type ReservaField = (typeof RESERVA_FIELDS)[number];

const EMPTY_RESERVA_FIELDS = {
  leadId: null,
  nombreComprador: null,
  dniCuit: null,
  telefono: null,
  emailComprador: null,
  domicilioComprador: null,
  nacionalidad: null,
  fechaNacimiento: null,
  estadoCivil: null,
  cuitComprador: null,
  nombreCoComprador: null,
  dniCoComprador: null,
  cuitCoComprador: null,
  estadoCivilCoComprador: null,
  porcentajeCoComprador: null,
  tipoEntrega: null,
  mesEntrega: null,
  anioEntrega: null,
  nombreCorredor: null,
  emailCorredor: null,
  formaPago: null,
  fechaReserva: null,
  fechaVencimiento: null,
  fechaFirma: null,
  modificadoPor: null,
  reservadoPor: null,
  observaciones: null,
  precioTotalPalabras: null,
  precioTotalNum: null,
  anticipoPalabras: null,
  anticipoNum: null,
  saldoPalabras: null,
  saldoNum: null,
  cantidadCuotas: null,
  cuotaMensualPalabras: null,
  cuotaMensual: null,
};

export function activeReservaJoin() {
  return and(eq(reservas.parcelaId, parcelas.id), eq(reservas.estado, "activa"));
}

export function flattenParcelaReserva(
  parcela: Parcela,
  reserva: Reserva | null,
  lead?: Lead | null
): ParcelaConReserva {
  if (!reserva) {
    return {
      ...parcela,
      ...EMPTY_RESERVA_FIELDS,
      reservaId: null,
      leadEstado: null,
      leadAsignadoA: null,
    };
  }

  const leadData = lead
    ? {
        nombreComprador: lead.nombre,
        dniCuit: lead.dniCuit,
        telefono: lead.telefono,
        emailComprador: lead.email,
        domicilioComprador: lead.domicilio,
        nacionalidad: lead.nacionalidad,
        fechaNacimiento: lead.fechaNacimiento,
        estadoCivil: lead.estadoCivil,
        cuitComprador: lead.cuitComprador,
      }
    : {
        nombreComprador: reserva.nombreComprador,
        dniCuit: reserva.dniCuit,
        telefono: reserva.telefono,
        emailComprador: reserva.emailComprador,
        domicilioComprador: reserva.domicilioComprador,
        nacionalidad: reserva.nacionalidad,
        fechaNacimiento: reserva.fechaNacimiento,
        estadoCivil: reserva.estadoCivil,
        cuitComprador: reserva.cuitComprador,
      };

  return {
    ...parcela,
    reservaId: reserva.id,
    leadId: reserva.leadId,
    ...leadData,
    leadEstado: lead?.estado ?? null,
    leadAsignadoA: lead?.asignadoA ?? null,
    nombreCoComprador: reserva.nombreCoComprador,
    dniCoComprador: reserva.dniCoComprador,
    cuitCoComprador: reserva.cuitCoComprador,
    estadoCivilCoComprador: reserva.estadoCivilCoComprador,
    porcentajeCoComprador: reserva.porcentajeCoComprador,
    tipoEntrega: reserva.tipoEntrega,
    mesEntrega: reserva.mesEntrega,
    anioEntrega: reserva.anioEntrega,
    nombreCorredor: reserva.nombreCorredor,
    emailCorredor: reserva.emailCorredor,
    formaPago: reserva.formaPago,
    fechaReserva: reserva.fechaReserva,
    fechaVencimiento: reserva.fechaVencimiento,
    fechaFirma: reserva.fechaFirma,
    modificadoPor: reserva.modificadoPor,
    reservadoPor: reserva.reservadoPor,
    observaciones: reserva.observaciones,
    precioTotalPalabras: reserva.precioTotalPalabras,
    precioTotalNum: reserva.precioTotalNum,
    anticipoPalabras: reserva.anticipoPalabras,
    anticipoNum: reserva.anticipoNum,
    saldoPalabras: reserva.saldoPalabras,
    saldoNum: reserva.saldoNum,
    cantidadCuotas: reserva.cantidadCuotas,
    cuotaMensualPalabras: reserva.cuotaMensualPalabras,
    cuotaMensual: reserva.cuotaMensual,
  };
}

export function pickReservaData(data: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const field of RESERVA_FIELDS) {
    if (field in data) picked[field] = data[field];
  }
  return picked;
}

export function hasReservaData(data: Record<string, unknown>) {
  return RESERVA_FIELDS.some((field) => data[field] !== undefined);
}
