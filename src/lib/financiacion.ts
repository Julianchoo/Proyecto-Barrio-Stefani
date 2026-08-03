export const MIN_ANTICIPO_PCT = 19;
export const ANTICIPO_STEP_USD = 100;

export function getMinimumAnticipoUsd(precioLista: number) {
  const minimum = (Math.max(precioLista, 0) * MIN_ANTICIPO_PCT) / 100;
  return Math.ceil(minimum / ANTICIPO_STEP_USD) * ANTICIPO_STEP_USD;
}
