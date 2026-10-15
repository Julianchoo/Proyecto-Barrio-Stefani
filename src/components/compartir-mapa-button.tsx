"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

// Link al mapa público con el id del comercial: los leads que entren por ahí se le asignan.
export function CompartirMapaButton(props: React.ComponentProps<typeof Button>) {
  const { data: session } = useSession();
  if (!session) return null;

  const compartir = async () => {
    const url = `${window.location.origin}/mapa?ref=${session.user.id}`;
    if (navigator.share) {
      // Cerrar el menú de compartir sin elegir nada tira AbortError: no es un error.
      await navigator.share({ title: "Barrio Stefani · Mapa de lotes", url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error(`No se pudo copiar. Tu link: ${url}`);
    }
  };

  return (
    <Button onClick={compartir} {...props}>
      <Share2 className="h-4 w-4 mr-2" />
      Compartir mapa
    </Button>
  );
}
