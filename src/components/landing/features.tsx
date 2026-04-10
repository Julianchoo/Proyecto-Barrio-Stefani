import Image from "next/image";
import { Check } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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

const galleryImages = [
  {
    id: "foto_obra3",
    src: "/foto_obra3.jpeg",
    label: "Calles y pluviales",
    description: "Movimiento de suelo y compactación avanzada",
    tag: "Obra",
  },
  {
    id: "foto_obra6",
    src: "/foto_obra6.jpeg",
    label: "Infraestructura eléctrica",
    description: "Montaje de luminarias y tendido de cables",
    tag: "Obra",
  },
  {
    id: "foto_aerea5",
    src: "/foto_aerea5.jpeg",
    label: "Vista aérea norte",
    description: "Boulevard central y lotes perimetrales",
    tag: "Aérea",
  },
  {
    id: "foto_aerea6",
    src: "/foto_aerea6.jpeg",
    label: "Vista aérea oeste",
    description: "Parcelas abiertas y accesos principales",
    tag: "Aérea",
  },
  {
    id: "foto_aerea7",
    src: "/foto_aerea7.jpeg",
    label: "Vista aérea sur",
    description: "Entorno verde y tramas de calles",
    tag: "Aérea",
  },
  {
    id: "foto_obra2",
    src: "/foto_obra2.jpeg",
    label: "Detalles constructivos",
    description: "Terminaciones y control de calidad in situ",
    tag: "Obra",
  },
] as const;

export function Features() {
  return (
    <section className="bg-background py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
              Infraestructura
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light text-primary mt-3 leading-tight">
              Un Barrio Pensado<br />para Vivir
            </h2>
          </div>
          <p className="font-body text-muted-foreground max-w-sm text-sm leading-relaxed">
            Aire puro y tranquilidad con la calidad de vida que siempre soñaste
            en un entorno natural privilegiado.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Features list */}
          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-4 group">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/8 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                <span className="font-body text-primary/75 text-sm leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>

          {/* Right side: gallery + metrics */}
          <div className="space-y-6">
            <Carousel className="w-full" opts={{ loop: true }}>
              <CarouselContent>
                {galleryImages.map((image, index) => (
                  <CarouselItem key={image.id}>
                    <div className="relative aspect-[4/3] rounded-sm overflow-hidden border border-border shadow-xl">
                      <Image
                        src={image.src}
                        alt={image.label}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority={index === 0}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white" />
              <CarouselNext className="right-2 bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white" />
            </Carousel>

            {/* Metrics strip */}
            <div className="grid grid-cols-1 gap-px bg-primary/10 rounded-sm overflow-hidden sm:grid-cols-3">
              {metrics.map(({ value, label }) => (
                <div key={label} className="bg-background px-4 py-5 text-center">
                  <div className="font-display text-3xl font-light text-primary">{value}</div>
                  <div className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
