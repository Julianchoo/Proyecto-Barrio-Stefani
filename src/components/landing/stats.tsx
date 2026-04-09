const stats = [
  { value: "10 ha", label: "Superficie total" },
  { value: "~360", label: "Lotes disponibles" },
  { value: "250–399 m²", label: "Tamaños de lote" },
  { value: "60 cuotas", label: "Financiación máxima" },
];

export function Stats() {
  return (
    <section className="bg-green-700 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center text-white">
              <div className="text-3xl font-bold mb-1">{value}</div>
              <div className="text-sm text-green-200">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
