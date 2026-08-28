"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ExchangeRateState =
  | { status: "idle" }
  | {
      status: "ready";
      label: string;
      sell: number;
      updatedAt: string | null;
    }
  | { status: "unavailable" };

type ExchangeRateResponse = {
  label?: unknown;
  sell?: unknown;
  updatedAt?: unknown;
  available?: unknown;
};

type BlueRateState =
  | { status: "idle" | "unavailable" }
  | { status: "ready"; buy: number; sell: number; average: number };

type BlueRateResponse = {
  buy?: unknown;
  sell?: unknown;
  average?: unknown;
  available?: unknown;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function BnaExchangeRateIndicator({
  enabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}) {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateState>({
    status: "idle",
  });
  const [blueRate, setBlueRate] = useState<BlueRateState>({ status: "idle" });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch("/api/tipo-cambio/bna")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ExchangeRateResponse;
      })
      .then((data) => {
        if (cancelled) return;

        if (
          !data ||
          data.available !== true ||
          typeof data.sell !== "number" ||
          typeof data.label !== "string"
        ) {
          setExchangeRate({ status: "unavailable" });
          return;
        }

        setExchangeRate({
          status: "ready",
          label: data.label,
          sell: data.sell,
          updatedAt:
            typeof data.updatedAt === "string" ? data.updatedAt : null,
        });
      })
      .catch(() => {
        if (!cancelled) setExchangeRate({ status: "unavailable" });
      });

    fetch("/api/tipo-cambio/ambito-blue")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BlueRateResponse;
      })
      .then((data) => {
        if (cancelled) return;
        if (
          !data ||
          data.available !== true ||
          typeof data.buy !== "number" ||
          typeof data.sell !== "number" ||
          typeof data.average !== "number"
        ) {
          setBlueRate({ status: "unavailable" });
          return;
        }
        setBlueRate({
          status: "ready",
          buy: data.buy,
          sell: data.sell,
          average: data.average,
        });
      })
      .catch(() => {
        if (!cancelled) setBlueRate({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || exchangeRate.status === "idle") return null;

  const blueReference =
    blueRate.status === "ready" ? (
      <div className="border-b border-current/10 pb-1.5 text-slate-500 dark:text-slate-400">
        <span className="block text-[11px] font-medium">
          Ámbito Blue promedio:{" "}
          <span className="font-semibold">{formatCurrency(blueRate.average)}</span>
        </span>
        <span className="block text-[10px] opacity-75">
          C {formatCurrency(blueRate.buy)} / V {formatCurrency(blueRate.sell)}
        </span>
      </div>
    ) : null;

  if (exchangeRate.status === "unavailable") {
    return (
      <div className={cn("space-y-1.5 leading-tight", className)}>
        {blueReference}
        <span className="text-xs font-medium text-current/70">
          BNA billete vendedor no disponible
        </span>
      </div>
    );
  }

  const updatedAt = formatUpdatedAt(exchangeRate.updatedAt);

  return (
    <div className={cn("space-y-1.5 leading-tight", className)}>
      {blueReference}
      <span className="text-xs font-medium text-current/70">
        {exchangeRate.label}:{" "}
        <span className="font-semibold text-current">
          {formatCurrency(exchangeRate.sell)}
        </span>
      </span>
      {updatedAt ? (
        <span className="text-[11px] text-current/55">
          Act. {updatedAt}
        </span>
      ) : null}
    </div>
  );
}
