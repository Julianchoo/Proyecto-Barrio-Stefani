"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { estadoColors, estadoLabels, isVigente } from "@/lib/reservas-ui";
import type { EstadoReserva } from "@/lib/schema";

type ReservaRef = {
  id: number;
  estado: EstadoReserva;
  loteNumero: number;
  nombreComprador: string | null;
};

function consecuencias(from: EstadoReserva, to: EstadoReserva, loteNumero: number) {
  const lote = `el lote ${loteNumero}`;
  const items: string[] = [];
  if (to === "activa") items.push(`${lote} pasa a RESERVADO.`);
  if (to === "realizada") {
    items.push(`Se registra la VENTA: ${lote} pasa a VENDIDO.`);
    items.push("Si es financiada, se genera la cuenta corriente con sus cuotas.");
  }
  if (isVigente(from) && !isVigente(to)) {
    items.push(`${lote} vuelve a DISPONIBLE y se puede reservar para otra persona.`);
  }
  if (from === "realizada") {
    items.push(
      "Se deshace una VENTA. La cuenta corriente y las cuotas ya generadas NO se borran: revisalas a mano."
    );
  }
  if (isVigente(to) && !isVigente(from)) {
    items.push(`Solo funciona si ${lote} no tiene otra reserva activa o realizada.`);
  }
  if (!isVigente(from) && !isVigente(to)) items.push(`${lote} no cambia.`);
  return items.map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

// Cambio de estado de una reserva, solo para admins. Muestra un Select con todos los estados,
// o un boton fijo (p. ej. "Cancelar reserva") si se pasa fixedTarget + label.
export function CambiarEstadoReserva({
  reserva,
  onChanged,
  fixedTarget,
  label,
}: {
  reserva: ReservaRef;
  onChanged: () => void | Promise<void>;
  fixedTarget?: EstadoReserva;
  label?: string;
}) {
  const [target, setTarget] = useState<EstadoReserva | null>(null);
  const [entiendo, setEntiendo] = useState(false);
  const [saving, setSaving] = useState(false);

  const mueveLote = target !== null && (isVigente(reserva.estado) || isVigente(target));

  function open(next: EstadoReserva) {
    if (next === reserva.estado) return;
    setEntiendo(false);
    setTarget(next);
  }

  async function confirm() {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/reservas/${reserva.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: target, confirmarCambioEstado: true }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        cuentaCorriente?: { status?: string; message?: string };
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo cambiar el estado de la reserva");
        return;
      }
      if (data?.cuentaCorriente?.status === "ok") {
        toast.success("Reserva actualizada. Cuenta corriente creada.");
      } else if (data?.cuentaCorriente?.message) {
        toast.warning(`Reserva actualizada. ${data.cuentaCorriente.message}.`);
      } else {
        toast.success(`Reserva #${reserva.id}: ${estadoLabels[target].toLowerCase()}`);
      }
      setTarget(null);
      await onChanged();
    } catch {
      toast.error("No se pudo cambiar el estado de la reserva");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {fixedTarget ? (
        <Button type="button" variant="outline" size="sm" onClick={() => open(fixedTarget)}>
          {label}
        </Button>
      ) : (
        <Select value={reserva.estado} onValueChange={(value) => open(value as EstadoReserva)}>
          <SelectTrigger className="h-7 w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColors[reserva.estado]}`}>
              {estadoLabels[reserva.estado]}
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            {(Object.keys(estadoLabels) as EstadoReserva[]).map((estado) => (
              <SelectItem key={estado} value={estado}>
                {estadoLabels[estado]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <AlertDialog open={target !== null} onOpenChange={(isOpen) => !isOpen && !saving && setTarget(null)}>
        {target && (
          <AlertDialogContent className={mueveLote ? "border-4 border-red-500" : undefined}>
            <AlertDialogHeader>
              <AlertDialogTitle
                className={`flex items-center gap-2 ${mueveLote ? "text-xl text-red-700" : ""}`}
              >
                {mueveLote && <AlertTriangle className="h-7 w-7 shrink-0" />}
                {mueveLote ? "OJO! " : ""}Reserva #{reserva.id}: {estadoLabels[reserva.estado]} →{" "}
                {estadoLabels[target]}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    {reserva.nombreComprador ?? "Sin comprador"} · Lote {reserva.loteNumero}
                  </p>
                  <ul
                    className={`list-disc space-y-1 rounded-md px-6 py-3 ${
                      mueveLote ? "bg-red-50 font-medium text-red-800" : "bg-muted"
                    }`}
                  >
                    {consecuencias(reserva.estado, target, reserva.loteNumero).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {mueveLote && (
              <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={entiendo}
                  onCheckedChange={(checked) => setEntiendo(checked === true)}
                  className="mt-0.5"
                />
                Entiendo que este cambio modifica el estado del lote {reserva.loteNumero}
              </label>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
              <Button
                type="button"
                variant={mueveLote ? "destructive" : "default"}
                disabled={saving || (mueveLote && !entiendo)}
                onClick={confirm}
              >
                {saving ? "Guardando..." : `Pasar a ${estadoLabels[target].toLowerCase()}`}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
