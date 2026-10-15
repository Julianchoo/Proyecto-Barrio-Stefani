"use client";

import { useEffect, useState } from "react";
import { Edit2, Loader2, Save, Trash2 } from "lucide-react";
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
import type { IndiceCac } from "@/lib/schema";

const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodo(value: string) {
  const [year, month] = value.split("-");
  return `${monthLabels[Number(month) - 1] ?? month} ${year}`;
}

// Carga y listado del índice CAC mensual. Mismo diseño que TiposCambioCard.
export function IndicesCacCard({ onSaved }: { onSaved?: () => Promise<unknown> | void }) {
  const [indices, setIndices] = useState<IndiceCac[]>([]);
  const [periodo, setPeriodo] = useState("");
  const [valor, setValor] = useState("");
  const [fuente, setFuente] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchIndices() {
    const res = await fetch("/api/crm/indices-cac");
    if (!res.ok) {
      toast.error("No se pudieron cargar los CAC. Recargá la página; si sigue, avisale a un administrador");
      return;
    }
    const rows: IndiceCac[] = await res.json();
    setIndices([...rows].sort((a, b) => b.periodo.localeCompare(a.periodo)));
  }

  useEffect(() => {
    void fetchIndices();
  }, []);

  function resetForm() {
    setEditing(null);
    setPeriodo("");
    setValor("");
    setFuente("");
  }

  async function save() {
    const numericValue = Number(valor);
    if (!periodo) {
      toast.error("Elegí el período (mes y año) del CAC");
      return;
    }
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Ingresá el valor del índice CAC (mayor a 0)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/crm/indices-cac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, valor: numericValue, fuente: fuente || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo guardar el CAC");
        return;
      }
      toast.success(editing ? "CAC actualizado" : "CAC guardado");
      resetForm();
      await Promise.all([fetchIndices(), onSaved?.()]);
    } finally {
      setSaving(false);
    }
  }

  async function remove(indice: IndiceCac) {
    if (!window.confirm(`¿Borrar el CAC de ${formatPeriodo(indice.periodo)}?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/indices-cac", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: indice.periodo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo borrar el CAC");
        return;
      }
      toast.success("CAC borrado");
      if (editing === indice.periodo) resetForm();
      await Promise.all([fetchIndices(), onSaved?.()]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Índice CAC mensual</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ajusta las cuotas en pesos. Cada cuota usa el CAC de dos meses antes de su vencimiento.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cac-periodo">Período</Label>
            <Input
              id="cac-periodo"
              type="month"
              value={periodo}
              onChange={(event) => setPeriodo(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cac-valor">Valor</Label>
            <Input
              id="cac-valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(event) => setValor(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cac-fuente">Fuente / nota</Label>
            <Input
              id="cac-fuente"
              value={fuente}
              onChange={(event) => setFuente(event.target.value)}
              placeholder="Carga manual"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {editing ? "Guardar cambios" : "Guardar CAC"}
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
                <TableHead>Período</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Cargado por</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {indices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Todavía no hay CAC cargados.
                  </TableCell>
                </TableRow>
              ) : (
                indices.map((indice) => (
                  <TableRow
                    key={indice.id}
                    data-state={editing === indice.periodo ? "selected" : undefined}
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatPeriodo(indice.periodo)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {Number(indice.valor).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {indice.fuente ?? indice.nota ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {indice.creadoPor ?? "-"}
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
                            setEditing(indice.periodo);
                            setPeriodo(indice.periodo);
                            setValor(String(indice.valor));
                            setFuente(indice.fuente ?? "");
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar CAC de {formatPeriodo(indice.periodo)}</span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={saving}
                          onClick={() => remove(indice)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Borrar CAC de {formatPeriodo(indice.periodo)}</span>
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
