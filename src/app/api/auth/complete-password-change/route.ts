import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { account, user } from "@/lib/schema";

const bodySchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = bodySchema.parse(body);
    const passwordHash = await hashPassword(data.password);

    await db.transaction(async (tx) => {
      const [credentialAccount] = await tx
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.userId, authUser.id),
            eq(account.providerId, "credential")
          )
        )
        .limit(1);

      if (!credentialAccount) {
        throw new Error("credential account not found");
      }

      await tx
        .update(account)
        .set({ password: passwordHash })
        .where(eq(account.id, credentialAccount.id));

      await tx
        .update(user)
        .set({ mustChangePassword: false })
        .where(eq(user.id, authUser.id));
    });

    return NextResponse.json({ ok: true });
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
