import { toast } from "sonner";

type ApiError = { error?: string; cuentaCorrienteUrl?: string } | null;

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
