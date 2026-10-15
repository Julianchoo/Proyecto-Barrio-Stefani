import { toast } from "sonner";

type ApiError = { error?: string; cuentaCorrienteUrl?: string } | null;

export const NETWORK_ERROR = "No se pudo conectar con el servidor. Revisá la conexión y volvé a intentar.";

// Muestra el error de la API; si el bloqueo es por la cuenta corriente, agrega el acceso a ella.
export function toastApiError(data: ApiError, fallback: string) {
  const url = data?.cuentaCorrienteUrl;
  toast.error(
    data?.error ?? fallback,
    url
      ? {
          duration: 20000,
          action: { label: "Ir a la cuenta corriente", onClick: () => window.location.assign(url) },
        }
      : undefined
  );
}

// Actualización masiva: dice cuáles fallaron y por qué ("Mz 4 Lote 12 (tiene la reserva #45 vigente)").
export async function toastBulkErrors(
  failed: Array<{ label: string; res: Response }>,
  total: number,
  noun: string
) {
  const details = await Promise.all(
    failed.map(async ({ label, res }) => {
      const data = (await res.json().catch(() => null)) as ApiError;
      return `${label} (${data?.error ?? "error del servidor"})`;
    })
  );
  const rest = details.length > 3 ? ` y ${details.length - 3} más` : "";
  toast.error(
    `No se actualizaron ${failed.length} de ${total} ${noun}: ${details.slice(0, 3).join("; ")}${rest}`,
    { duration: 15000 }
  );
}
