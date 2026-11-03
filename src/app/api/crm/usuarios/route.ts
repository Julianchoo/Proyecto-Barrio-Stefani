import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validationMessage } from "@/lib/validation-message";

export async function GET() {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
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
  role: z.enum(["admin", "comercial", "socio"]),
});

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Public sign-up is disabled (disableSignUp), so create the user through
    // Better Auth's internal adapter, same steps as its sign-up route.
    const ctx = await auth.$context;
    const email = data.email.toLowerCase();

    if (await ctx.internalAdapter.findUserByEmail(email)) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    const hash = await ctx.password.hash(data.password);
    const created = await ctx.internalAdapter.createUser({
      name: data.name,
      email,
      emailVerified: false,
    });

    if (!created?.id) {
      return NextResponse.json(
        { error: "No se pudo crear el usuario" },
        { status: 500 }
      );
    }

    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: hash,
    });

    // Update role if not default
    if (data.role !== "comercial") {
      await db
        .update(user)
        .set({ role: data.role })
        .where(eq(user.id, created.id));
    }

    return NextResponse.json(
      { id: created.id, email, role: data.role },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: validationMessage(error.issues), details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
