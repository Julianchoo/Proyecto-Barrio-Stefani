import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { parcelas, reservas } from "@/lib/schema";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import {
  activeReservaJoin,
  flattenParcelaReserva,
  hasReservaData,
  pickReservaData,
} from "@/lib/reservas";

const COMERCIAL_FIELDS = [
  "estado",
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

const updateSchema = z
  .object({
    estado: z.enum(["disponible", "no_disponible", "reservado", "vendido"]).optional(),
    leadId: z.number().nullable().optional(),
    nombreComprador: z.string().nullable().optional(),
    dniCuit: z.string().nullable().optional(),
    telefono: z.string().nullable().optional(),
    emailComprador: z.string().email().nullable().optional(),
    domicilioComprador: z.string().nullable().optional(),
    nacionalidad: z.string().nullable().optional(),
    fechaNacimiento: z.string().nullable().optional(),
    estadoCivil: z.string().nullable().optional(),
    cuitComprador: z.string().nullable().optional(),
    nombreCoComprador: z.string().nullable().optional(),
    dniCoComprador: z.string().nullable().optional(),
    cuitCoComprador: z.string().nullable().optional(),
    estadoCivilCoComprador: z.string().nullable().optional(),
    porcentajeCoComprador: z.string().nullable().optional(),
    tipoEntrega: z.string().nullable().optional(),
    mesEntrega: z.string().nullable().optional(),
    anioEntrega: z.string().nullable().optional(),
    nombreCorredor: z.string().nullable().optional(),
    emailCorredor: z.string().email().nullable().optional(),
    formaPago: z.string().nullable().optional(),
    fechaReserva: z.string().nullable().optional(),
    fechaVencimiento: z.string().nullable().optional(),
    fechaFirma: z.string().nullable().optional(),
    observaciones: z.string().nullable().optional(),
    precioTotalPalabras: z.string().nullable().optional(),
    precioTotalNum: z.string().nullable().optional(),
    anticipoPalabras: z.string().nullable().optional(),
    anticipoNum: z.string().nullable().optional(),
    saldoPalabras: z.string().nullable().optional(),
    saldoNum: z.string().nullable().optional(),
    cantidadCuotas: z.string().nullable().optional(),
    cuotaMensualPalabras: z.string().nullable().optional(),
    cuotaMensual: z.string().nullable().optional(),
    precioEtapa1: z.string().nullable().optional(),
    valorM2: z.string().nullable().optional(),
    superficieM2: z.string().nullable().optional(),
    metrosFrente: z.string().nullable().optional(),
    metrosFondo: z.string().nullable().optional(),
    nota: z.string().nullable().optional(),
  })
  .strict();

const PARCELA_ADMIN_FIELDS = [
  "precioEtapa1",
  "valorM2",
  "superficieM2",
  "metrosFrente",
  "metrosFondo",
  "nota",
] as const;

function hasReservaValue(data: Record<string, unknown>) {
  return Object.values(data).some((value) => value !== null && value !== "");
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    let allowedData: Record<string, unknown> = {};
    if (authResult.role === "admin") {
      allowedData = { ...data };
    } else {
      for (const field of COMERCIAL_FIELDS) {
        if (field in data) allowedData[field] = data[field];
      }
    }

    const result = await db.transaction(async (tx) => {
      const [currentRow] = await tx
        .select({ parcela: parcelas, reserva: reservas })
        .from(parcelas)
        .leftJoin(reservas, activeReservaJoin())
        .where(eq(parcelas.id, parcelaId));

      if (!currentRow) return { kind: "not-found" as const };

      const { parcela: current, reserva: activeReserva } = currentRow;
      const isReservedByOther =
        current.estado === "reservado" &&
        activeReserva &&
        authResult.role !== "admin" &&
        activeReserva.reservadoPor !== authResult.email;

      if (isReservedByOther) return { kind: "forbidden" as const };

      const parcelaData: Record<string, unknown> = {};
      if ("estado" in allowedData) parcelaData.estado = allowedData.estado;
      if (authResult.role === "admin") {
        for (const field of PARCELA_ADMIN_FIELDS) {
          if (field in allowedData) parcelaData[field] = allowedData[field];
        }
      }

      const reservaData = pickReservaData(allowedData);
      const shouldTouchReserva = activeReserva
        ? hasReservaData(reservaData)
        : hasReservaValue(reservaData);

      if (data.estado && data.estado !== "reservado") {
        parcelaData.estado = data.estado;
        if (activeReserva) {
          await tx
            .update(reservas)
            .set({
              estado: "cancelada",
              modificadoPor: authResult.email,
              updatedAt: new Date(),
            })
            .where(eq(reservas.id, activeReserva.id));
        }
      } else if (data.estado === "reservado" || shouldTouchReserva) {
        parcelaData.estado = "reservado";
        if (activeReserva) {
          await tx
            .update(reservas)
            .set({
              ...reservaData,
              modificadoPor: authResult.email,
              updatedAt: new Date(),
            })
            .where(eq(reservas.id, activeReserva.id));
        } else {
          await tx.insert(reservas).values({
            parcelaId,
            ...reservaData,
            estado: "activa",
            reservadoPor: authResult.email,
            modificadoPor: authResult.email,
          });
        }
      }

      if (Object.keys(parcelaData).length > 0) {
        await tx
          .update(parcelas)
          .set(parcelaData)
          .where(eq(parcelas.id, parcelaId));
      }

      const [updatedRow] = await tx
        .select({ parcela: parcelas, reserva: reservas })
        .from(parcelas)
        .leftJoin(reservas, activeReservaJoin())
        .where(eq(parcelas.id, parcelaId));
      if (!updatedRow) return { kind: "not-found" as const };

      return {
        kind: "ok" as const,
        data: flattenParcelaReserva(updatedRow.parcela, updatedRow.reserva),
      };
    });

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(
        { error: "Este lote fue reservado por otro comercial" },
        { status: 403 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos invalidos", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const [row] = await db
    .select({ parcela: parcelas, reserva: reservas })
    .from(parcelas)
    .leftJoin(reservas, activeReservaJoin())
    .where(eq(parcelas.id, parcelaId));

  if (!row) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  return NextResponse.json(flattenParcelaReserva(row.parcela, row.reserva));
}
