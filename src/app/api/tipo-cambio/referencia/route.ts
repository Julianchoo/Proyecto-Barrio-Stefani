import { NextResponse } from "next/server";
import { getBnaBilleteVendedor } from "@/lib/bna-exchange-rate";

// Público: lo usa la calculadora de cuota para mostrar los importes en pesos a
// modo de referencia. Sólo expone la cotización BNA billete vendedor.
export async function GET() {
  const rate = await getBnaBilleteVendedor();
  return NextResponse.json({ valor: rate.sell, fecha: rate.updatedAt });
}
