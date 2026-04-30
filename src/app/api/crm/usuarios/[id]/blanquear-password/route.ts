import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { isErrorResponse, requireApiAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { account, user } from "@/lib/schema";

function generateTemporaryPassword() {
  return `Temp-${randomUUID().slice(0, 8)}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;

  try {
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await db.transaction(async (tx) => {
      const [credentialAccount] = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, id), eq(account.providerId, "credential")))
        .limit(1);

      if (credentialAccount) {
        await tx
          .update(account)
          .set({ password: passwordHash })
          .where(eq(account.id, credentialAccount.id));
      } else {
        await tx.insert(account).values({
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          userId: id,
          password: passwordHash,
        });
      }

      await tx
        .update(user)
        .set({ mustChangePassword: true })
        .where(eq(user.id, id));
    });

    return NextResponse.json({ temporaryPassword });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
