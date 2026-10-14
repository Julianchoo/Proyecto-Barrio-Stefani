"use client";

import { useEffect, useState } from "react";
import { Edit2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TipoCambio } from "@/lib/schema";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatFecha(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// Carga y listado del BNA vendedor histórico. Mismo diseño que IndicesCacCard.
// onSaved refresca lo que dependa del TC.
export function TiposCambioCard({ onSaved }: { onSaved?: () => Promise<unknown> | void }) {
  const [rates, setRates] = useState<TipoCambio[]>([]);
  const [fecha, setFecha] = useState(todayKey());
  const [valor, setValor] = useState("");
  const [fuente, setFuente] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchRates() {
    const res = await fetch("/api/crm/tipos-cambio");
    if (!res.ok) return;
    setRates(await res.json());
  }

  useEffect(() => {
    void fetchRates();
  }, []);

  function resetForm() {
    setEditing(null);
    setFecha(todayKey());
    setValor("");
    setFuente("");
  }

  async function save() {
    const numericValue = Number(valor);
    if (!fecha || !Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Ingresá fecha y BNA vendedor");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha,
        valor: numericValue,
        fuente: fuente || "Carga manual",
        confirmarImpacto: undefined as string | undefined,
      };
      let res = await fetch("/api/crm/tipos-cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await res.json().catch(() => null);
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
      toast.success(editing ? "BNA vendedor actualizado" : "BNA vendedor guardado");
      resetForm();
      await Promise.all([fetchRates(), onSaved?.()]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">BNA vendedor histórico</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pasa los pagos en pesos a USD. Si no hay cotización del día del pago, se usa la última
          anterior.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="bna-fecha">Fecha</Label>
            <Input
              id="bna-fecha"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bna-valor">Valor</Label>
            <Input
              id="bna-valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(event) => setValor(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="bna-fuente">Fuente / nota</Label>
            <Input
              id="bna-fuente"
              value={fuente}
              onChange={(event) => setFuente(event.target.value)}
              placeholder="Carga manual"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {editing ? "Guardar cambios" : "Guardar BNA"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
              Cancelar
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Cargado por</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Todavía no hay cotizaciones cargadas.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id} data-state={editing === rate.fecha ? "selected" : undefined}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatFecha(rate.fecha)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      $ {Number(rate.valor).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rate.fuente ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rate.creadoPor ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={saving}
                          onClick={() => {
                            setEditing(rate.fecha);
                            setFecha(rate.fecha);
                            setValor(String(rate.valor));
                            setFuente(rate.fuente ?? "");
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar cotización del {formatFecha(rate.fecha)}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
