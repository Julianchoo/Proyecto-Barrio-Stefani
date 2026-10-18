// Sin imports de servidor: lo usan /api/mapa, /api/cron/mapa-check y scripts/actualizar-parcelas-arba.ts.
import parcelasGuardadas from "./arba-parcelas.json";

// Geometría oficial de cada lote, tomada del WFS público de ARBA (catastro de PBA).
// Moreno = partido 074, Circunscripción V (05), Sección F. El código catastral (cca)
// de una manzana es "074050F" + número de manzana con ceros a la izquierda + "000".
const ARBA_WFS = "https://geo.arba.gov.ar/geoserver/idera/wfs";
const SECCION_PREFIX = "074050F";

export type ParcelaArba = {
  type: "Feature";
  properties: { cca: string; pda: string };
  geometry: unknown;
};

function manzanaCca(manzana: string) {
  return `${SECCION_PREFIX}${manzana.padStart(25, "0")}000`;
}

export function manzanaDeParcela(parcela: ParcelaArba) {
  return String(Number(parcela.properties.cca.slice(7, 32)));
}

function deManzanas(parcelas: ParcelaArba[], manzanas: string[]) {
  const prefijos = manzanas.map(manzanaCca);
  return parcelas.filter((parcela) =>
    prefijos.some((prefijo) => parcela.properties.cca.startsWith(prefijo))
  );
}

// El mapa usa siempre la copia guardada en arba-parcelas.json: el catastro casi no
// cambia y ARBA se cae sin aviso (el 16/10/2026 se les venció el certificado SSL).
// /api/cron/mapa-check avisa cuando la copia difiere de ARBA.
export function parcelasDeManzanas(manzanas: string[]) {
  return deManzanas(parcelasGuardadas.features as ParcelaArba[], manzanas);
}

export async function consultarArba(manzanas: string[]): Promise<ParcelaArba[]> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: "idera:Parcela",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    propertyName: "cca,pda,geom",
    CQL_FILTER: manzanas.map((manzana) => `cca LIKE '${manzanaCca(manzana)}%'`).join(" OR "),
  });
  const response = await fetch(`${ARBA_WFS}?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`ARBA respondió ${response.status}`);
  const data: { features: ParcelaArba[] } = await response.json();
  return data.features.map(({ properties, geometry }) => ({
    type: "Feature",
    properties: { cca: properties.cca, pda: properties.pda },
    geometry,
  }));
}

// Manzanas cuyas parcelas en ARBA no coinciden con la copia guardada.
export function manzanasConCambios(manzanas: string[], arba: ParcelaArba[]) {
  const guardadas = parcelasDeManzanas(manzanas);
  return manzanas.filter((manzana) => {
    const clave = (parcelas: ParcelaArba[]) =>
      JSON.stringify(
        deManzanas(parcelas, [manzana]).sort((a, b) =>
          a.properties.cca.localeCompare(b.properties.cca)
        )
      );
    return clave(guardadas) !== clave(arba);
  });
}
