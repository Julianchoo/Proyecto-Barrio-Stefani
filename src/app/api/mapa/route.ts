import { NextResponse } from "next/server";
import { getLotesPublicos } from "@/lib/lotes-publicos";

// Público: lo usa el mapa de /mapa y la pestaña Mapa del CRM. Sólo expone
// catastro, estado y precio de lista (ver getLotesPublicos).

// Geometría oficial de cada lote, tomada del WFS público de ARBA (catastro de PBA).
// Moreno = partido 074, Circunscripción V (05), Sección F. El código catastral (cca)
// de una manzana es "074050F" + número de manzana con ceros a la izquierda + "000".
const ARBA_WFS = "https://geo.arba.gov.ar/geoserver/idera/wfs";
const SECCION_PREFIX = "074050F";

function manzanaCca(manzana: string) {
  return `${SECCION_PREFIX}${manzana.padStart(25, "0")}000`;
}

export async function GET() {
  const lotes = await getLotesPublicos();
  const manzanas = [
    ...new Set(
      lotes
        .map((lote) => lote.manzana?.trim())
        .filter((manzana): manzana is string => !!manzana && /^\d+$/.test(manzana))
    ),
  ];

  if (manzanas.length === 0) {
    return NextResponse.json({ geometria: { type: "FeatureCollection", features: [] }, lotes });
  }

  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: "idera:Parcela",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    propertyName: "cca,pda,geom",
    CQL_FILTER: manzanas
      .map((manzana) => `cca LIKE '${manzanaCca(manzana)}%'`)
      .join(" OR "),
  });

  try {
    // El catastro casi no cambia: se cachea una semana.
    const response = await fetch(`${ARBA_WFS}?${params}`, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `ARBA respondió ${response.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ geometria: await response.json(), lotes });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el catastro de ARBA" },
      { status: 502 }
    );
  }
}
