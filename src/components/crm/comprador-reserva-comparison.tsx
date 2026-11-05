import { Archive, ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/reservas-ui";
import type { DatosComprador } from "@/lib/reservas";

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
}: {
  guardado: DatosComprador | undefined;
  actual: Partial<DatosComprador>;
  leadId: number | null;
}) {
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
              Estos son los valores guardados en esta reserva. No hay una fecha de captura
              registrada y pueden haber sido editados después.
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
      </div>
    </details>
  );
}
