const stats = [
  { value: "10", unit: "ha", label: "Superficie total" },
  { value: "360+", unit: "", label: "Lotes disponibles" },
  { value: "210 a 399", unit: "m²", label: "Tamaños de lote" },
  { value: "60", unit: " cuotas", label: "Financiación máxima" },
];

export function Stats() {
  return (
    <section id="proyecto" className="py-16 px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1008 0%, #3d1a10 40%, #7a2018 100%)" }}>
      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />
      {/* Warm vignette */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)" }} />
      <div className="relative container mx-auto max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-primary-foreground/10">
          {stats.map(({ value, unit, label }) => (
            <div key={label} className="text-center px-6 py-4 first:pl-0 last:pr-0">
              <div className="font-display text-[2rem] sm:text-5xl md:text-6xl font-light text-primary-foreground leading-none mb-1">
                {value}
                <span className="text-accent text-xl sm:text-3xl md:text-4xl">{unit}</span>
              </div>
              <div className="font-body text-xs tracking-[0.15em] uppercase text-primary-foreground/40 mt-3">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
