import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";

const createLeadSchema = z.object({
  nombre: z.string().min(2).max(100),
  telefono: z.string().min(6).max(30),
  email: z.string().email(),
  mensaje: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createLeadSchema.parse(body);

    const inserted = await db
      .insert(leads)
      .values({
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        mensaje: data.mensaje ?? null,
        estado: "nuevo",
      })
      .returning({ id: leads.id });

    return NextResponse.json({ id: inserted[0]?.id }, { status: 201 });
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
