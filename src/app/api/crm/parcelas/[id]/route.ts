import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, parcelas, reservas } from "@/lib/schema";
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
  "reservaPalabras",
  "reservaNum",
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
    reservaPalabras: z.string().nullable().optional(),
    reservaNum: z.string().nullable().optional(),
    anticipoPalabras: z.string().nullable().optional(),
    anticipoNum: z.string().nullable().optional(),
    saldoPalabras: z.string().nullable().optional(),
    saldoNum: z.string().nullable().optional(),
    cantidadCuotas: z.string().nullable().optional(),
    cuotaMensualPalabras: z.string().nullable().optional(),
    cuotaMensual: z.string().nullable().optional(),
    circunscripcion: z.string().nullable().optional(),
    seccion: z.string().nullable().optional(),
    manzana: z.string().nullable().optional(),
    parcela: z.string().nullable().optional(),
    partidaArba: z.string().nullable().optional(),
    partidaMunicipal: z.string().nullable().optional(),
    escritura: z.string().nullable().optional(),
    matriculaFolio: z.string().nullable().optional(),
    certificadoCatastral: z.string().nullable().optional(),
    precioBase: z.string().nullable().optional(),
    precioEtapa1: z.string().nullable().optional(),
    valorM2: z.string().nullable().optional(),
    valuacionFiscal: z.string().nullable().optional(),
    vfAlActo: z.string().nullable().optional(),
    superficieM2: z.string().nullable().optional(),
    metrosFrente: z.string().nullable().optional(),
    metrosFondo: z.string().nullable().optional(),
    calleFrente: z.string().nullable().optional(),
    calleLindera1: z.string().nullable().optional(),
    calleLindera2: z.string().nullable().optional(),
    anticipoPct: z.string().nullable().optional(),
    tasaMensual: z.string().nullable().optional(),
    anticipoUsd: z.string().nullable().optional(),
    saldoUsd: z.string().nullable().optional(),
    cuotas48: z.string().nullable().optional(),
    cuotas60: z.string().nullable().optional(),
    nota: z.string().nullable().optional(),
  })
  .strict();

const PARCELA_ADMIN_FIELDS = [
  "circunscripcion",
  "seccion",
  "manzana",
  "parcela",
  "partidaArba",
  "partidaMunicipal",
  "escritura",
  "matriculaFolio",
  "certificadoCatastral",
  "precioBase",
  "precioEtapa1",
  "valorM2",
  "valuacionFiscal",
  "vfAlActo",
  "superficieM2",
  "metrosFrente",
  "metrosFondo",
  "calleFrente",
  "calleLindera1",
  "calleLindera2",
  "anticipoPct",
  "tasaMensual",
  "anticipoUsd",
  "saldoUsd",
  "cuotas48",
  "cuotas60",
  "nota",
] as const;

const PARCELA_COMERCIAL_FIELDS = [
  "superficieM2",
  "metrosFrente",
  "metrosFondo",
  "calleFrente",
  "calleLindera1",
  "calleLindera2",
] as const;

function hasReservaValue(data: Record<string, unknown>) {
  return Object.values(data).some((value) => value !== null && value !== "");
}

function numericValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateValorM2(precioBase: unknown, superficieM2: unknown) {
  const precio = numericValue(precioBase);
  const superficie = numericValue(superficieM2);
  if (precio === null || superficie === null || superficie <= 0) return null;
  return String(Number((precio / superficie).toFixed(2)));
}

function hasAnyField(data: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((field) => field in data);
}

