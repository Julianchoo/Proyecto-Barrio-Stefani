import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { CUENTA_CANCELADA_ERROR, recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { crmTransaction } from "@/lib/crm-transaction";
import { contratos, cuotas, pagos } from "@/lib/schema";
import { validationMessage } from "@/lib/validation-message";

const updateSchema = z
  .object({
    fechaVencimiento: z.iso.date().optional(),
    importeBase: z.number().positive().optional(),
    estado: z
      .enum([
        "pendiente",
        "pendiente_indice",
        "parcial",
        "pagada",
        "vencida",
        "calculada",
        "proyectada",
        "parcial_vencida",
        "cancelada",
      ])
      .optional(),
    observaciones: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe indicar un cambio",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;
  if (authResult.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const cuotaId = Number(id);
  if (!Number.isFinite(cuotaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error.issues), details: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await crmTransaction(async (tx) => {
    const [row] = await tx
      .select({ cuota: cuotas, contrato: contratos })
      .from(cuotas)
      .innerJoin(contratos, eq(cuotas.contratoId, contratos.id))
      .where(eq(cuotas.id, cuotaId));
    if (!row) return { error: "Cuota no encontrada", status: 404 };
    if (row.contrato.estado === "cancelada") {
      return { error: CUENTA_CANCELADA_ERROR, status: 409 as const };
    }
    if (
      parsed.data.importeBase !== undefined &&
      (row.cuota.estado === "cancelada" || parsed.data.estado === "cancelada")
    ) {
      return { error: `La cuota ${row.cuota.numero} está cancelada: no se le puede cambiar el importe`, status: 409 };
    }
    if (
      parsed.data.fechaVencimiento &&
      parsed.data.fechaVencimiento !== row.cuota.fechaVencimiento &&
      row.contrato.modalidad === "pesos_cac"
    ) {
      const [payment] = await tx
        .select({ id: pagos.id })
        .from(pagos)
        .where(and(eq(pagos.cuotaId, cuotaId), eq(pagos.estado, "activo")))
        .limit(1);
      if (payment)
        return {
          error: `La cuota ${row.cuota.numero} ya tiene pagos: no se le puede cambiar el vencimiento (cambiaría su período CAC). Borrá los pagos primero`,
          status: 409,
        };
    }

    await tx
      .update(cuotas)
      .set({
        ...(parsed.data.fechaVencimiento ? { fechaVencimiento: parsed.data.fechaVencimiento } : {}),
        ...(parsed.data.importeBase ? { importeBase: String(parsed.data.importeBase) } : {}),
        ...(parsed.data.estado ? { estado: parsed.data.estado } : {}),
        ...(parsed.data.observaciones !== undefined
          ? { observaciones: parsed.data.observaciones }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(cuotas.id, cuotaId));

    await recomputeContratoCuotas(row.contrato.id, tx);
    const [updated] = await tx.select().from(cuotas).where(eq(cuotas.id, cuotaId));
    await logAudit(tx, {
      entidad: "cuota",
      entidadId: cuotaId,
      usuario: authResult.email,
      antes: row.cuota,
      despues: updated,
    });
    if (parsed.data.importeBase !== undefined) {
      const paymentRows = await tx
        .select({ monto: pagos.monto })
        .from(pagos)
        .where(and(eq(pagos.cuotaId, cuotaId), eq(pagos.estado, "activo")));
      const paid = paymentRows.reduce((sum, payment) => sum + Number(payment.monto), 0);
      if (
        Math.round(Number(updated!.importeAjustado ?? updated!.importeBase) * 100) <
        Math.round(paid * 100)
      ) {
        throw new Error(
          "El importe recalculado no puede quedar por debajo de los pagos registrados"
        );
      }
    }
    return { ok: true };
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.message === "El importe recalculado no puede quedar por debajo de los pagos registrados"
    ) {
      return { error: error.message, status: 409 };
    }
    throw error;
  });
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  return NextResponse.json({ ok: true });
}
