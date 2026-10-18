import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import arbaRespaldo from "@/lib/arba-parcelas.json";
import { soloDisponibilidad } from "@/lib/lotes-mapa";
import { getLotesPublicos } from "@/lib/lotes-publicos";

// Público: lo usa el mapa de /mapa y la pestaña Mapa del CRM. Sólo expone
// catastro, estado y precio de lista (ver getLotesPublicos). Sin sesión, el estado
// se reduce a disponible / no disponible: no se revela qué está reservado o vendido.

// Geometría oficial de cada lote, tomada del WFS público de ARBA (catastro de PBA).
// Moreno = partido 074, Circunscripción V (05), Sección F. El código catastral (cca)
// de una manzana es "074050F" + número de manzana con ceros a la izquierda + "000".
const ARBA_WFS = "https://geo.arba.gov.ar/geoserver/idera/wfs";
const SECCION_PREFIX = "074050F";

function manzanaCca(manzana: string) {
  return `${SECCION_PREFIX}${manzana.padStart(25, "0")}000`;
}

// Copia de las parcelas del barrio bajada de ARBA (oct. 2026), para cuando el WFS
// no responde (p. ej. el 16/10/2026 se les venció el certificado SSL).
function geometriaRespaldo(manzanas: string[]) {
  const prefijos = manzanas.map(manzanaCca);
  return {
    type: "FeatureCollection",
    features: arbaRespaldo.features.filter((feature) =>
      prefijos.some((prefijo) => feature.properties.cca.startsWith(prefijo))
    ),
  };
}

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
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`ARBA respondió ${response.status}, se usa la copia local`);
      return NextResponse.json({ geometria: geometriaRespaldo(manzanas), lotes });
    }
    return NextResponse.json({ geometria: await response.json(), lotes });
  } catch (error) {
    console.error("No se pudo consultar el catastro de ARBA, se usa la copia local", error);
    return NextResponse.json({ geometria: geometriaRespaldo(manzanas), lotes });
  }
}
