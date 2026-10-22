import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { CUENTA_CANCELADA_ERROR, periodoLabel, recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { crmTransaction } from "@/lib/crm-transaction";
import { contratos, cuotas, pagos, reservas } from "@/lib/schema";
import { deleteFile, upload } from "@/lib/storage";
import { getTipoCambioOnOrBefore } from "@/lib/tipos-cambio";
import { validationMessage } from "@/lib/validation-message";

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const cuotaId = Number(id);
  if (!Number.isFinite(cuotaId)) {
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
    await tx.execute(sql`SELECT id FROM cuotas WHERE id = ${cuotaId} FOR UPDATE`);

    const [row] = await tx
      .select({ cuota: cuotas, contrato: contratos, reserva: reservas })
      .from(cuotas)
      .innerJoin(contratos, eq(cuotas.contratoId, contratos.id))
      .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
      .where(eq(cuotas.id, cuotaId));
    if (!row) return { error: "Cuota no encontrada", status: 404 as const };
    if (row.contrato.estado === "cancelada") {
      return { error: CUENTA_CANCELADA_ERROR, status: 409 as const };
    }
    if (row.cuota.estado === "cancelada") {
      return { error: `La cuota ${row.cuota.numero} está cancelada: no admite pagos`, status: 409 as const };
    }
    if (row.cuota.estado === "pendiente_indice") {
      const periodo = row.cuota.periodoCac ? ` de ${periodoLabel(row.cuota.periodoCac)}` : "";
      return {
        error: `Falta el índice CAC${periodo} para calcular la cuota ${row.cuota.numero}. Cargalo en Cuotas › Índices y ajustes antes de registrar el pago`,
        status: 409 as const,
      };
    }
    if (parsed.data.moneda !== row.cuota.moneda) {
      return {
        error: `La cuota ${row.cuota.numero} es en ${row.cuota.moneda === "usd" ? "USD" : "pesos"}: registrá el pago en esa moneda`,
        status: 409 as const,
      };
    }

    const activePayments = await tx
      .select({ monto: pagos.monto })
      .from(pagos)
      .where(and(eq(pagos.cuotaId, cuotaId), eq(pagos.estado, "activo")));
    const paid = activePayments.reduce((total, payment) => total + Number(payment.monto), 0);
    const amount = Number(row.cuota.importeAjustado ?? row.cuota.importeBase);
    const remaining = Math.max(amount - paid, 0);
    if (parsed.data.monto > remaining + 0.005) {
      return {
        error:
          remaining <= 0
            ? "La cuota ya está pagada"
            : `El pago supera el saldo de la cuota (${remaining.toFixed(2)})`,
        status: 409 as const,
      };
    }

    const tipoCambioManual = parsed.data.moneda === "ars" ? parsed.data.tipoCambio : null;
    const tipoCambio = parsed.data.moneda === "ars" && !tipoCambioManual
      ? await getTipoCambioOnOrBefore(parsed.data.fechaPago, tx) : null;
    const tipoCambioValor = tipoCambioManual ?? (tipoCambio ? Number(tipoCambio.valor) : null);
    const uploaded = comprobante
      ? await upload(
          Buffer.from(await comprobante.arrayBuffer()),
          `${Date.now()}-${comprobante.name}`,
          `comprobantes/pagos/contrato-${row.contrato.id}`,
          { maxSize: MAX_COMPROBANTE_SIZE }
        )
      : null;
    uploadedUrl = uploaded?.url ?? null;

    const [pago] = await tx
      .insert(pagos)
      .values({
        contratoId: row.contrato.id,
        cuotaId: row.cuota.id,
        fechaPago: parsed.data.fechaPago,
        monto: String(parsed.data.monto),
        moneda: parsed.data.moneda,
        tipoCambioAplicado: tipoCambioValor && tipoCambioValor > 0 ? String(tipoCambioValor) : null,
        tipoCambioManual: tipoCambioManual !== null,
        montoUsd:
          parsed.data.moneda === "usd"
            ? String(parsed.data.monto)
            : tipoCambioValor && tipoCambioValor > 0
              ? String(parsed.data.monto / tipoCambioValor)
              : null,
        medio: parsed.data.medio ?? null,
        observacion: parsed.data.observacion ?? null,
        comprobanteUrl: uploaded?.url ?? null,
        comprobantePathname: uploaded?.pathname ?? null,
        comprobanteNombre: comprobante?.name ?? null,
        creadoPor: authResult.email,
      })
      .returning();
    await logAudit(tx, {
      entidad: "pago",
      entidadId: pago!.id,
      usuario: authResult.email,
      antes: null,
      despues: pago,
    });
    await recomputeContratoCuotas(row.contrato.id, tx);
    return { pago, contratoId: row.contrato.id };
  }).catch(async (error) => {
    if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
    throw error;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  return NextResponse.json(result.pago, { status: 201 });
}
