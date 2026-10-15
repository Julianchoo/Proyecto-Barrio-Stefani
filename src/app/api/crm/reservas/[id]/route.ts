import { NextResponse } from "next/server";
import { and, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import {
  camposContratoMessage,
  contratoVigente,
  createContratoForReserva,
  cuentaCorrienteUrl,
} from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { contratos, leads, parcelas, reservas, user } from "@/lib/schema";
import { crmTransaction } from "@/lib/crm-transaction";
import { compradorSnapshot } from "@/lib/reservas";

const updateSchema = z
  .object({
    estado: z.enum(["activa", "cancelada", "vencida", "realizada"]).optional(),
    reservadoPor: z.string().email().optional(),
    confirmarEdicionVendida: z.boolean().optional(),
    confirmarCambioEstado: z.boolean().optional(),
  })
  .refine((data) => data.estado || data.reservadoPor, {
    message: "Debe indicar un cambio",
  })
  .strict();

type EstadoReservaValue = NonNullable<z.infer<typeof updateSchema>["estado"]>;

// Activa o realizada: la reserva que ocupa el lote. Solo puede haber una por lote.
function isVigente(estado: EstadoReservaValue) {
  return estado === "activa" || estado === "realizada";
}

// El estado del lote lo define su reserva vigente: activa -> reservado,
// realizada -> vendido, sin reserva vigente -> disponible.
function loteEstadoForReserva(estado: EstadoReservaValue) {
  if (estado === "activa") return "reservado";
  if (estado === "realizada") return "vendido";
  return "disponible";
}

function cuentaCorrienteMessage(result: Awaited<ReturnType<typeof createContratoForReserva>>) {
  if (result.kind === "ok") return "Cuenta corriente creada";
  if (result.kind === "exists") return "La reserva ya tenia cuenta corriente";
  if (result.kind === "missing-data" || result.kind === "invalid-data") {
    return `${camposContratoMessage(result)}. Completalos en la reserva y generá la cuenta desde su cuenta corriente`;
  }
  if (result.kind === "missing-exchange-rate") {
    return "La cuenta Pesos + CAC necesita el tipo de cambio BNA: generala desde su cuenta corriente";
  }
  return "No se genero cuenta corriente";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const reservaId = parseInt(id);
  if (isNaN(reservaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const [row] = await db
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
      modalidadContrato: reservas.modalidadContrato,
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
    .where(eq(reservas.id, reservaId));

  if (!row) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }
  if (authResult.role !== "admin" && row.reservadoPor !== authResult.email) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  return NextResponse.json(row);
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

    const result = await crmTransaction(async (tx) => {
      const [current] = await tx
        .select({ reserva: reservas, parcela: parcelas })
        .from(reservas)
        .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
        .where(eq(reservas.id, reservaId));

      if (!current) return { kind: "not-found" as const };

      const { reserva, parcela } = current;
      await tx
        .select({ id: parcelas.id })
        .from(parcelas)
        .where(eq(parcelas.id, reserva.parcelaId))
        .for("update");
      const cambiaEstado = Boolean(data.estado && data.estado !== reserva.estado);
      const nextEstado = data.estado ?? reserva.estado;

      // Cambiar el estado o el comercial de una reserva es solo de administradores, salvo
      // que el comercial cancele su propia reserva activa.
      // El comercial edita los datos de su reserva activa desde el lote (PUT parcelas).
      const comercialCancelaPropia =
        data.estado === "cancelada" &&
        !data.reservadoPor &&
        reserva.estado === "activa" &&
        reserva.reservadoPor === authResult.email;
      if (authResult.role !== "admin" && !comercialCancelaPropia) {
        return { kind: "forbidden" as const };
      }

      // Una venta con cuenta corriente vigente no se deshace por atrás: primero se cancela la cuenta.
      if (cambiaEstado && reserva.estado === "realizada") {
        const [contrato] = await tx
          .select({ id: contratos.id })
          .from(contratos)
          .where(and(eq(contratos.reservaId, reserva.id), contratoVigente));
        if (contrato) return { kind: "cuenta-vigente" as const };
      }

      // Todo cambio de estado que toque una reserva vigente (desde o hacia activa/realizada)
      // mueve el estado del lote, asi que exige confirmacion explicita.
      if (
        cambiaEstado &&
        (isVigente(reserva.estado) || isVigente(nextEstado)) &&
        data.confirmarCambioEstado !== true
      ) {
        return { kind: "estado-confirmation-required" as const };
      }

      const isSoldOrRealizada = parcela.estado === "vendido" || reserva.estado === "realizada";
      if (data.reservadoPor && isSoldOrRealizada && data.confirmarEdicionVendida !== true) {
        return { kind: "sold-confirmation-required" as const };
      }

      if (data.reservadoPor) {
        const [targetUser] = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.email, data.reservadoPor), eq(user.role, "comercial")))
          .limit(1);

        if (!targetUser) return { kind: "invalid-comercial" as const };
      }

      if (data.estado === "realizada" && !reserva.formaPago) {
        return { kind: "missing-forma-pago" as const };
      }
      if (
        data.estado === "realizada" &&
        reserva.formaPago !== "contado" &&
        reserva.modalidadContrato !== "usd_fijo" &&
        reserva.modalidadContrato !== "pesos_cac"
      ) {
        return { kind: "missing-modalidad-contrato" as const };
      }

      if (cambiaEstado && isVigente(nextEstado)) {
        // Un lote no se puede vender ni reservar dos veces: ninguna otra reserva del
        // lote puede estar activa o realizada. Se bloquea la fila del lote para que dos
        // pedidos simultaneos no pasen ambos este control.
        await tx
          .select({ id: parcelas.id })
          .from(parcelas)
          .where(eq(parcelas.id, reserva.parcelaId))
          .for("update");

        const [otherVigente] = await tx
          .select({ id: reservas.id, estado: reservas.estado })
          .from(reservas)
          .where(
            and(
              eq(reservas.parcelaId, reserva.parcelaId),
              or(eq(reservas.estado, "activa"), eq(reservas.estado, "realizada")),
              ne(reservas.id, reserva.id)
            )
          )
          .limit(1);

        if (otherVigente) return { kind: "active-conflict" as const, other: otherVigente };

        if (!isVigente(reserva.estado) && parcela.estado === "no_disponible") {
          return { kind: "lote-no-disponible" as const };
        }
      }

      const [lead] =
        reserva.leadId && nextEstado === "realizada"
          ? await tx.select().from(leads).where(eq(leads.id, reserva.leadId))
          : [];
      await tx
        .update(reservas)
        .set({
          ...(cambiaEstado && nextEstado === "realizada" && lead ? compradorSnapshot(lead) : {}),
          ...(data.estado ? { estado: data.estado } : {}),
          ...(data.reservadoPor ? { reservadoPor: data.reservadoPor } : {}),
          modificadoPor: authResult.email,
          updatedAt: new Date(),
        })
        .where(eq(reservas.id, reserva.id));

      // Si la reserva era o pasa a ser la vigente, el lote sigue su estado. Pasar entre
      // cancelada y vencida no toca el lote (puede tener otra reserva vigente).
      if (cambiaEstado && (isVigente(reserva.estado) || isVigente(nextEstado))) {
        await tx
          .update(parcelas)
          .set({ estado: loteEstadoForReserva(nextEstado) })
          .where(eq(parcelas.id, reserva.parcelaId));
      }

      const [after] = await tx
        .select({ reserva: reservas, parcela: parcelas })
        .from(reservas)
        .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
        .where(eq(reservas.id, reserva.id));
      await logAudit(tx, {
        entidad: "reserva",
        entidadId: reserva.id,
        usuario: authResult.email,
        antes: reserva,
        despues: after?.reserva,
      });
      await logAudit(tx, {
        entidad: "lote",
        entidadId: parcela.id,
        usuario: authResult.email,
        antes: parcela,
        despues: after?.parcela,
      });

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
          modalidadContrato: reservas.modalidadContrato,
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

      const cuentaResult =
        data.estado === "realizada" &&
        updated &&
        updated.formaPago !== "contado" &&
        (updated.modalidadContrato === "usd_fijo" || updated.modalidadContrato === "pesos_cac")
          ? await createContratoForReserva(
              reservaId,
              { modalidad: updated.modalidadContrato },
              authResult.email,
              tx
            )
          : null;
      return { kind: "ok" as const, data: updated, cuentaResult };
    });

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json(
        { error: "Solo un administrador puede cambiar el estado o el comercial de una reserva" },
        { status: 403 }
      );
    }
    if (result.kind === "cuenta-vigente") {
      return NextResponse.json(
        {
          error:
            "Esta reserva tiene cuenta corriente. Para cambiarle el estado, primero cancelá la cuenta corriente (queda guardada como historial).",
          cuentaCorrienteUrl: cuentaCorrienteUrl(reservaId),
        },
        { status: 409 }
      );
    }
    if (result.kind === "estado-confirmation-required") {
      return NextResponse.json(
        { error: "OJO! Este cambio mueve el estado del lote. Confirmalo para continuar" },
        { status: 403 }
      );
    }
    if (result.kind === "sold-confirmation-required") {
      return NextResponse.json(
        { error: "OJO! Estás por cambiar datos de un lote o reserva ya vendido" },
        { status: 403 }
      );
    }
    if (result.kind === "active-conflict") {
      return NextResponse.json(
        {
          error: `Este lote ya tiene la reserva #${result.other.id} ${result.other.estado}. Un lote no puede tener dos reservas activas o realizadas`,
        },
        { status: 409 }
      );
    }
    if (result.kind === "lote-no-disponible") {
      return NextResponse.json(
        { error: "El lote está marcado como no disponible. Pasalo a disponible antes de reactivar la reserva" },
        { status: 409 }
      );
    }
    if (result.kind === "missing-forma-pago") {
      return NextResponse.json(
        { error: "Elegí el tipo de pago antes de marcar la reserva como realizada" },
        { status: 400 }
      );
    }
    if (result.kind === "missing-modalidad-contrato") {
      return NextResponse.json(
        { error: "Elegí USD fijo o Pesos + CAC antes de marcar la reserva como realizada" },
        { status: 400 }
      );
    }
    if (result.kind === "invalid-comercial") {
      return NextResponse.json(
        { error: "El comercial seleccionado no existe" },
        { status: 400 }
      );
    }

    const updatedReserva = result.data;
    if (!updatedReserva) {
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    if (
      data.estado === "realizada" &&
      updatedReserva.formaPago !== "contado" &&
      (updatedReserva.modalidadContrato === "usd_fijo" ||
        updatedReserva.modalidadContrato === "pesos_cac")
    ) {
      const cuentaResult = result.cuentaResult!;
      return NextResponse.json({
        ...updatedReserva,
        cuentaCorriente: {
          status: cuentaResult.kind,
          message: cuentaCorrienteMessage(cuentaResult),
          contratoId:
            "contratoId" in cuentaResult ? cuentaResult.contratoId : null,
        },
      });
    }

    return NextResponse.json(updatedReserva);
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

export async function DELETE() {
  return NextResponse.json(
    { error: "Las reservas no se eliminan; se cancelan." },
    { status: 405 }
  );
}
