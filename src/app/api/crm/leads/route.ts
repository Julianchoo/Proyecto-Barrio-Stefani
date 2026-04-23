import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, user } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import type { EstadoLead } from "@/lib/schema";
import { z } from "zod";

const createLeadSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  email: z.string().email(),
  mensaje: z.string().optional().nullable(),
  dniCuit: z.string().optional().nullable(),
  domicilio: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as EstadoLead | null;

  const rows = estado
    ? await db
        .select({
          id: leads.id,
          nombre: leads.nombre,
          telefono: leads.telefono,
          email: leads.email,
          mensaje: leads.mensaje,
          estado: leads.estado,
          notas: leads.notas,
          asignadoA: leads.asignadoA,
          dniCuit: leads.dniCuit,
          domicilio: leads.domicilio,
          asignadoNombre: user.name,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .leftJoin(user, eq(leads.asignadoA, user.id))
        .where(eq(leads.estado, estado))
        .orderBy(leads.createdAt)
    : await db
        .select({
          id: leads.id,
          nombre: leads.nombre,
          telefono: leads.telefono,
          email: leads.email,
          mensaje: leads.mensaje,
          estado: leads.estado,
          notas: leads.notas,
          asignadoA: leads.asignadoA,
          dniCuit: leads.dniCuit,
          domicilio: leads.domicilio,
          asignadoNombre: user.name,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .leftJoin(user, eq(leads.asignadoA, user.id))
        .orderBy(leads.createdAt);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { nombre, telefono, email, mensaje, dniCuit, domicilio, notas } = parsed.data;

  const [created] = await db
    .insert(leads)
    .values({ nombre, telefono, email, mensaje: mensaje ?? null, dniCuit: dniCuit ?? null, domicilio: domicilio ?? null, notas: notas ?? null })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
