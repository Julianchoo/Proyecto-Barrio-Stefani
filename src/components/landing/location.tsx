import { MapPin, School, ShoppingBag, Bus, Home } from "lucide-react";

const amenities = [
  { icon: School, text: "Escuelas y colegios en la zona" },
  { icon: ShoppingBag, text: "Cercanía a centros comerciales y servicios" },
  { icon: Bus, text: "Transporte público disponible" },
  { icon: Home, text: "Zona residencial consolidada y segura" },
];

export function Location() {
  return (
    <section className="py-20 px-4 bg-gray-50">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
            Dónde estamos
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-3">
            Ubicación Estratégica
          </h2>
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <MapPin className="h-4 w-4 text-green-700" />
            <span>Cuartel V, Moreno — Frente a Cerámica Juan Stefani</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl overflow-hidden border shadow-sm h-96">
            <iframe
              src="https://maps.google.com/maps?q=-34.550367,-58.817616&z=16&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Barrio Stefani"
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Accesos y Conectividad
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Sobre la Ruta Provincial 24, con excelente acceso a rutas
              principales y a minutos del centro de Moreno.
            </p>
            <ul className="space-y-4">
              {amenities.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
                    <Icon className="h-4 w-4 text-green-700" />
                  </div>
                  <span className="text-gray-700 text-sm">{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-gray-500 italic">
              Un lugar ideal para construir tu futuro, con toda la
              infraestructura necesaria y en constante crecimiento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
