import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateUserSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    role: z.enum(["admin", "comercial"]).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

// TODO: Password change is not implemented yet.
// Better Auth's `auth.api.changePassword` requires the current password,
// which is not suitable for an admin reset flow. A dedicated admin
// password-reset endpoint (e.g. using `auth.api.setPassword` or direct
// hash update on the `account` table) should be added in the future.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Build the set object with only the provided fields
    const updates: Record<string, string> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.role !== undefined) updates.role = data.role;

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
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