function isReservaCreation(
  data: { estado?: string | undefined },
  activeReserva: unknown,
  shouldTouchReserva: boolean
) {
  return !activeReserva && (data.estado === "reservado" || shouldTouchReserva);
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
      for (const field of PARCELA_COMERCIAL_FIELDS) {
        if (field in data) allowedData[field] = data[field];
      }
    }

    const result = await db.transaction(async (tx) => {
      const [currentRow] = await tx
        .select({ parcela: parcelas, reserva: reservas, lead: leads })
        .from(parcelas)
        .leftJoin(reservas, activeReservaJoin())
        .leftJoin(leads, eq(reservas.leadId, leads.id))
        .where(eq(parcelas.id, parcelaId));

      if (!currentRow) return { kind: "not-found" as const };

      const { parcela: current, reserva: activeReserva } = currentRow;
      const isReservedByOther =
        current.estado === "reservado" &&
        activeReserva &&
        authResult.role !== "admin" &&
        activeReserva.reservadoPor !== authResult.email;

      if (isReservedByOther) return { kind: "forbidden" as const };

      const touchesCommercialParcelaFields = hasAnyField(
        allowedData,
        PARCELA_COMERCIAL_FIELDS
      );
      const canComercialEditParcelaFields =
        authResult.role === "admin" ||
        current.estado === "disponible" ||
        activeReserva?.reservadoPor === authResult.email;

      if (
        authResult.role !== "admin" &&
        touchesCommercialParcelaFields &&
        !canComercialEditParcelaFields
      ) {
        return { kind: "forbidden" as const };
      }

      const parcelaData: Record<string, unknown> = {};
      if ("estado" in allowedData) parcelaData.estado = allowedData.estado;
      if (authResult.role === "admin") {
        for (const field of PARCELA_ADMIN_FIELDS) {
          if (field in allowedData) parcelaData[field] = allowedData[field];
        }
      } else {
        for (const field of PARCELA_COMERCIAL_FIELDS) {
          if (field in allowedData) parcelaData[field] = allowedData[field];
        }
      }
      if ("precioBase" in allowedData || "superficieM2" in parcelaData) {
        parcelaData.valorM2 = calculateValorM2(
          "precioBase" in allowedData
            ? allowedData.precioBase
            : current.precioBase ?? current.precioEtapa1,
          "superficieM2" in parcelaData ? parcelaData.superficieM2 : current.superficieM2
        );
      }

      const reservaData = pickReservaData(allowedData);
      const shouldTouchReserva = activeReserva
        ? hasReservaData(reservaData)
        : hasReservaValue(reservaData);
      const requestedLeadId =
        "leadId" in reservaData ? (reservaData.leadId as number | null) : activeReserva?.leadId ?? null;
      const needsLead = isReservaCreation(data, activeReserva, shouldTouchReserva);

      if (needsLead && !requestedLeadId) {
        return { kind: "missing-lead" as const };
      }

      if (requestedLeadId) {
        const leadConditions = [eq(leads.id, requestedLeadId)];
        if (authResult.role !== "admin") {
          leadConditions.push(eq(leads.asignadoA, authResult.id));
        }
        const [selectedLead] = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(and(...leadConditions));

        if (!selectedLead) return { kind: "invalid-lead" as const };
      }

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
        .select({ parcela: parcelas, reserva: reservas, lead: leads })
        .from(parcelas)
        .leftJoin(reservas, activeReservaJoin())
        .leftJoin(leads, eq(reservas.leadId, leads.id))
        .where(eq(parcelas.id, parcelaId));
      if (!updatedRow) return { kind: "not-found" as const };

      return {
        kind: "ok" as const,
        data: flattenParcelaReserva(updatedRow.parcela, updatedRow.reserva, updatedRow.lead),
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
    if (result.kind === "missing-lead") {
      return NextResponse.json(
        { error: "Seleccioná un lead antes de reservar el lote" },
        { status: 400 }
      );
    }
    if (result.kind === "invalid-lead") {
      return NextResponse.json(
        { error: "El lead seleccionado no existe o no tenés permiso para usarlo" },
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
    .select({ parcela: parcelas, reserva: reservas, lead: leads })
    .from(parcelas)
    .leftJoin(reservas, activeReservaJoin())
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(eq(parcelas.id, parcelaId));

  if (!row) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  return NextResponse.json(flattenParcelaReserva(row.parcela, row.reserva, row.lead));
}
