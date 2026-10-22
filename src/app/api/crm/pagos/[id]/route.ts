import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { validationMessage } from "@/lib/validation-message";
import {
  CUENTA_CANCELADA_ERROR,
  isContratoCancelado,
  recomputeContratoCuotas,
} from "@/lib/cuenta-corriente";
import { crmTransaction } from "@/lib/crm-transaction";
import { cuotas, pagos } from "@/lib/schema";
import { deleteFile, upload } from "@/lib/storage";
import { getTipoCambioOnOrBefore } from "@/lib/tipos-cambio";

const pagoSchema = z.object({
  fechaPago: z.iso.date(),
  monto: z.number().positive(),
  moneda: z.enum(["usd", "ars"]),
  tipoCambio: z.number().positive().nullable(),
  medio: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
});

const COMPROBANTE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_COMPROBANTE_SIZE = 5 * 1024 * 1024;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const pagoId = Number(id);
  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const comprobanteValue = formData.get("comprobante");
  const comprobante =
    comprobanteValue instanceof File && comprobanteValue.size > 0 ? comprobanteValue : null;
  const parsed = pagoSchema.safeParse({
    fechaPago: formData.get("fechaPago"),
    monto: Number(formData.get("monto")),
    moneda: formData.get("moneda"),
    tipoCambio: formData.get("tipoCambio") ? Number(formData.get("tipoCambio")) : null,
    medio: formData.get("medio") || null,
    observacion: formData.get("observacion") || null,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error.issues), details: parsed.error.issues },
      { status: 400 }
    );
  }
  if (
    comprobante &&
    (!COMPROBANTE_TYPES.has(comprobante.type) || comprobante.size > MAX_COMPROBANTE_SIZE)
  ) {
    return NextResponse.json(
      { error: "El comprobante debe ser PDF, JPG, PNG o WEBP y pesar hasta 5 MB" },
      { status: 400 }
    );
  }

  let uploadedUrl: string | null = null;
  const result = await crmTransaction(async (tx) => {
    const [initial] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
    if (!initial?.cuotaId) return { error: "Pago sin cuota o no encontrado", status: 404 as const };
    const cuotaId = initial.cuotaId;
    await tx.execute(sql`SELECT id FROM cuotas WHERE id = ${cuotaId} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM pagos WHERE id = ${pagoId} FOR UPDATE`);
    const [current] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
    const [cuota] = await tx.select().from(cuotas).where(eq(cuotas.id, cuotaId));
    if (!current || !cuota) return { error: "Pago no encontrado", status: 404 as const };
    if (current.estado !== "activo") {
      return { error: "No se puede editar un pago anulado", status: 409 as const };
    }
    if (await isContratoCancelado(current.contratoId, tx)) {
      return { error: CUENTA_CANCELADA_ERROR, status: 409 as const };
    }
    if (parsed.data.moneda !== current.moneda) {
      return {
        error: "La moneda de un pago no se puede editar: borrá este pago y cargalo de nuevo en la otra moneda",
        status: 409 as const,
      };
    }
    const amountChanged = parsed.data.monto !== Number(current.monto);
    if (amountChanged && ["cancelada", "pendiente_indice"].includes(cuota.estado)) {
      return {
        error:
          cuota.estado === "cancelada"
            ? `La cuota ${cuota.numero} está cancelada: no se puede cambiar el monto del pago`
            : `Falta el índice CAC para calcular la cuota ${cuota.numero}. Cargalo en Cuotas › Índices y ajustes antes de cambiar el monto`,
        status: 409 as const,
      };
    }
    const activePayments = await tx
      .select({ monto: pagos.monto })
      .from(pagos)
      .where(and(eq(pagos.cuotaId, cuotaId), eq(pagos.estado, "activo"), ne(pagos.id, pagoId)));
    const paid = activePayments.reduce((total, payment) => total + Number(payment.monto), 0);
    const amount = Number(cuota.importeAjustado ?? cuota.importeBase);
    const remaining = Math.max(amount - paid, 0);
    if (amountChanged && parsed.data.monto > remaining + 0.005) {
      return {
        error:
          remaining <= 0
            ? "La cuota ya está pagada"
            : `El pago supera el saldo de la cuota (${remaining.toFixed(2)})`,
        status: 409 as const,
      };
    }

    const dateChanged = parsed.data.fechaPago !== current.fechaPago;
    // TC vacío en un pago con TC manual = volver al TC BNA de la fecha.
    const tipoCambioManual = current.moneda === "ars" ? parsed.data.tipoCambio : null;
    const rateChanged =
      tipoCambioManual !== null
        ? tipoCambioManual !== Number(current.tipoCambioAplicado) || !current.tipoCambioManual
        : current.tipoCambioManual || dateChanged;
    const tipoCambio =
      rateChanged && tipoCambioManual === null && current.moneda === "ars"
        ? await getTipoCambioOnOrBefore(parsed.data.fechaPago, tx)
        : null;
    const tipoCambioValor =
      tipoCambioManual ??
      (rateChanged
        ? tipoCambio
          ? Number(tipoCambio.valor)
          : null
        : current.tipoCambioAplicado
          ? Number(current.tipoCambioAplicado)
          : null);
    const uploaded = comprobante
      ? await upload(
          Buffer.from(await comprobante.arrayBuffer()),
          `${Date.now()}-${comprobante.name}`,
          `comprobantes/pagos/contrato-${current.contratoId}`,
          { maxSize: MAX_COMPROBANTE_SIZE }
        )
      : null;
    uploadedUrl = uploaded?.url ?? null;

    const [pago] = await tx
      .update(pagos)
      .set({
        fechaPago: parsed.data.fechaPago,
        monto: String(parsed.data.monto),
        moneda: parsed.data.moneda,
        ...(rateChanged || amountChanged
          ? {
              tipoCambioAplicado:
                tipoCambioValor && tipoCambioValor > 0 ? String(tipoCambioValor) : null,
              tipoCambioManual: tipoCambioManual !== null,
              montoUsd:
                current.moneda === "usd"
                  ? String(parsed.data.monto)
                  : tipoCambioValor && tipoCambioValor > 0
                    ? String(parsed.data.monto / tipoCambioValor)
                    : null,
            }
          : {}),
        medio: parsed.data.medio ?? null,
        observacion: parsed.data.observacion ?? null,
        ...(uploaded
          ? {
              comprobanteUrl: uploaded.url,
              comprobantePathname: uploaded.pathname,
              comprobanteNombre: comprobante!.name,
            }
          : formData.get("quitarComprobante") === "true"
            ? {
                comprobanteUrl: null,
                comprobantePathname: null,
                comprobanteNombre: null,
              }
            : {}),
        updatedAt: new Date(),
      })
      .where(eq(pagos.id, pagoId))
      .returning();
    await logAudit(tx, {
      entidad: "pago",
      entidadId: pagoId,
      usuario: authResult.email,
      antes: current,
      despues: pago,
    });
    if (amountChanged) await recomputeContratoCuotas(current.contratoId, tx);
    return { pago, contratoId: current.contratoId, amountChanged };
  }).catch(async (error) => {
    if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
    throw error;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  return NextResponse.json(result.pago);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const pagoId = Number(id);
  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const deleted = await crmTransaction(async (tx) => {
    const [existing] = await tx
      .select({ contratoId: pagos.contratoId })
      .from(pagos)
      .where(eq(pagos.id, pagoId));
    if (existing && (await isContratoCancelado(existing.contratoId, tx))) return "cancelada";
    const [pago] = await tx.delete(pagos).where(eq(pagos.id, pagoId)).returning();
    if (pago) {
      await logAudit(tx, {
        entidad: "pago",
        entidadId: pagoId,
        usuario: authResult.email,
        antes: pago,
        despues: null,
      });
      await recomputeContratoCuotas(pago.contratoId, tx);
    }
    return pago;
  });
  if (!deleted) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  if (deleted === "cancelada") {
    return NextResponse.json({ error: CUENTA_CANCELADA_ERROR }, { status: 409 });
  }
  if (deleted.comprobanteUrl) await deleteFile(deleted.comprobanteUrl).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
