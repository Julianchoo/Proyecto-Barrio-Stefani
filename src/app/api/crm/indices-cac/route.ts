import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  requireApiAuth,
  requireApiAdmin,
  isErrorResponse,
} from "@/lib/api-auth";
import { recomputeAllPesosCacCuotas } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { indicesCac } from "@/lib/schema";

const indiceSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  valor: z.number().positive(),
  fuente: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

const deleteIndiceSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET() {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const rows = await db.select().from(indicesCac).orderBy(indicesCac.periodo);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = indiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: indicesCac.id })
    .from(indicesCac)
    .where(eq(indicesCac.periodo, parsed.data.periodo))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(indicesCac)
      .set({
        valor: String(parsed.data.valor),
        fuente: parsed.data.fuente ?? null,
        nota: parsed.data.nota ?? null,
        creadoPor: authResult.email,
        updatedAt: new Date(),
      })
      .where(eq(indicesCac.periodo, parsed.data.periodo));
  } else {
    await db.insert(indicesCac).values({
      periodo: parsed.data.periodo,
      valor: String(parsed.data.valor),
      fuente: parsed.data.fuente ?? null,
      nota: parsed.data.nota ?? null,
      creadoPor: authResult.email,
    });
  }

  await recomputeAllPesosCacCuotas();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = deleteIndiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  await db
    .delete(indicesCac)
    .where(eq(indicesCac.periodo, parsed.data.periodo));

  await recomputeAllPesosCacCuotas();
  return NextResponse.json({ ok: true });
}
