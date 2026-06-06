export type BnaExchangeRate = {
  label: "BNA billete vendedor";
  sell: number | null;
  updatedAt: string | null;
  source: "dolarapi";
  available: boolean;
};

type DolarApiOfficialResponse = {
  venta?: unknown;
  fechaActualizacion?: unknown;
};

export async function getBnaBilleteVendedor(): Promise<BnaExchangeRate> {
  try {
    const response = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return unavailableRate();
    }

    const data = (await response.json()) as DolarApiOfficialResponse;
    const sell = typeof data.venta === "number" ? data.venta : null;
    const updatedAt =
      typeof data.fechaActualizacion === "string"
        ? data.fechaActualizacion
        : null;

    if (sell === null) {
      return unavailableRate();
    }

    return {
      label: "BNA billete vendedor",
      sell,
      updatedAt,
      source: "dolarapi",
      available: true,
    };
  } catch {
    return unavailableRate();
  }
}

function unavailableRate(): BnaExchangeRate {
  return {
    label: "BNA billete vendedor",
    sell: null,
    updatedAt: null,
    source: "dolarapi",
    available: false,
  };
}
