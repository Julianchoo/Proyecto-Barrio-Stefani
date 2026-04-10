import { MapPin, School, ShoppingBag, Bus, Factory, Plane, Warehouse } from "lucide-react";

const amenities = [
  {
    icon: Factory,
    title: "Centro Industrial de Moreno",
    text: "Pegados al PIM 1 y PIM 2 y varios parques industriales de la zona",
  },
  {
    icon: Plane,
    title: "Aeródromo Cuartel V (UPA)",
    text: "Aeropuerto con uso comercial y militar, y un gran centro logístico",
  },
  {
    icon: Warehouse,
    title: "Hub logístico regional",
    text: "Zona de alto crecimiento con infraestructura logística e industrial consolidada",
  },
  {
    icon: School,
    title: "Educación y servicios",
    text: "Escuelas, centros de salud y servicios esenciales en la zona",
  },
  {
    icon: ShoppingBag,
    title: "Comercios y conectividad",
    text: "Centros comerciales, transporte público y acceso directo a rutas principales",
  },
  {
    icon: Bus,
    title: "Acceso rápido a Moreno",
    text: "Sobre la Ruta Provincial 24, a minutos del centro de Moreno",
  },
];

export function Location() {
  return (
    <section className="py-24 px-4 bg-[#F7F3ED]">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="font-body text-xs tracking-[0.25em] uppercase text-[#B8963E] font-medium">
              Dónde estamos
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light text-[#1B3A2D] mt-3 leading-tight">
              Ubicación<br />Estratégica
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[#1B3A2D]/50">
            <MapPin className="h-4 w-4 text-[#B8963E] flex-shrink-0" />
            <span className="font-body text-sm">Cuartel V, Moreno — Frente a Cerámica Juan Stefani</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Map */}
          <div className="rounded-sm overflow-hidden border border-[#1B3A2D]/10 shadow-md h-[420px]">
            <iframe
              src="https://maps.google.com/maps?q=-34.550367,-58.817616&z=15&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Barrio Stefani"
            />
          </div>

          {/* Amenities */}
          <div className="space-y-4">
            {amenities.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4 group">
                <div className="flex-shrink-0 p-2.5 rounded-sm bg-[#1B3A2D]/6 group-hover:bg-[#B8963E]/12 transition-colors">
                  <Icon className="h-4 w-4 text-[#1B3A2D]" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-[#1B3A2D]">{title}</p>
                  <p className="font-body text-xs text-[#1B3A2D]/55 mt-0.5 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
