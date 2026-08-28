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
