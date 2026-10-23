import { argentinaTodayKey } from "@/lib/tipos-cambio";

export type AmbitoBlueRate = {
  buy: number | null;
  sell: number | null;
  average: number | null;
  updatedAt: string | null;
  available: boolean;
  source: "ambito";
};

type AmbitoResponse = {
  compra?: unknown;
  venta?: unknown;
  fecha?: unknown;
};

function parseArgentineNumber(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function getAmbitoBlueAverage(): Promise<AmbitoBlueRate> {
  try {
    const response = await fetch(
      "https://mercados.ambito.com/dolar/informal/variacion",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 300 },
      }
    );
    if (!response.ok) return unavailableRate();

    const data = (await response.json()) as AmbitoResponse;
    const buy = parseArgentineNumber(data.compra);
    const sell = parseArgentineNumber(data.venta);
    if (buy === null || sell === null) return unavailableRate();

    return {
      buy,
      sell,
      average: (buy + sell) / 2,
      updatedAt: typeof data.fecha === "string" ? data.fecha : null,
      available: true,
      source: "ambito",
    };
  } catch {
    return unavailableRate();
  }
}

// fecha en yyyy-mm-dd. Hoy (o futuro) usa la cotización actual; días pasados, el histórico.
export async function getAmbitoBlueAverageOn(fecha: string): Promise<AmbitoBlueRate> {
  if (fecha >= argentinaTodayKey()) return getAmbitoBlueAverage();
  const toAmbito = (key: string) => key.split("-").reverse().join("-");
  const desde = new Date(`${fecha}T12:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 10);
  try {
    const response = await fetch(
      `https://mercados.ambito.com/dolar/informal/historico-general/${toAmbito(desde.toISOString().slice(0, 10))}/${toAmbito(fecha)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 3600 },
      }
    );
    if (!response.ok) return unavailableRate();

    // [["Fecha","Compra","Venta"], ["22/10/2026","1545,00","1565,00"], ...]
    const [, ...rows] = (await response.json()) as unknown[][];
    // Sin cotización fines de semana y feriados: se toma el último día hábil anterior.
    const latest = rows
      .map(([dia, compra, venta]) => ({
        key: String(dia).split("/").reverse().join("-"),
        buy: parseArgentineNumber(compra),
        sell: parseArgentineNumber(venta),
      }))
      .filter((row) => row.key <= fecha && row.buy !== null && row.sell !== null)
      .sort((a, b) => b.key.localeCompare(a.key))[0];
    if (!latest) return unavailableRate();

    return {
      buy: latest.buy,
      sell: latest.sell,
      average: (latest.buy! + latest.sell!) / 2,
      updatedAt: latest.key,
      available: true,
      source: "ambito",
    };
  } catch {
    return unavailableRate();
  }
}

function unavailableRate(): AmbitoBlueRate {
  return {
    buy: null,
    sell: null,
    average: null,
    updatedAt: null,
    available: false,
    source: "ambito",
  };
}
