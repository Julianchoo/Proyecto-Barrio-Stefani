"use client";

import { useState, type FormEvent } from "react";
import { Archive, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatosComprador } from "@/lib/reservas";
import { formatDate } from "@/lib/reservas-ui";

const fields: Array<[keyof DatosComprador, string]> = [
  ["nombreComprador", "Nombre"],
  ["dniCuit", "DNI / CUIT"],
  ["telefono", "Teléfono"],
  ["emailComprador", "Email"],
  ["domicilioComprador", "Domicilio"],
  ["nacionalidad", "Nacionalidad"],
  ["fechaNacimiento", "Fecha de nacimiento"],
  ["estadoCivil", "Estado civil"],
  ["cuitComprador", "CUIT comprador"],
];

export function CompradorReservaComparison({
  guardado,
  actual,
  leadId,
  capturadoAt,
  correccion,
}: {
  guardado: DatosComprador | undefined;
  actual: Partial<DatosComprador>;
  leadId: number | null;
  capturadoAt?: string | null | undefined;
  correccion?: { reservaId: number; version: string; onSaved: () => Promise<void> } | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correccion || saving) return;
    const form = new FormData(event.currentTarget);
    const comprador = Object.fromEntries(
      fields.map(([field]) => [field, String(form.get(field) ?? "").trim() || null])
    );
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/reservas/${correccion.reservaId}/comprador-guardado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comprador,
          motivo: form.get("motivo"),
          confirmar: form.get("confirmar") === "on",
          version: correccion.version,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        toast.error(body.error || "No se pudo guardar la corrección");
        return;
      }
      setEditing(false);
      await correccion.onSaved();
      toast.success("Corrección histórica guardada y auditada");
    } catch {
      toast.error(
        "No se pudo completar la solicitud. Recargá la ficha para verificar el resultado"
      );
    } finally {
      setSaving(false);
    }
  }
  const hasCopy = Object.values(guardado ?? {}).some((value) => value?.trim());
  const differs = (field: keyof DatosComprador) =>
    leadId !== null && (guardado?.[field] ?? "") !== (actual[field] ?? "");
  const differences = hasCopy ? fields.filter(([field]) => differs(field)).length : 0;
  const display = (field: keyof DatosComprador, value: string | null | undefined) =>
    field === "fechaNacimiento" && value ? formatDate(value) : value || "Sin dato";

  return (
    <details className="group bg-card text-card-foreground overflow-hidden rounded-lg border shadow-sm">
      <summary className="focus-visible:outline-ring flex cursor-pointer list-none items-center gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
          <Archive aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">Copia guardada en la reserva</span>
          <span className="text-muted-foreground block text-xs">
            Comparación con los datos actuales del comprador
          </span>
        </span>
        {hasCopy && leadId !== null && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${differences ? "bg-amber-500/10 text-amber-800 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}
          >
            {differences
              ? `${differences} diferencia${differences === 1 ? "" : "s"}`
              : "Sin diferencias"}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t">
        {hasCopy ? (
          <>
            <p className="text-muted-foreground px-5 py-4 text-xs leading-relaxed">
              Estos son los valores guardados en esta reserva.
              {capturadoAt
                ? ` Copia capturada el ${new Date(capturadoAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} (hora de Argentina). Las correcciones posteriores quedan en auditoría.`
                : " No hay una fecha de captura registrada y pueden haber sido editados después."}
              {leadId !== null
                ? " Los datos actuales del lead se usan en cuotas y reportes."
                : " Esta reserva no tiene un lead vinculado."}
            </p>
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">
                Datos guardados en la reserva y datos actuales del lead
              </caption>
              <thead className="bg-muted/50 text-muted-foreground border-y text-xs">
                <tr>
                  <th scope="col" className="w-[26%] px-4 py-3 font-medium sm:w-[24%] sm:px-5">
                    Dato
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium sm:px-5">
                    En esta reserva
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium sm:px-5">
                    {leadId !== null ? `Lead actual #${leadId}` : "Sin lead vinculado"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map(([field, label]) => (
                  <tr key={field} className={differs(field) ? "bg-amber-500/5" : undefined}>
                    <th
                      scope="row"
                      className="text-muted-foreground px-4 py-3 align-top font-normal sm:px-5"
                    >
                      {label}
                      {differs(field) && (
                        <span className="mt-1 block text-[11px] font-medium text-amber-800 dark:text-amber-400">
                          Diferente
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-3 align-top break-words sm:px-5">
                      {display(field, guardado?.[field])}
                    </td>
                    <td className="px-3 py-3 align-top font-medium break-words sm:px-5">
                      {leadId !== null ? display(field, actual[field]) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-muted-foreground px-5 py-5 text-sm">
            Esta reserva no tiene una copia guardada del comprador.
            {leadId !== null && ` Los datos actuales provienen del lead #${leadId}.`}
          </p>
        )}
        {correccion && (
          <div className="border-t p-5">
            {!editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Corregir copia histórica
              </Button>
            ) : (
              <form onSubmit={save} className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Corregí únicamente errores de la copia guardada. Esta acción queda auditada con su
                  motivo. Para actualizar los datos actuales del comprador, editá el lead.
                </p>
                <fieldset disabled={saving} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map(([field, label]) => (
                      <label key={field} className="space-y-1 text-sm">
                        <span>{label}</span>
                        <Input
                          name={field}
                          type={
                            field === "fechaNacimiento"
                              ? "date"
                              : field === "emailComprador"
                                ? "email"
                                : "text"
                          }
                          maxLength={500}
                          defaultValue={guardado?.[field] ?? ""}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span>Motivo de la corrección</span>
                    <Input name="motivo" required minLength={5} maxLength={1000} />
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input name="confirmar" type="checkbox" required className="mt-1" />
                    Confirmo la corrección de la copia histórica de esta reserva.
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit">{saving ? "Guardando…" : "Guardar corrección"}</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
