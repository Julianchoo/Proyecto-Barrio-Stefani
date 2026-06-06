import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { getBnaBilleteVendedor } from "@/lib/bna-exchange-rate";

export async function GET() {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  if (!["admin", "comercial"].includes(authResult.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  return NextResponse.json(await getBnaBilleteVendedor());
}
