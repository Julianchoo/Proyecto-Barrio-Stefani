import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { parcelasDeManzanas } from "@/lib/arba";
import { soloDisponibilidad } from "@/lib/lotes-mapa";
import { getLotesPublicos } from "@/lib/lotes-publicos";

// Público: lo usa el mapa de /mapa y la pestaña Mapa del CRM. Sólo expone
// catastro, estado y precio de lista (ver getLotesPublicos). Sin sesión, el estado
// se reduce a disponible / no disponible: no se revela qué está reservado o vendido.
// La geometría sale de la copia del catastro de ARBA guardada en el repo (ver @/lib/arba).
export async function GET() {
  const todos = await getLotesPublicos();
  const lotes = (await getAuthenticatedUser()) ? todos : todos.map(soloDisponibilidad);
  const manzanas = [
    ...new Set(
      lotes
        .map((lote) => lote.manzana?.trim())
        .filter((manzana): manzana is string => !!manzana && /^\d+$/.test(manzana))
    ),
  ];

  return NextResponse.json({
    geometria: { type: "FeatureCollection", features: parcelasDeManzanas(manzanas) },
    lotes,
  });
}
