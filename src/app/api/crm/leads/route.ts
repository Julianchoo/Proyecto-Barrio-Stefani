import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, user } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import type { EstadoLead } from "@/lib/schema";

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
          asignadoNombre: user.name,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .leftJoin(user, eq(leads.asignadoA, user.id))
        .orderBy(leads.createdAt);

  return NextResponse.json(rows);
}
