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

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || exchangeRate.status === "idle") return null;

  if (exchangeRate.status === "unavailable") {
    return (
      <div className={className}>
        <span className="text-xs font-medium text-muted-foreground">
          BNA billete vendedor no disponible
        </span>
      </div>
    );
  }

  const updatedAt = formatUpdatedAt(exchangeRate.updatedAt);

  return (
    <div className={cn("leading-tight", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        {exchangeRate.label}:{" "}
        <span className="font-semibold text-primary">
          {formatCurrency(exchangeRate.sell)}
        </span>
      </span>
      {updatedAt ? (
        <span className="text-[11px] text-muted-foreground/75">
          Act. {updatedAt}
        </span>
      ) : null}
    </div>
  );
}
