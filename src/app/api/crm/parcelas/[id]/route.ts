import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMinimumAnticipoUsd } from "@/lib/financiacion";
import { leads, parcelas, reservas } from "@/lib/schema";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import {
  currentReservaJoin,
  flattenParcelaReserva,
  hasReservaData,
  pickReservaData,
} from "@/lib/reservas";

const COMERCIAL_FIELDS = [
  "estado",
  "leadId",
  "nombreCoComprador",
  "dniCoComprador",
  "nacionalidadCoComprador",
  "fechaNacimientoCoComprador",
  "domicilioCoComprador",
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
  "modalidadContrato",
] as const;

const updateSchema = z
  .object({
    // A mano solo se alterna disponible <-> no disponible. "Reservado" y "vendido"
    // salen de la reserva vigente (crearla, realizarla) via PATCH /reservas/[id].
    estado: z.enum(["disponible", "no_disponible"]).optional(),
    leadId: z.number().nullable().optional(),
    nombreCoComprador: z.string().nullable().optional(),
    dniCoComprador: z.string().nullable().optional(),
    nacionalidadCoComprador: z.string().nullable().optional(),
    fechaNacimientoCoComprador: z.string().nullable().optional(),
    domicilioCoComprador: z.string().nullable().optional(),
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
    modalidadContrato: z
      .enum(["usd_fijo", "pesos_cac", "requiere_revision"])
      .nullable()
      .optional(),
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
    confirmarEdicionVendida: z.boolean().optional(),
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
      // Bloquea el lote: PATCH /reservas/[id] hace lo mismo, asi que crear o reactivar
      // reservas del mismo lote no corren en paralelo y no pueden quedar dos vigentes.
      await tx
        .select({ id: parcelas.id })
        .from(parcelas)
        .where(eq(parcelas.id, parcelaId))
        .for("update");

      const [currentRow] = await tx
        .select({ parcela: parcelas, reserva: reservas, lead: leads })
        .from(parcelas)
        .leftJoin(reservas, currentReservaJoin())
        .leftJoin(leads, eq(reservas.leadId, leads.id))
        .where(eq(parcelas.id, parcelaId));

      if (!currentRow) return { kind: "not-found" as const };

      const { parcela: current, reserva: activeReserva } = currentRow;
      const requestedFormaPago = data.formaPago ?? activeReserva?.formaPago;
      const requestedAnticipo = numericValue(data.anticipoNum);
      const currentAnticipo = numericValue(activeReserva?.anticipoNum);
      const changesAnticipo =
        "anticipoNum" in data && requestedAnticipo !== currentAnticipo;
      const shouldValidateAnticipo =
        requestedFormaPago !== "contado" &&
        "anticipoNum" in data &&
        (!activeReserva || changesAnticipo);

      if (shouldValidateAnticipo) {
        const precioLista = numericValue(current.precioBase ?? current.precioEtapa1);
        if (precioLista === null) {
          return { kind: "missing-list-price" as const };
        }

        const minimumAnticipo = getMinimumAnticipoUsd(precioLista);
        if (requestedAnticipo === null || requestedAnticipo < minimumAnticipo) {
          return {
            kind: "invalid-anticipo" as const,
            minimumAnticipo,
          };
        }
      }

      const isSoldOrRealizada =
        current.estado === "vendido" || activeReserva?.estado === "realizada";
      if (
        isSoldOrRealizada &&
        (authResult.role !== "admin" || data.confirmarEdicionVendida !== true)
      ) {
        return { kind: "sold-confirmation-required" as const };
      }
      if (authResult.role !== "admin" && activeReserva?.estado === "realizada") {
        return { kind: "admin-only-realizada" as const };
      }

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
      const createsReserva = !activeReserva && shouldTouchReserva;

      if (allowedData.estado !== undefined) {
        // Para liberar un lote reservado o vendido hay que cancelar su reserva.
        if (activeReserva) {
          return { kind: "estado-con-reserva" as const, reservaId: activeReserva.id };
        }
        if (shouldTouchReserva) return { kind: "estado-y-reserva" as const };
      }
      if (createsReserva && current.estado === "no_disponible") {
        return { kind: "lote-no-disponible" as const };
      }

      if (createsReserva && !requestedLeadId) {
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

      if (allowedData.estado !== undefined) {
        parcelaData.estado = allowedData.estado;
      } else if (shouldTouchReserva) {
        // Editar datos no cambia el estado de la reserva; el lote queda alineado con ella
        // (activa -> reservado, realizada -> vendido, nueva -> reservado).
        parcelaData.estado = activeReserva?.estado === "realizada" ? "vendido" : "reservado";
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
        .leftJoin(reservas, currentReservaJoin())
        .leftJoin(leads, eq(reservas.leadId, leads.id))
        .where(eq(parcelas.id, parcelaId));
      if (!updatedRow) return { kind: "not-found" as const };

      await logAudit(tx, {
        entidad: "lote",
        entidadId: parcelaId,
        usuario: authResult.email,
        antes: current,
        despues: updatedRow.parcela,
      });
      const reservaId = updatedRow.reserva?.id ?? activeReserva?.id;
      if (reservaId) {
        await logAudit(tx, {
          entidad: "reserva",
          entidadId: reservaId,
          usuario: authResult.email,
          antes: activeReserva,
          despues: updatedRow.reserva,
        });
      }

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
    if (result.kind === "sold-confirmation-required") {
      return NextResponse.json(
        { error: "OJO! Estás por cambiar datos de un lote o reserva ya vendido" },
        { status: 403 }
      );
    }
    if (result.kind === "admin-only-realizada") {
      return NextResponse.json(
        { error: "Solo un administrador puede editar una reserva realizada o su lote" },
        { status: 403 }
      );
    }
    if (result.kind === "estado-con-reserva") {
      return NextResponse.json(
        {
          error: `El lote tiene la reserva #${result.reservaId} vigente. Para liberarlo, cancelá esa reserva`,
        },
        { status: 409 }
      );
    }
    if (result.kind === "estado-y-reserva") {
      return NextResponse.json(
        { error: "No se puede cambiar el estado del lote y cargar una reserva a la vez" },
        { status: 400 }
      );
    }
    if (result.kind === "lote-no-disponible") {
      return NextResponse.json(
        { error: "El lote está marcado como no disponible. Pasalo a disponible antes de reservarlo" },
        { status: 409 }
      );
    }
    if (result.kind === "missing-lead") {
      return NextResponse.json(
        { error: "SeleccionÃ¡ un lead antes de reservar el lote" },
        { status: 400 }
      );
    }
    if (result.kind === "invalid-lead") {
      return NextResponse.json(
        { error: "El lead seleccionado no existe o no tenÃ©s permiso para usarlo" },
        { status: 403 }
      );
    }

    if (result.kind === "missing-list-price") {
      return NextResponse.json(
        { error: "El lote no tiene un precio de lista para validar el anticipo" },
        { status: 400 }
      );
    }
    if (result.kind === "invalid-anticipo") {
      return NextResponse.json(
        {
          error: `El anticipo no puede ser menor a USD ${result.minimumAnticipo}`,
        },
        { status: 400 }
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
    .leftJoin(reservas, currentReservaJoin())
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(eq(parcelas.id, parcelaId));

  if (!row) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  return NextResponse.json(flattenParcelaReserva(row.parcela, row.reserva, row.lead));
}
