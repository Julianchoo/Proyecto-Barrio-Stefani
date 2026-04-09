import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";

export async function GET() {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt);

  return NextResponse.json(users);
}

const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "comercial"]),
});

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Use Better Auth server-side API to create user (handles password hashing)
    const result = await auth.api.signUpEmail({
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
      },
      headers: await headers(),
    });

    if (!result?.user?.id) {
      return NextResponse.json(
        { error: "No se pudo crear el usuario" },
        { status: 500 }
      );
    }

    // Update role if not default
    if (data.role !== "comercial") {
      await db
        .update(user)
        .set({ role: data.role })
        .where(eq(user.id, result.user.id));
    }

    return NextResponse.json(
      { id: result.user.id, email: data.email, role: data.role },
      { status: 201 }
    );
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
