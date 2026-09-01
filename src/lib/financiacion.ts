export const MIN_ANTICIPO_PCT = 19;
export const ANTICIPO_STEP_USD = 100;

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateInstallment(saldo: number, tasaMensual: number, plazo: number) {
  const safePlazo = Math.max(plazo, 1);
  return roundCurrency(
    (saldo * (1 + (tasaMensual / 100) * safePlazo)) / safePlazo
  );
}

export function getMinimumAnticipoUsd(precioLista: number) {
  const minimum = (Math.max(precioLista, 0) * MIN_ANTICIPO_PCT) / 100;
  return Math.ceil(minimum / ANTICIPO_STEP_USD) * ANTICIPO_STEP_USD;
}
