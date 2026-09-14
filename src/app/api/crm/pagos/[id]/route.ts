import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { cuotas, pagos } from "@/lib/schema";
import { deleteFile, upload } from "@/lib/storage";
import { getTipoCambioOnOrBefore } from "@/lib/tipos-cambio";

const pagoSchema = z.object({
  fechaPago: z.iso.date(),
  monto: z.number().positive(),
  moneda: z.enum(["usd", "ars"]),
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
    medio: formData.get("medio") || null,
    observacion: formData.get("observacion") || null,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
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
  const result = await db
    .transaction(async (tx) => {
      const [initial] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
      if (!initial?.cuotaId)
        return { error: "Pago sin cuota o no encontrado", status: 404 as const };
      const cuotaId = initial.cuotaId;
      await tx.execute(sql`SELECT id FROM cuotas WHERE id = ${cuotaId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM pagos WHERE id = ${pagoId} FOR UPDATE`);
      const [current] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
      const [cuota] = await tx.select().from(cuotas).where(eq(cuotas.id, cuotaId));
      if (!current || !cuota) return { error: "Pago no encontrado", status: 404 as const };
      if (current.estado !== "activo") {
        return { error: "No se puede editar un pago anulado", status: 409 as const };
      }
      if (parsed.data.moneda !== current.moneda) {
        return { error: "No se puede cambiar la moneda del pago", status: 409 as const };
      }
      const amountChanged = parsed.data.monto !== Number(current.monto);
      if (amountChanged && ["cancelada", "pendiente_indice"].includes(cuota.estado)) {
        return {
          error: "No se puede cambiar el monto de una cuota cancelada o sin CAC",
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
      const tipoCambio =
        dateChanged && current.moneda === "ars"
          ? await getTipoCambioOnOrBefore(parsed.data.fechaPago)
          : null;
      const tipoCambioValor = dateChanged
        ? tipoCambio
          ? Number(tipoCambio.valor)
          : null
        : current.tipoCambioAplicado
          ? Number(current.tipoCambioAplicado)
          : null;
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
          ...(dateChanged || amountChanged
            ? {
                tipoCambioAplicado:
                  tipoCambioValor && tipoCambioValor > 0 ? String(tipoCambioValor) : null,
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
      return { pago, contratoId: current.contratoId, amountChanged };
    })
    .catch(async (error) => {
      if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
      throw error;
    });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  if (result.amountChanged) await recomputeContratoCuotas(result.contratoId);
  return NextResponse.json(result.pago);
}
