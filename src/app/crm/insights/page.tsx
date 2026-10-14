import { CargarTipoCambio } from "@/components/crm/cargar-tipo-cambio";
import { StatsCard } from "@/components/crm/stats-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBnaBilleteVendedor } from "@/lib/bna-exchange-rate";
import { getInsights, type Insights } from "@/lib/insights";
import { requireAdmin } from "@/lib/session";
import { argentinaTodayKey } from "@/lib/tipos-cambio";
import { tones } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const int = (v: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v);
const usd = (v: number) => `USD ${int(v)}`;
const usdCorto = (v: number) =>
  `USD ${new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
const pct = (v: number) =>
  new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(v);
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const mesCorto = (m: string) => MESES[Number(m.slice(5, 7)) - 1];
const mesLargo = (m: string) => `${MESES_LARGOS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// Todos los meses entre el primero y el último, para que un mes sin datos quede como hueco.
function mesesEntre(desde: string, hasta: string) {
  const out: string[] = [];
  let y = Number(desde.slice(0, 4));
  let m = Number(desde.slice(5, 7));
  const ey = Number(hasta.slice(0, 4));
  const em = Number(hasta.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

type Serie = { valor: number; color: string; nombre: string };

function BarrasMensuales({
  filas,
  etiquetaArriba,
  soloAnios = false,
}: {
  filas: { mes: string; series: Serie[]; detalle: string }[];
  etiquetaArriba?: (mes: string) => string | null;
  soloAnios?: boolean;
}) {
  const primera = filas[0];
  const ultima = filas[filas.length - 1];
  if (!primera || !ultima) return <p className="text-sm text-muted-foreground">Sin datos todavía.</p>;
  const porMes = new Map(filas.map((f) => [f.mes, f]));
  const meses = mesesEntre(primera.mes, ultima.mes);
  const max = Math.max(...filas.map((f) => f.series.reduce((s, x) => s + x.valor, 0)), 1);

  return (
    <div>
      <div className={cn("flex h-48 items-end border-b", soloAnios ? "gap-px" : "gap-2")}>
        {meses.map((mes, i) => {
          const fila = porMes.get(mes);
          const total = fila ? fila.series.reduce((s, x) => s + x.valor, 0) : 0;
          const arriba = fila && etiquetaArriba ? etiquetaArriba(mes) : null;
          const alto = (total / max) * 100;
          return (
            <div key={mes} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              {/* Tooltip propio: el title nativo del navegador tarda ~1 s en aparecer. */}
              <div
                className={cn(
                  "pointer-events-none absolute z-20 mb-6 hidden w-max max-w-56 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block",
                  i < meses.length / 2 ? "left-0" : "right-0"
                )}
                style={{ bottom: `${alto}%` }}
              >
                <p className="font-medium capitalize">{mesLargo(mes)}</p>
                <p className="whitespace-pre-line tabular-nums text-muted-foreground">{fila ? fila.detalle : "Sin datos"}</p>
              </div>
              {arriba && <span className="mb-1 text-xs tabular-nums text-foreground">{arriba}</span>}
              <div
                className={cn(
                  "flex w-full max-w-8 flex-col-reverse overflow-hidden transition-opacity group-hover:opacity-80",
                  soloAnios ? "rounded-t-sm" : "rounded-t-md"
                )}
                style={{ height: `${alto}%` }}
              >
                {fila?.series.map((s) => (
                  <div key={s.nombre} className={s.color} style={{ height: total > 0 ? `${(s.valor / total) * 100}%` : 0 }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn("mt-1 flex", soloAnios ? "gap-px" : "gap-2")}>
        {meses.map((mes) => (
          <span key={mes} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs text-muted-foreground">
            {soloAnios ? (mes.endsWith("-01") ? mes.slice(0, 4) : "") : mesCorto(mes)}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarrasHorizontales({
  filas,
}: {
  filas: { nombre: string; valor: number; etiqueta: string; nota: string; color?: string }[];
}) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <div className="space-y-3">
      {filas.map((f, i) => (
        <div key={f.nombre}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{f.nombre}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{f.nota}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1 rounded-full bg-muted">
              <div
                className={cn("h-3 rounded-full", f.color ?? (i === 0 ? "bg-primary" : "bg-muted-foreground/30"))}
                style={{ width: `${f.valor > 0 ? Math.max(1, (f.valor / max) * 100) : 0}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{f.etiqueta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.nombre} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", it.color)} />
          {it.nombre}
        </span>
      ))}
    </div>
  );
}

function Panel({ titulo, nota, children, className }: { titulo: string; nota: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-medium">{titulo}</CardTitle>
        <CardDescription>{nota}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type FacturacionTotal = Insights["facturacionTotal"];

function Linea({ nombre, nota, valor, fuerte = false }: { nombre: string; nota?: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", fuerte ? "text-sm font-medium text-foreground" : "pl-4 text-sm text-muted-foreground")}>
      <span>
        {nombre}
        {nota && <span className="ml-1.5 text-xs text-muted-foreground/70">{nota}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{usd(valor)}</span>
    </div>
  );
}

function ResumenFacturacion({ t }: { t: FacturacionTotal }) {
  const tramos = [
    { nombre: "Ya cobrado", valor: t.totalCobrado, color: "bg-primary" },
    { nombre: "Falta cobrar de ventas firmadas", valor: t.totalACobrar, color: "bg-primary/40" },
    { nombre: "Lotes por vender (precio de lista)", valor: t.valuacionRestantes, color: "bg-muted-foreground/25" },
  ];
  const total = t.total || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Facturación total del barrio</CardTitle>
        <CardDescription>Todo lo que ya entró, lo que falta cobrar de las ventas firmadas y lo que valen los lotes que quedan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{usd(t.total)}</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {tramos.map((x) => (
              <div key={x.nombre} className={x.color} style={{ width: `${(x.valor / total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {tramos.map((x) => (
              <span key={x.nombre} className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", x.color)} />
                {x.nombre} <span className="tabular-nums text-foreground">{usdCorto(x.valor)}</span> · {pct(x.valor / total)}
              </span>
            ))}
          </div>
        </div>

        <div className="divide-y">
          <div className="pb-2">
            <Linea nombre="Ya cobrado" valor={t.totalCobrado} fuerte />
            <Linea nombre="Ventas de contado" nota={`${int(t.ventasContado)} ventas, cobradas al firmar`} valor={t.cobrado.contado} />
            <Linea nombre="Anticipos" nota="cobrados al firmar" valor={t.cobrado.anticipos} />
            <Linea nombre="Cuotas cobradas" valor={t.cobrado.cuotas} />
          </div>
          <div className="py-2">
            <Linea nombre="Falta cobrar de ventas firmadas" valor={t.totalACobrar} fuerte />
            <Linea nombre="Cuotas pendientes" nota="vencidas y a vencer" valor={t.aCobrar.cuotas} />
            {t.aCobrar.sinCuenta > 0 && (
              <Linea nombre="Saldo de ventas sin cuenta corriente" nota={`${int(t.ventasSinCuenta)} ventas`} valor={t.aCobrar.sinCuenta} />
            )}
          </div>
          <div className="py-2">
            <Linea nombre="Total de ventas firmadas" valor={t.totalVendido} fuerte />
            <Linea nombre="Facturación vendida" nota="precio de los boletos" valor={t.facturacionVendida} />
            <Linea nombre="Ajuste CAC y dólar" nota="cuotas en pesos ajustadas por CAC, al dólar de hoy" valor={t.ajusteCacDolar} />
          </div>
          <div className="py-2">
            <Linea
              nombre="Lotes por vender"
              nota={`precio de lista de ${int(t.lotesRestantes - t.lotesSinPrecio)} lotes${t.lotesSinPrecio > 0 ? ` · ${int(t.lotesSinPrecio)} sin precio, no incluidos` : ""}`}
              valor={t.valuacionRestantes}
              fuerte
            />
          </div>
          <div className="pt-2">
            <div className="flex items-baseline justify-between gap-4 py-1.5 text-base font-semibold text-foreground">
              <span>Total a facturar</span>
              <span className="tabular-nums">{usd(t.total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PorPlazo({ filas, promedio }: { filas: Insights["ventas"]["porPlazo"]; promedio: number | null }) {
  const total = filas.reduce((s, r) => s + r.usd, 0) || 1;
  return (
    <div className="space-y-4">
      {promedio !== null && (
        <p className="text-sm text-muted-foreground">
          Plazo promedio, ponderado por monto:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(promedio)} cuotas
          </span>
        </p>
      )}
      <BarrasHorizontales
        filas={filas.map((r) => ({
          nombre: r.tramo,
          valor: r.usd,
          etiqueta: usdCorto(r.usd),
          nota: `${int(r.ventas)} ${r.ventas === 1 ? "venta" : "ventas"} · ${pct(r.usd / total)}`,
          color: "bg-primary",
        }))}
      />
    </div>
  );
}

function Rentabilidad({ r }: { r: Insights["rentabilidad"] }) {
  const facturacion = r.listaVendida + r.interesFinanciacion + r.diferenciaContado + r.precioSinLista;
  const totalVendido = facturacion + r.ajusteCacDolar;
  const costoEspera = r.cuotasACobrar - r.valorPresente;
  const listaFinanciada = r.listaVendida > 0 ? r.interesFinanciacion / r.listaVendida : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Precio de lista de lo vendido" value={usdCorto(r.listaVendida)} description="Lo que valían los lotes vendidos al contado" />
        <StatsCard title="Interés de financiación" value={usdCorto(r.interesFinanciacion)} description={`${pct(listaFinanciada)} sobre el precio de lista`} />
        <StatsCard title="Precio promedio por m²" value={usd(r.precioM2)} description="Precio de boleto sobre superficie vendida" />
        <StatsCard
          title="Valor hoy de las cuotas a cobrar"
          value={usdCorto(r.valorPresente)}
          description={`${usdCorto(r.cuotasACobrar)} nominales, descontadas al ${pct(r.tasaDescuento)} anual`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Del precio de lista a lo que vamos a cobrar</CardTitle>
            <CardDescription>Cuánto suma la financiación y el ajuste de las cuotas en pesos sobre el precio de los lotes vendidos.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="pb-2">
              <Linea nombre="Precio de lista de lotes vendidos" valor={r.listaVendida} fuerte />
              <Linea nombre="+ Interés de financiación" nota="cuotas por encima del precio de contado" valor={r.interesFinanciacion} />
              {r.diferenciaContado !== 0 && (
                <Linea nombre={r.diferenciaContado < 0 ? "− Descuentos en ventas de contado" : "+ Sobreprecio en ventas de contado"} valor={r.diferenciaContado} />
              )}
              {r.ventasSinLista > 0 && (
                <Linea nombre="+ Ventas de lotes sin precio de lista" nota={`${int(r.ventasSinLista)} ${r.ventasSinLista === 1 ? "venta" : "ventas"}`} valor={r.precioSinLista} />
              )}
            </div>
            <div className="py-2">
              <Linea nombre="= Facturación vendida" nota="precio de los boletos" valor={facturacion} fuerte />
              <Linea nombre="+ Ajuste CAC y dólar" nota="cuotas en pesos, al dólar de hoy" valor={r.ajusteCacDolar} />
            </div>
            <div className="pt-2">
              <Linea nombre="= Total de ventas firmadas" valor={totalVendido} fuerte />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">El costo de cobrar en cuotas</CardTitle>
            <CardDescription>
              Un dólar que entra en 2030 vale menos que uno de hoy. Descontando las cuotas pendientes al {pct(r.tasaDescuento)} anual en USD:
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="pb-2">
              <Linea nombre="Cuotas a cobrar, valor nominal" valor={r.cuotasACobrar} fuerte />
              <Linea nombre="− Costo de esperar" nota="lo que se pierde por cobrar más adelante" valor={-costoEspera} />
            </div>
            <div className="pt-2">
              <Linea nombre="= Valor hoy de las cuotas" valor={r.valorPresente} fuerte />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={cn("rounded-xl border p-4 text-sm", tones.neutral)}>
        <span className="font-medium text-foreground">Margen real:</span> para calcular la ganancia por lote y del proyecto falta cargar los
        costos (terreno, obras, comisiones, impuestos). Cuando estén cargados, esta pestaña muestra el margen y el punto de equilibrio.
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  await requireAdmin();
  const { ventas, cobranza, facturacionTotal, rentabilidad } = await getInsights();

  const ultimo = ventas.porMes[ventas.porMes.length - 1];
  const anterior = ventas.porMes[ventas.porMes.length - 2];
  const variacion = ultimo && anterior && anterior.usd > 0 ? ultimo.usd / anterior.usd - 1 : null;
  const totalCuotasPagadas = cobranza.puntualidad.reduce((s, r) => s + r.cuotas, 0) || 1;
  const lotes = (n: number) => `${int(n)} ${n === 1 ? "lote" : "lotes"}`;
  const proyectada = ventas.cobranzaProyectada;
  const hoy = argentinaTodayKey();
  const faltaTcHoy = cobranza.fechaTipoCambio !== hoy;
  const tcSugerido = faltaTcHoy ? (await getBnaBilleteVendedor()).sell : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-normal text-foreground">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comercialización, cobranza y rentabilidad del barrio, en USD</p>
      </div>

      {faltaTcHoy && (
        <CargarTipoCambio
          fecha={hoy}
          sugerido={tcSugerido}
          ultimo={
            cobranza.tipoCambio !== null && cobranza.fechaTipoCambio
              ? { valor: cobranza.tipoCambio, fecha: cobranza.fechaTipoCambio }
              : null
          }
        />
      )}

      <Tabs defaultValue="resumen" className="gap-6">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="comercializacion">Comercialización</TabsTrigger>
          <TabsTrigger value="cobranza">Cobranza</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          {ultimo && (
            <p className="text-sm text-muted-foreground">
              El último mes con firmas fue {mesLargo(ultimo.mes)}: se firmaron{" "}
              <span className="font-medium text-foreground">{lotes(ultimo.lotes)}</span> por{" "}
              <span className="font-medium text-foreground">{usd(ultimo.usd)}</span>
              {anterior && variacion !== null && (
                <>
                  {" "}({variacion >= 0 ? "+" : ""}{pct(variacion)} vs {mesLargo(anterior.mes).split(" ")[0]}, {usd(anterior.usd)})
                </>
              )}
              .
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard href="/crm/reservas?estado=realizada" title="Vendido" value={usdCorto(facturacionTotal.facturacionVendida)} description={`${int(ventas.lotesVendidos)} lotes, precio de los boletos`} />
            <StatsCard href="/crm/cuotas" title="Cobrado" value={usdCorto(facturacionTotal.totalCobrado)} description="Contado, anticipos y cuotas" />
            <StatsCard href="/crm/cuotas" title="A cobrar" value={usdCorto(facturacionTotal.totalACobrar)} description="De ventas ya firmadas" />
            <StatsCard href="/crm/cuotas?estado=vencidas" title="Vencido sin pagar" value={usd(cobranza.vencidoUsd)} description={`${int(cobranza.contratosConMora)} contratos con cuotas vencidas`} tone={cobranza.vencidoUsd > 0 ? "danger" : undefined} />
          </div>
          <ResumenFacturacion t={facturacionTotal} />
        </TabsContent>

        <TabsContent value="comercializacion" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatsCard href="/crm/reservas?estado=realizada" title="Facturación vendida" value={usdCorto(ventas.facturacionUsd)} description="Precio total de boletos firmados" />
            <StatsCard href="/crm/lotes?estado=vendido" title="Lotes vendidos" value={int(ventas.lotesVendidos)} description={`${pct(ventas.pctVendido)} del stock en venta`} />
            <StatsCard href="/crm/reservas?estado=realizada" title="Ticket promedio" value={usd(ventas.ticketPromedioUsd)} description="Por lote vendido" />
            <StatsCard href="/crm/reservas?estado=activa" title="Reservas activas" value={int(ventas.reservasActivas)} description={`${usdCorto(ventas.reservasActivasUsd)} por firmar`} />
            <StatsCard href="/crm/lotes?estado=disponible" title="Lotes disponibles" value={int(ventas.lotesDisponibles)} description={`de ${int(ventas.lotesEnVenta)} comercializables`} />
            <StatsCard
              href="/crm/lotes?estado=all"
              title="Valuación de lotes restantes"
              value={usdCorto(ventas.valuacionRestantesUsd)}
              description={`Precio de lista de ${int(ventas.lotesRestantes)} lotes sin vender`}
              note={ventas.lotesSinPrecio > 0 ? `${int(ventas.lotesSinPrecio)} ${ventas.lotesSinPrecio === 1 ? "lote" : "lotes"} sin precio` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Ventas por mes" nota="USD de boletos firmados, por mes de firma. Arriba de cada barra, los lotes.">
              <BarrasMensuales
                filas={ventas.porMes.map((r) => ({
                  mes: r.mes,
                  series: [{ nombre: "USD", valor: r.usd, color: "bg-primary" }],
                  detalle: `${usd(r.usd)} · ${lotes(r.lotes)}`,
                }))}
                etiquetaArriba={(mes) => {
                  const r = ventas.porMes.find((x) => x.mes === mes);
                  return r ? int(r.lotes) : null;
                }}
              />
            </Panel>
            <Panel titulo="Por plazo" nota="USD vendidos según la cantidad de cuotas del plan.">
              <PorPlazo filas={ventas.porPlazo} promedio={ventas.plazoPromedio} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Por corredor" nota="USD vendidos y lotes, desde el inicio.">
              <BarrasHorizontales
                filas={ventas.porCorredor.map((r) => ({ nombre: r.nombre, valor: r.usd, etiqueta: usdCorto(r.usd), nota: lotes(r.lotes) }))}
              />
            </Panel>
            <Panel titulo="Por forma de pago" nota="USD vendidos y lotes según contado o modalidad del plan.">
              <BarrasHorizontales
                filas={ventas.porModalidad.map((r) => ({ nombre: r.nombre, valor: r.usd, etiqueta: usdCorto(r.usd), nota: lotes(r.lotes) }))}
              />
            </Panel>
          </div>

          <Panel titulo="Detalle de ventas" nota="Cada boleto firmado, más reciente primero.">
            <div className="max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Venta</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Mz.</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">m²</TableHead>
                    <TableHead className="text-right">Precio USD</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Corredor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.detalle.map((r) => (
                    <TableRow key={r.venta}>
                      <TableCell className="text-muted-foreground">{r.venta}</TableCell>
                      <TableCell>{fecha(r.fechaFirma)}</TableCell>
                      <TableCell>{r.manzana ?? "—"}</TableCell>
                      <TableCell>{r.parcela ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(r.m2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{int(r.precioUsd)}</TableCell>
                      <TableCell>{r.plan}</TableCell>
                      <TableCell>{r.corredor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="cobranza" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Quedan <span className="font-medium text-foreground">{usd(cobranza.porCobrarUsd)}</span> por cobrar
            {cobranza.ultimaCuota && <>, con la última cuota en {mesLargo(cobranza.ultimaCuota)}</>}. Hoy hay{" "}
            <span className="font-medium text-foreground">{usd(cobranza.vencidoUsd)}</span> vencidos en{" "}
            <span className="font-medium text-foreground">{int(cobranza.cuotasVencidas)}</span> cuotas impagas.
          </p>

          <div className="border-b pb-2 pt-2">
            <h2 className="font-serif text-2xl font-normal text-foreground">Pasado</h2>
            <p className="text-sm text-muted-foreground">Lo que ya se cobró y cómo pagan los compradores.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatsCard href="/crm/cuotas" title="Cobrado a la fecha" value={usdCorto(ventas.cobradoUsd)} description={
                ventas.pagosSinTc > 0
                  ? `Sin incluir ${int(ventas.pagosSinTc)} ${ventas.pagosSinTc === 1 ? "pago" : "pagos"} en pesos sin tipo de cambio`
                  : "Pagos de cuotas registrados"
              } />
            <StatsCard
              href="/crm/cuotas"
              title="Cuotas pagadas"
              value={int(cobranza.cuotasPagadas)}
              description={`de ${int(cobranza.cuotasTotales)} (${pct(cobranza.cuotasTotales > 0 ? cobranza.cuotasPagadas / cobranza.cuotasTotales : 0)})`}
            />
            <StatsCard
              href="/crm/cuotas"
              title="Cuotas pagadas a término"
              value={cobranza.pctATiempo === null ? "—" : pct(cobranza.pctATiempo)}
              description={cobranza.diasAnticipoProm === null ? "Sin cuotas pagadas" : `En promedio ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(cobranza.diasAnticipoProm)} días antes del vencimiento`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              titulo="Cobranza por mes"
              nota="USD cobrados en cuotas (pagos no anulados), por mes de pago. La barra punteada es lo que vence el mes que viene y sigue impago."
            >
              <BarrasMensuales
                filas={[
                  ...ventas.cobranzaPorMes.map((r) => ({
                    mes: r.mes,
                    series: [{ nombre: "USD", valor: r.usd, color: "bg-primary" }],
                    detalle: `${usd(r.usd)} · ${int(r.pagos)} pagos`,
                  })),
                  ...(proyectada.usd > 0 && proyectada.mes > (ventas.cobranzaPorMes.at(-1)?.mes ?? "")
                    ? [
                        {
                          mes: proyectada.mes,
                          series: [
                            {
                              nombre: "Proyectado",
                              valor: proyectada.usd,
                              color: "rounded-t-md border-2 border-dashed border-primary/50 bg-primary/10",
                            },
                          ],
                          detalle: `Proyección: ${usd(proyectada.usd)}
${int(proyectada.cuotas)} cuotas a vencer, impagas`,
                        },
                      ]
                    : []),
                ]}
                etiquetaArriba={(mes) => {
                  if (mes === proyectada.mes) return `~${usdCorto(proyectada.usd).replace("USD ", "")}`;
                  const r = ventas.cobranzaPorMes.find((x) => x.mes === mes);
                  return r ? usdCorto(r.usd).replace("USD ", "") : null;
                }}
              />
            </Panel>
            <Panel titulo="Tiempos de pago" nota="Cuándo se pagó cada cuota respecto de su vencimiento.">
              <BarrasHorizontales
                filas={cobranza.puntualidad.map((r) => ({
                  nombre: r.tramo,
                  valor: r.cuotas,
                  etiqueta: `${int(r.cuotas)} cuotas`,
                  nota: pct(r.cuotas / totalCuotasPagadas),
                  color: r.tarde ? "bg-destructive" : "bg-primary",
                }))}
              />
            </Panel>
          </div>

          <div className="border-b pb-2 pt-2">
            <h2 className="font-serif text-2xl font-normal text-foreground">Presente</h2>
            <p className="text-sm text-muted-foreground">Deuda vencida y lo que vence en los próximos días.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatsCard href="/crm/cuotas?estado=vencidas" title="Vencido sin pagar" value={usd(cobranza.vencidoUsd)} description={`${int(cobranza.contratosConMora)} contratos con cuotas vencidas`} tone={cobranza.vencidoUsd > 0 ? "danger" : undefined} />
            <StatsCard href="/crm/cuotas" title="Próximos 30 días" value={usdCorto(cobranza.proximos30dUsd)} description="Vencen en los próximos 30 días" />
          </div>

          <Panel titulo="Estado de las cuotas" nota="Cantidad de cuotas de todos los planes y saldo en USD de cada grupo.">
              <BarrasHorizontales
                filas={cobranza.estadoCuotas.map((r) => ({
                  nombre: r.estado,
                  valor: r.cuotas,
                  etiqueta: `${int(r.cuotas)} cuotas`,
                  nota: r.saldoUsd > 0 ? `${usdCorto(r.saldoUsd)} de saldo` : "sin saldo",
                  color: r.estado === "Vencidas" ? "bg-destructive" : r.estado === "Pagadas" ? "bg-muted-foreground/30" : "bg-primary",
                }))}
              />
          </Panel>

          <Panel titulo="Cuotas vencidas sin pagar" nota="Cada cuota con vencimiento pasado y saldo pendiente, la más atrasada primero.">
            {cobranza.vencidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cuotas vencidas sin pagar.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Mz.</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead className="text-right">N° cuota</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Días de atraso</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Saldo USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobranza.vencidas.map((r) => (
                      <TableRow key={r.cuota}>
                        <TableCell className="text-muted-foreground">{r.contrato}</TableCell>
                        <TableCell>{r.manzana ?? "—"}</TableCell>
                        <TableCell>{r.parcela ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.numero}</TableCell>
                        <TableCell>{fecha(r.vencimiento)}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{int(r.diasAtraso)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.moneda} {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(r.saldo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{int(r.saldoUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel titulo="Estado por contrato" nota="Avance de cada plan de pagos. Primero los que tienen deuda vencida.">
            <div className="max-h-[32rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Mz.</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead className="text-right">Pagadas</TableHead>
                    <TableHead className="text-right">Vencidas</TableHead>
                    <TableHead className="text-right">Vencido USD</TableHead>
                    <TableHead className="text-right">Saldo USD</TableHead>
                    <TableHead>Próximo venc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobranza.contratosEstado.map((r) => (
                    <TableRow key={r.contrato}>
                      <TableCell className="text-muted-foreground">{r.contrato}</TableCell>
                      <TableCell>{r.manzana ?? "—"}</TableCell>
                      <TableCell>{r.parcela ?? "—"}</TableCell>
                      <TableCell>{r.modalidad}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {int(r.pagadas)} / {int(r.cuotas)}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.vencidas > 0 && "text-destructive")}>{int(r.vencidas)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.vencidoUsd > 0 && "text-destructive")}>{int(r.vencidoUsd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{int(r.saldoUsd)}</TableCell>
                      <TableCell>{fecha(r.proximoVenc)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <div className="border-b pb-2 pt-2">
            <h2 className="font-serif text-2xl font-normal text-foreground">Futuro</h2>
            <p className="text-sm text-muted-foreground">Lo que falta cobrar, mes a mes, hasta la última cuota.</p>
          </div>
          <Panel
            titulo="Cronograma de cobros"
            nota="USD a cobrar por mes de vencimiento, cuotas todavía no vencidas. Las cuotas en pesos ajustan por CAC: su monto futuro es una proyección, pasada a USD con el último dólar cargado."
          >
            <Leyenda items={[{ nombre: "En USD", color: "bg-primary" }, { nombre: "En pesos (proyectado)", color: "bg-muted-foreground/30" }]} />
            <BarrasMensuales
              soloAnios
              filas={cobranza.porMes.map((r) => ({
                mes: r.mes,
                series: [
                  { nombre: "En USD", valor: r.enUsd, color: "bg-primary" },
                  { nombre: "En pesos", valor: r.enPesos, color: "bg-muted-foreground/30" },
                ],
                detalle: `En USD: ${usd(r.enUsd)}\nEn pesos: ${usd(r.enPesos)}\nTotal: ${usd(r.enUsd + r.enPesos)} · ${int(r.cuotas)} cuotas`,
              }))}
            />
          </Panel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatsCard href="/crm/cuotas" title="Saldo por cobrar" value={usdCorto(cobranza.porCobrarUsd)} description={`Cuotas impagas de ${int(cobranza.contratos)} contratos`} />
            <StatsCard
              title="Dólar usado"
              value={cobranza.tipoCambio === null ? "—" : `$ ${int(cobranza.tipoCambio)}`}
              description={`BNA vendedor del ${fecha(cobranza.fechaTipoCambio)}, para pasar cuotas en pesos a USD`}
            />
          </div>
        </TabsContent>

        <TabsContent value="rentabilidad" className="space-y-6">
          <Rentabilidad r={rentabilidad} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
