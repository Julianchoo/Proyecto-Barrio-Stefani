import { auth } from "./auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (session.user as { role?: string }).role ?? "comercial",
  };
}

export async function requireApiAuth(): Promise<AuthUser | NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return user;
}

export async function requireApiAdmin(): Promise<AuthUser | NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return user;
}

export function isErrorResponse(
  result: AuthUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
