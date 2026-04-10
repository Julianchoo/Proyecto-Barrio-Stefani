const stats = [
  { value: "10", unit: "ha", label: "Superficie total" },
  { value: "360+", unit: "", label: "Lotes disponibles" },
  { value: "250–399", unit: "m²", label: "Tamaños de lote" },
  { value: "60", unit: " cuotas", label: "Financiación máxima" },
];

export function Stats() {
  return (
    <section id="proyecto" className="bg-[#1B3A2D] py-16 px-4 relative overflow-hidden">
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, #F7F3ED 40px, #F7F3ED 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #F7F3ED 40px, #F7F3ED 41px)"
      }} />
      <div className="relative container mx-auto max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#F7F3ED]/10">
          {stats.map(({ value, unit, label }) => (
            <div key={label} className="text-center px-6 py-4 first:pl-0 last:pr-0">
              <div className="font-display text-5xl md:text-6xl font-light text-[#F7F3ED] leading-none mb-1">
                {value}
                <span className="text-[#B8963E] text-3xl md:text-4xl">{unit}</span>
              </div>
              <div className="font-body text-xs tracking-[0.15em] uppercase text-[#F7F3ED]/40 mt-3">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
