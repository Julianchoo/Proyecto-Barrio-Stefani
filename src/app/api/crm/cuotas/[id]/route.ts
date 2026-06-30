import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { recomputeContratoCuotas } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { contratos, cuotas } from "@/lib/schema";

const updateSchema = z
  .object({
    fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const [row] = await db
    .select({ cuota: cuotas, contrato: contratos })
    .from(cuotas)
    .innerJoin(contratos, eq(cuotas.contratoId, contratos.id))
    .where(eq(cuotas.id, cuotaId));
  if (!row) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });

  await db
    .update(cuotas)
    .set({
      ...(parsed.data.fechaVencimiento
        ? { fechaVencimiento: parsed.data.fechaVencimiento }
        : {}),
      ...(parsed.data.importeBase
        ? { importeBase: String(parsed.data.importeBase) }
        : {}),
      ...(parsed.data.estado ? { estado: parsed.data.estado } : {}),
      ...(parsed.data.observaciones !== undefined
        ? { observaciones: parsed.data.observaciones }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(cuotas.id, cuotaId));

  await recomputeContratoCuotas(row.contrato.id);
  return NextResponse.json({ ok: true });
}
