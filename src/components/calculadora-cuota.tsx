"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  ANTICIPO_STEP_USD,
  calculateInstallment,
  formatUsd,
  getMinimumAnticipoUsd,
  PLAZO_MAX_PUBLICO,
  roundCurrency,
  TASA_PUBLICA,
} from "@/lib/financiacion";

type Calculator = { precio: number; anticipo: number; tasa: number; plazo: number };

type TipoCambio = { valor: number | null; fecha: string | null };

function formatArs(value: number): string {
  return `$ ${Math.round(value).toLocaleString("es-AR")}`;
}

function formatDeliveryInstallment(value: number): string {
  if (value === 0) return "Con el anticipo";
  return `Después de cuota ${value}`;
}

/**
 * Calculadora de cuota. En modo `publico` el precio viene fijo (el del lote),
 * la tasa queda en 1% y el plazo llega hasta 60 cuotas. Para recalcular con
 * otro precio, el padre cambia la `key`.
 */
export type Simulacion = { anticipo: number; plazo: number; cuotaMensual: number };

export function CalculadoraCuota({
  precio = 15000,
  publico = false,
  onSimulacion,
}: {
  precio?: number;
  publico?: boolean;
  onSimulacion?: (simulacion: Simulacion) => void;
}) {
  const [calculator, setCalculator] = useState<Calculator>(() =>
    publico
      ? { precio, anticipo: getMinimumAnticipoUsd(precio), tasa: TASA_PUBLICA, plazo: PLAZO_MAX_PUBLICO }
      : { precio, anticipo: 4500, tasa: 1, plazo: 48 }
  );

  const [enPesos, setEnPesos] = useState(false);
  const [tipoCambio, setTipoCambio] = useState<TipoCambio | null>(null);

  useEffect(() => {
    if (!enPesos || tipoCambio) return;
    fetch("/api/tipo-cambio/referencia")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TipoCambio | null) => setTipoCambio(data ?? { valor: null, fecha: null }))
      .catch(() => setTipoCambio({ valor: null, fecha: null }));
  }, [enPesos, tipoCambio]);

  const tc = enPesos ? tipoCambio?.valor ?? null : null;
  const formatMonto = (value: number) => (tc ? formatArs(value * tc) : formatUsd(value));

  const minimumAnticipo = getMinimumAnticipoUsd(calculator.precio);

  const calculatorResult = useMemo(() => {
    const saldo = Math.max(calculator.precio - calculator.anticipo, 0);
    const plazo = Math.max(calculator.plazo, 1);
    const cuotaMensual = calculateInstallment(saldo, calculator.tasa, plazo);
    const totalFinanciado = roundCurrency(cuotaMensual * plazo);
    const precioTotalNominal = roundCurrency(calculator.anticipo + totalFinanciado);
    const umbralEntrega = precioTotalNominal * 0.5;
    const cuotaEntrega = calculator.anticipo >= umbralEntrega
      ? 0
      : Math.ceil((umbralEntrega - calculator.anticipo) / cuotaMensual);

    return {
      cuotaMensual,
      totalFinanciado,
      precioTotalNominal,
      cuotaEntrega: Math.min(cuotaEntrega, plazo),
    };
  }, [calculator]);

  useEffect(() => {
    onSimulacion?.({
      anticipo: calculator.anticipo,
      plazo: calculator.plazo,
      cuotaMensual: calculatorResult.cuotaMensual,
    });
  }, [onSimulacion, calculator.anticipo, calculator.plazo, calculatorResult.cuotaMensual]);

  function updateCalculatorValue(
    key: keyof Calculator,
    value: number,
    enforceAnticipoMinimum = true
  ) {
    setCalculator((current) => {
      const next = { ...current, [key]: Math.max(value, key === "plazo" ? 1 : 0) };
      if (key === "precio" && next.anticipo > value) {
        next.anticipo = value;
      }
      if (key === "precio") {
        next.anticipo = Math.max(
          next.anticipo,
          getMinimumAnticipoUsd(value)
        );
      }
      if (key === "anticipo") {
        next.anticipo = Math.min(
          Math.max(
            value,
            enforceAnticipoMinimum
              ? getMinimumAnticipoUsd(current.precio)
              : 0
          ),
          current.precio
        );
      }
      if (key === "plazo" && publico) {
        next.plazo = Math.min(next.plazo, PLAZO_MAX_PUBLICO);
      }
      return next;
    });
  }

  const fields = [
    {
      key: "precio" as const,
      label: "Precio",
      min: 0,
      max: 100000,
      step: 500,
      suffix: "USD",
    },
    {
      key: "anticipo" as const,
      label: "Anticipo",
      min: minimumAnticipo,
      max: calculator.precio,
      step: ANTICIPO_STEP_USD,
      suffix: "USD",
    },
    {
      key: "tasa" as const,
      label: "Tasa mensual",
      min: 0,
      max: 5,
      step: 0.1,
      suffix: "%",
    },
    {
      key: "plazo" as const,
      label: "Plazo",
      min: 1,
      max: publico ? PLAZO_MAX_PUBLICO : 120,
      step: 1,
      suffix: "meses",
    },
  ].filter((item) => !publico || item.key === "anticipo" || item.key === "plazo");

  const results: [string, string][] = publico
    ? [
        ["Cuota inicial base", formatMonto(calculatorResult.cuotaMensual)],
        ["Total en cuotas", formatMonto(calculatorResult.totalFinanciado)],
        ["Precio total", formatMonto(calculatorResult.precioTotalNominal)],
      ]
    : [
        ["Cuota inicial base", formatMonto(calculatorResult.cuotaMensual)],
        ["Plazo total financiado", formatMonto(calculatorResult.totalFinanciado)],
        ["Precio total nominal", formatMonto(calculatorResult.precioTotalNominal)],
        ["Cuota de entrega", formatDeliveryInstallment(calculatorResult.cuotaEntrega)],
      ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Ver valores en</span>
        <div
          className="relative inline-grid grid-cols-2 rounded-full border bg-muted/60 p-1 shadow-inner"
          role="group"
          aria-label="Moneda"
        >
          <span
            aria-hidden
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-300 ease-out ${
              enPesos ? "translate-x-full" : "translate-x-0"
            }`}
          />
          {([
            [false, "USD"],
            [true, "Pesos"],
          ] as const).map(([pesos, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={enPesos === pesos}
              onClick={() => setEnPesos(pesos)}
              className={`relative z-10 min-w-16 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
                enPesos === pesos
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={publico ? "grid gap-4" : "grid gap-4 lg:grid-cols-4"}>
        {fields.map((item) => (
          <label key={item.key} className="space-y-2">
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="flex items-center gap-2">
                <Input
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.key === "anticipo" ? "any" : item.step}
                  value={calculator[item.key]}
                  onChange={(e) => {
                    updateCalculatorValue(
                      item.key,
                      Number(e.target.value),
                      item.key !== "anticipo"
                    );
                  }}
                  aria-invalid={
                    item.key === "anticipo" &&
                    calculator.anticipo < minimumAnticipo
                  }
                  className={`h-8 w-28 text-right ${
                    item.key === "anticipo" &&
                    calculator.anticipo < minimumAnticipo
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }`}
                />
                <span className="w-10 text-left text-muted-foreground">
                  {item.suffix}
                </span>
              </span>
            </span>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={Math.min(calculator[item.key], item.max)}
              onChange={(e) => {
                updateCalculatorValue(item.key, Number(e.target.value));
              }}
              className="w-full accent-primary"
            />
            {item.key === "anticipo" &&
              calculator.anticipo < minimumAnticipo && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  Mínimo: {formatUsd(minimumAnticipo)}
                </p>
              )}
          </label>
        ))}
      </div>
      <div className={publico ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-4"}>
        {results.map(([label, value], i) => (
          <div
            key={label}
            className={`rounded-md border bg-muted/40 px-3 py-2 ${publico && i === 0 ? "col-span-2" : ""}`}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
            {i === 0 && (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                No es una cuota fija: se ajusta mes a mes por CAC.
              </p>
            )}
          </div>
        ))}
      </div>
      {enPesos && (
        <p className="text-xs text-muted-foreground">
          {!tipoCambio
            ? "Buscando la cotización del dólar…"
            : tc
              ? `Conversión con dólar BNA vendedor ${formatArs(tc)}${
                  tipoCambio.fecha
                    ? ` (${new Date(tipoCambio.fecha).toLocaleDateString("es-AR")})`
                    : ""
                }. Anticipo y precio se cargan en USD.`
              : "No pudimos obtener la cotización del dólar; se muestran los valores en USD."}
        </p>
      )}
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Valores estimativos. La operación se pacta en pesos con ajuste por CAC y
        las condiciones finales se definen en el contrato.
      </p>
    </div>
  );
}
