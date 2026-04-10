import Image from "next/image";
import { Check } from "lucide-react";

const features = [
  "Boulevard central de más de 4.000 m² para paseos y actividades",
  "Calles internas con iluminación LED de última generación (120 luminarias)",
  "Red eléctrica aérea de media tensión (EDENOR)",
  "Desagüe pluvial por zanjas con 14 pases hidráulicos",
  "Calles con sub-base compactada y terminación en piedra partida",
  "Sistema de efluentes mediante biodigestores individuales",
  "14.130 m² de calles internas con diseño urbano moderno",
  "Entrega proyectada para fines de 2026",
];

const metrics = [
  { value: "4.150 m²", label: "Boulevard Central" },
  { value: "120", label: "Luminarias LED" },
  { value: "14", label: "Pases hidráulicos" },
];

export function Features() {
  return (
    <section className="bg-[#F7F3ED] py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="font-body text-xs tracking-[0.25em] uppercase text-[#B8963E] font-medium">
              Infraestructura
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light text-[#1B3A2D] mt-3 leading-tight">
              Un Barrio Pensado<br />para Vivir
            </h2>
          </div>
          <p className="font-body text-[#1B3A2D]/55 max-w-sm text-sm leading-relaxed">
            Aire puro y tranquilidad con la calidad de vida que siempre soñaste
            en un entorno natural privilegiado.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Features list */}
          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-4 group">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#1B3A2D]/8 flex items-center justify-center group-hover:bg-[#B8963E]/15 transition-colors">
                  <Check className="h-3 w-3 text-[#1B3A2D]" />
                </span>
                <span className="font-body text-[#1B3A2D]/75 text-sm leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>

          {/* Right side: photo + metrics */}
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-sm overflow-hidden">
              <Image
                src="/foto_obra1.jpeg"
                alt="Obras de infraestructura"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1B3A2D]/40 to-transparent" />
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-3 gap-px bg-[#1B3A2D]/10 rounded-sm overflow-hidden">
              {metrics.map(({ value, label }) => (
                <div key={label} className="bg-[#F7F3ED] px-4 py-5 text-center">
                  <div className="font-display text-3xl font-light text-[#1B3A2D]">{value}</div>
                  <div className="font-body text-[10px] uppercase tracking-[0.15em] text-[#1B3A2D]/45 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
