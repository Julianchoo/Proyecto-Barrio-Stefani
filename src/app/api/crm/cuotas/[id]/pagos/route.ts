import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { contratos, cuotas, pagos, reservas } from "@/lib/schema";

const pagoSchema = z.object({
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: z.number().positive(),
  moneda: z.enum(["usd", "ars"]),
  medio: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const cuotaId = Number(id);
  if (!Number.isFinite(cuotaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pagoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const [row] = await db
    .select({ cuota: cuotas, contrato: contratos, reserva: reservas })
    .from(cuotas)
    .innerJoin(contratos, eq(cuotas.contratoId, contratos.id))
    .innerJoin(reservas, eq(contratos.reservaId, reservas.id))
    .where(eq(cuotas.id, cuotaId));

  if (!row) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
  if (row.cuota.estado === "cancelada") {
    return NextResponse.json(
      { error: "No se puede registrar pago en una cuota cancelada" },
      { status: 409 }
    );
  }
  if (row.cuota.estado === "pendiente_indice") {
    return NextResponse.json(
      { error: "No se puede registrar pago: falta cargar el CAC aplicable a una cuota vencida" },
      { status: 409 }
    );
  }
  const [pago] = await db
    .insert(pagos)
    .values({
      contratoId: row.contrato.id,
      cuotaId: row.cuota.id,
      fechaPago: parsed.data.fechaPago,
      monto: String(parsed.data.monto),
      moneda: parsed.data.moneda,
      medio: parsed.data.medio ?? null,
      observacion: parsed.data.observacion ?? null,
      creadoPor: authResult.email,
    })
    .returning();

  await recomputeContratoCuotas(row.contrato.id);
  return NextResponse.json(pago, { status: 201 });
}
