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

export function Features() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-5xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
              Infraestructura
            </span>
            <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-6">
              Un Barrio Pensado para Vivir
            </h2>
            <p className="text-gray-500 mb-8">
              Aire puro y tranquilidad con la calidad de vida que siempre soñaste
              en un entorno natural privilegiado.
            </p>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 rounded-full bg-green-100 p-0.5">
                    <Check className="h-4 w-4 text-green-700" />
                  </span>
                  <span className="text-gray-700 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-green-50 rounded-2xl p-8 border border-green-100">
            <div className="space-y-6">
              <div>
                <div className="text-4xl font-bold text-green-700">4.150 m²</div>
                <div className="text-gray-600 mt-1">Boulevard Central</div>
              </div>
              <div className="h-px bg-green-200" />
              <div>
                <div className="text-4xl font-bold text-green-700">120</div>
                <div className="text-gray-600 mt-1">Luminarias LED</div>
              </div>
              <div className="h-px bg-green-200" />
              <div>
                <div className="text-4xl font-bold text-green-700">14</div>
                <div className="text-gray-600 mt-1">Pases hidráulicos</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
