import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { contratos, cuotas, pagos, reservas } from "@/lib/schema";
import { deleteFile, upload } from "@/lib/storage";
import { getTipoCambioOnOrBefore } from "@/lib/tipos-cambio";

const pagoSchema = z.object({
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: z.number().positive(),
  moneda: z.enum(["usd", "ars"]),
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

  const tipoCambio =
    parsed.data.moneda === "ars" ? await getTipoCambioOnOrBefore(parsed.data.fechaPago) : null;
  const tipoCambioValor = tipoCambio ? Number(tipoCambio.valor) : null;
  let uploadedUrl: string | null = null;
  const result = await db
    .transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM cuotas WHERE id = ${cuotaId} FOR UPDATE`);

      const [row] = await tx
        .select({ cuota: cuotas, contrato: contratos, reserva: reservas })
        .from(cuotas)
        .innerJoin(contratos, eq(cuotas.contratoId, contratos.id))
        .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
        .where(eq(cuotas.id, cuotaId));
      if (!row) return { error: "Cuota no encontrada", status: 404 as const };
      if (row.cuota.estado === "cancelada") {
        return { error: "No se puede registrar pago en una cuota cancelada", status: 409 as const };
      }
      if (row.cuota.estado === "pendiente_indice") {
        return {
          error: "No se puede registrar pago: falta cargar el CAC aplicable a una cuota vencida",
          status: 409 as const,
        };
      }
      if (parsed.data.moneda !== row.cuota.moneda) {
        return { error: "La moneda del pago no coincide con la cuota", status: 409 as const };
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
          tipoCambioAplicado:
            tipoCambioValor && tipoCambioValor > 0 ? String(tipoCambioValor) : null,
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
      return { pago, contratoId: row.contrato.id };
    })
    .catch(async (error) => {
      if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => undefined);
      throw error;
    });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  await recomputeContratoCuotas(result.contratoId);
  return NextResponse.json(result.pago, { status: 201 });
}
