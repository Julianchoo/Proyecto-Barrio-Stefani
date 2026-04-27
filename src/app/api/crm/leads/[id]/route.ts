import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { z } from "zod";

const updateSchema = z.object({
  estado: z.enum(["nuevo", "asignado", "a_contactar", "contactado", "sin_respuesta", "closed_won", "closed_lost"]).optional(),
  notas: z.string().nullable().optional(),
  asignadoA: z.string().nullable().optional(),
  nombre: z.string().min(1).optional(),
  telefono: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dniCuit: z.string().nullable().optional(),
  domicilio: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Only admins can assign leads
    if ("asignadoA" in data && authResult.role !== "admin") {
      return NextResponse.json({ error: "Sin permisos para asignar leads" }, { status: 403 });
    }

    // Comercials can only edit their own leads
    if (authResult.role !== "admin") {
      const [current] = await db.select().from(leads).where(eq(leads.id, leadId));
      if (!current) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      if (current.asignadoA !== authResult.id) {
        return NextResponse.json({ error: "Solo podés editar tus propios leads" }, { status: 403 });
      }
    }

    const [updated] = await db
      .update(leads)
      .set(data)
      .where(eq(leads.id, leadId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
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
