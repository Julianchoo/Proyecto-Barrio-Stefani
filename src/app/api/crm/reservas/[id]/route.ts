import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { parcelas, reservas, user } from "@/lib/schema";

const updateSchema = z
  .object({
    estado: z.enum(["activa", "cancelada", "vencida", "realizada"]).optional(),
    reservadoPor: z.string().email().optional(),
  })
  .refine((data) => data.estado || data.reservadoPor, {
    message: "Debe indicar un cambio",
  })
  .strict();

function loteEstadoForReserva(estado: z.infer<typeof updateSchema>["estado"]) {
  if (estado === "activa") return "reservado";
  if (estado === "realizada") return "vendido";
  return "disponible";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const reservaId = parseInt(id);
  if (isNaN(reservaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ reserva: reservas, parcela: parcelas })
        .from(reservas)
        .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
        .where(eq(reservas.id, reservaId));

      if (!current) return { kind: "not-found" as const };

      const { reserva } = current;

      if (
        authResult.role !== "admin" &&
        reserva.reservadoPor !== authResult.email
      ) {
        return { kind: "forbidden" as const };
      }

      if (data.reservadoPor && authResult.role !== "admin") {
        return { kind: "forbidden" as const };
      }

      if (data.reservadoPor) {
        const [targetUser] = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.email, data.reservadoPor), eq(user.role, "comercial")))
          .limit(1);

        if (!targetUser) return { kind: "invalid-comercial" as const };
      }

      const nextEstado = data.estado ?? reserva.estado;

      if (nextEstado === "activa") {
        const [otherActive] = await tx
          .select({ id: reservas.id })
          .from(reservas)
          .where(
            and(
              eq(reservas.parcelaId, reserva.parcelaId),
              eq(reservas.estado, "activa"),
              ne(reservas.id, reserva.id)
            )
          )
          .limit(1);

        if (otherActive) return { kind: "active-conflict" as const };
      }

      await tx
        .update(reservas)
        .set({
          ...(data.estado ? { estado: data.estado } : {}),
          ...(data.reservadoPor ? { reservadoPor: data.reservadoPor } : {}),
          modificadoPor: authResult.email,
          updatedAt: new Date(),
        })
        .where(eq(reservas.id, reserva.id));

      const shouldSyncLote =
        nextEstado === "activa" ||
        nextEstado === "realizada" ||
        (Boolean(data.estado) && reserva.estado === "activa");

      if (shouldSyncLote) {
        await tx
          .update(parcelas)
          .set({ estado: loteEstadoForReserva(nextEstado) })
          .where(eq(parcelas.id, reserva.parcelaId));
      }

      const [updated] = await tx
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
        .where(eq(reservas.id, reserva.id));

      return { kind: "ok" as const, data: updated };
    });

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(
        { error: "Solo el comercial que tomó la reserva o un administrador puede modificarla" },
        { status: 403 }
      );
    }
    if (result.kind === "active-conflict") {
      return NextResponse.json(
        { error: "Este lote ya tiene una reserva activa" },
        { status: 409 }
      );
    }
    if (result.kind === "invalid-comercial") {
      return NextResponse.json(
        { error: "El comercial seleccionado no existe" },
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
