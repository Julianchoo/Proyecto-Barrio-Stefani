import { NextResponse } from "next/server";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parcelas, reservas } from "@/lib/schema";
import type { EstadoReserva } from "@/lib/schema";

function isDateKey(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as EstadoReserva | null;
  const search = searchParams.get("search");
  const reservadoPor = searchParams.get("reservadoPor");
  const formaPago = searchParams.get("formaPago");
  const fechaReservaDesde = searchParams.get("fechaReservaDesde");
  const fechaReservaHasta = searchParams.get("fechaReservaHasta");
  const fechaVencimientoDesde = searchParams.get("fechaVencimientoDesde");
  const fechaVencimientoHasta = searchParams.get("fechaVencimientoHasta");
  const fechaFirmaDesde = searchParams.get("fechaFirmaDesde");
  const fechaFirmaHasta = searchParams.get("fechaFirmaHasta");

  const conditions = [];
  if (estado) conditions.push(eq(reservas.estado, estado));
  if (reservadoPor) conditions.push(eq(reservas.reservadoPor, reservadoPor));
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
    .select({
      id: reservas.id,
      parcelaId: reservas.parcelaId,
      leadId: reservas.leadId,
      estado: reservas.estado,
      nombreComprador: reservas.nombreComprador,
      dniCuit: reservas.dniCuit,
      telefono: reservas.telefono,
      emailComprador: reservas.emailComprador,
      reservadoPor: reservas.reservadoPor,
      fechaReserva: reservas.fechaReserva,
      fechaVencimiento: reservas.fechaVencimiento,
      fechaFirma: reservas.fechaFirma,
      formaPago: reservas.formaPago,
      precioTotalNum: reservas.precioTotalNum,
      observaciones: reservas.observaciones,
      createdAt: reservas.createdAt,
      updatedAt: reservas.updatedAt,
      loteNumero: parcelas.numero,
      manzana: parcelas.manzana,
      parcela: parcelas.parcela,
      loteEstado: parcelas.estado,
    })
    .from(reservas)
    .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(reservas.fechaReserva, reservas.createdAt);

  return NextResponse.json(rows);
}
