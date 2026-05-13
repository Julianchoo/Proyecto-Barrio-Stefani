import { and, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { flattenParcelaReserva } from "@/lib/reservas";
import { leads, parcelas, reservas } from "@/lib/schema";
import type { EstadoReserva, ParcelaConReserva } from "@/lib/schema";

export type ReservaReportRow = Omit<ParcelaConReserva, "id" | "estado"> & {
  id: number;
  estado: EstadoReserva;
  parcelaId: number;
  loteEstado: ParcelaConReserva["estado"];
  loteNumero: number;
  reservaEstado: EstadoReserva;
  reservaCreatedAt: Date;
  reservaUpdatedAt: Date;
};

function isDateKey(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getValues(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function getFilteredReservas(searchParams: URLSearchParams): Promise<ReservaReportRow[]> {
  const estados = getValues(searchParams, "estado") as EstadoReserva[];
  const reservadoPor = getValues(searchParams, "reservadoPor");
  const search = searchParams.get("search");
  const formaPago = searchParams.get("formaPago");
  const fechaReservaDesde = searchParams.get("fechaReservaDesde");
  const fechaReservaHasta = searchParams.get("fechaReservaHasta");
  const fechaVencimientoDesde = searchParams.get("fechaVencimientoDesde");
  const fechaVencimientoHasta = searchParams.get("fechaVencimientoHasta");
  const fechaFirmaDesde = searchParams.get("fechaFirmaDesde");
  const fechaFirmaHasta = searchParams.get("fechaFirmaHasta");

  const conditions = [];
  if (estados.length > 0) conditions.push(inArray(reservas.estado, estados));
  if (reservadoPor.length > 0) conditions.push(inArray(reservas.reservadoPor, reservadoPor));
  if (formaPago) conditions.push(ilike(reservas.formaPago, `%${formaPago}%`));
  if (isDateKey(fechaReservaDesde)) {
    conditions.push(gte(reservas.fechaReserva, fechaReservaDesde!));
  }
  if (isDateKey(fechaReservaHasta)) {
    conditions.push(lte(reservas.fechaReserva, fechaReservaHasta!));
  }
  if (isDateKey(fechaVencimientoDesde)) {
    conditions.push(gte(reservas.fechaVencimiento, fechaVencimientoDesde!));
  }
  if (isDateKey(fechaVencimientoHasta)) {
    conditions.push(lte(reservas.fechaVencimiento, fechaVencimientoHasta!));
  }
  if (isDateKey(fechaFirmaDesde)) {
    conditions.push(gte(reservas.fechaFirma, fechaFirmaDesde!));
  }
  if (isDateKey(fechaFirmaHasta)) {
    conditions.push(lte(reservas.fechaFirma, fechaFirmaHasta!));
  }
  if (search) {
    conditions.push(
      or(
        ilike(reservas.nombreComprador, `%${search}%`),
        ilike(reservas.dniCuit, `%${search}%`),
        ilike(parcelas.manzana, `%${search}%`),
        ilike(parcelas.parcela, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({ parcela: parcelas, reserva: reservas, lead: leads })
    .from(reservas)
    .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(reservas.fechaReserva, reservas.createdAt);

  return rows.map(({ parcela, reserva, lead }) => ({
    ...flattenParcelaReserva(parcela, reserva, lead),
    id: reserva.id,
    parcelaId: parcela.id,
    loteEstado: parcela.estado,
    loteNumero: parcela.numero,
    estado: reserva.estado,
    reservaEstado: reserva.estado,
    reservaCreatedAt: reserva.createdAt,
    reservaUpdatedAt: reserva.updatedAt,
  }));
}
