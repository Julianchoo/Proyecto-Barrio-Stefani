import Link from "next/link";
import { Check } from "lucide-react";
import { CalculadoraCuota } from "@/components/calculadora-cuota";
import { MIN_ANTICIPO_PCT } from "@/lib/financiacion";

const puntos = [
  `Anticipo desde el ${MIN_ANTICIPO_PCT}% del precio de lista`,
  "Saldo en hasta 60 cuotas mensuales en pesos con ajuste por CAC",
  "Escritura del lote a tu nombre",
];

export function Financiacion({ precioDesde }: { precioDesde: number | null }) {
  return (
    <section id="financiacion" className="py-24 px-4 bg-muted/40">
      <div className="container mx-auto max-w-6xl grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
            Financiación
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light text-primary mt-3 leading-tight">
            Tu lote con anticipo<br />y cuotas
          </h2>
          <p className="font-body text-muted-foreground text-sm mt-4 leading-relaxed max-w-md">
            Mové el anticipo y el plazo para ver la cuota de referencia en USD o en pesos.
            Los contratos se pactan en pesos con ajuste por CAC.
          </p>
          <ul className="mt-8 space-y-3">
            {puntos.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                <span className="font-body text-sm text-primary/80">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {precioDesde ? (
          <div className="rounded-sm border bg-background p-6 shadow-xl space-y-4">
            <div>
              <p className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Simulador · lote desde
              </p>
              <p className="font-display text-3xl text-primary">
                USD {precioDesde.toLocaleString("es-AR")}
              </p>
            </div>
            <CalculadoraCuota precio={precioDesde} publico />
            <p className="font-body text-xs text-muted-foreground">
              Simulación orientativa con el lote disponible más económico. Las condiciones finales
              se confirman con un asesor.{" "}
              <Link href="/mapa" className="text-primary underline underline-offset-2">
                Simulá con un lote puntual en el mapa
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-sm border bg-background p-6 shadow-xl">
            <p className="font-body text-sm text-muted-foreground">
              Elegí un lote en el{" "}
              <Link href="/mapa" className="text-primary underline underline-offset-2">
                mapa
              </Link>{" "}
              para ver su precio y simular la cuota.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
