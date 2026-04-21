import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parcelas } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { z } from "zod";

const COMERCIAL_FIELDS = [
  "estado",
  "nombreComprador",
  "dniCuit",
  "telefono",
  "emailComprador",
  "domicilioComprador",
  "nombreCorredor",
  "emailCorredor",
  "formaPago",
  "fechaReserva",
  "fechaVencimiento",
  "observaciones",
] as const;

const updateSchema = z
  .object({
    estado: z.enum(["disponible", "no_disponible", "reservado", "vendido"]).optional(),
    nombreComprador: z.string().nullable().optional(),
    dniCuit: z.string().nullable().optional(),
    telefono: z.string().nullable().optional(),
    emailComprador: z.string().email().nullable().optional(),
    domicilioComprador: z.string().nullable().optional(),
    nombreCorredor: z.string().nullable().optional(),
    emailCorredor: z.string().email().nullable().optional(),
    formaPago: z.string().nullable().optional(),
    fechaReserva: z.string().nullable().optional(),
    fechaVencimiento: z.string().nullable().optional(),
    observaciones: z.string().nullable().optional(),
    // Admin-only fields
    precioEtapa1: z.string().nullable().optional(),
    valorM2: z.string().nullable().optional(),
    superficieM2: z.string().nullable().optional(),
    nota: z.string().nullable().optional(),
  })
  .strict();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Filter allowed fields based on role
    let updateData: Record<string, unknown> = {};
    if (authResult.role === "admin") {
      updateData = { ...data };
    } else {
      for (const field of COMERCIAL_FIELDS) {
        if (field in data) {
          updateData[field] = data[field as keyof typeof data];
        }
      }
    }

    updateData.modificadoPor = authResult.email;

    const [updated] = await db
      .update(parcelas)
      .set(updateData)
      .where(eq(parcelas.id, parcelaId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const [parcela] = await db
    .select()
    .from(parcelas)
    .where(eq(parcelas.id, parcelaId));

  if (!parcela) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  return NextResponse.json(parcela);
}
