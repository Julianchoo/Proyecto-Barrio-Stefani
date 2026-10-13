"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toneBorders, tones } from "@/lib/tones";
import { cn } from "@/lib/utils";

export function CargarTipoCambio({
  fecha,
  sugerido,
  ultimo,
}: {
  fecha: string;
  sugerido: number | null;
  ultimo: { valor: number; fecha: string } | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(sugerido ? String(sugerido) : "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) {
      toast.error("Ingresá el BNA vendedor de hoy");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        fecha,
        valor: numero,
        fuente: "Carga manual (Insights)",
        confirmarImpacto: undefined as string | undefined,
      };
      let res = await fetch("/api/crm/tipos-cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await res.json().catch(() => null);
      // Si ya hay pagos de hoy en pesos (o contratos firmados hoy), el servidor pide confirmar.
      if (res.status === 409 && data?.confirmarImpacto) {
        if (
          !window.confirm(
            `Este TC cambiará importes de ${data.impact.pagos} pagos y ${data.impact.contratos} contratos sin pagos. ¿Confirmás el cambio?`
          )
        )
          return;
        payload.confirmarImpacto = data.confirmarImpacto;
        res = await fetch("/api/crm/tipos-cambio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = await res.json().catch(() => null);
      }
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar el tipo de cambio");
        return;
      }
      toast.success("BNA vendedor guardado");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", tones.warning, toneBorders.warning)}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm text-foreground">
        No hay BNA vendedor cargado para hoy.{" "}
        {ultimo
          ? `Las cuotas en pesos se pasan a USD con el último disponible ($ ${ultimo.valor.toLocaleString("es-AR")}, del ${ultimo.fecha.split("-").reverse().join("/")}).`
          : "Sin tipo de cambio, las cuotas en pesos no se incluyen en los montos en USD."}
      </p>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="BNA vendedor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-36 bg-background"
        />
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Cargar"}
        </Button>
      </div>
    </div>
  );
}
