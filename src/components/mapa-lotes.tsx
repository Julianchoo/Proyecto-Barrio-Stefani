"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Loader2 } from "lucide-react";
import { CalculadoraCuota, type Simulacion } from "@/components/calculadora-cuota";
import { ContactForm } from "@/components/landing/contact-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsd } from "@/lib/financiacion";
import { soloDisponibilidad, type LoteMapa } from "@/lib/lotes-mapa";
import type { EstadoParcela } from "@/lib/schema";
import { cn } from "@/lib/utils";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { GeoJSON as GeoJSONLayer, LatLngBounds, Map as LeafletMap, Path } from "leaflet";

type ArbaProps = { cca: string; pda: string };
type ArbaCollection = FeatureCollection<MultiPolygon, ArbaProps>;

// Colores del plano sobre la foto satelital (Leaflet necesita valores CSS concretos).
const ESTADO_STYLE: Record<EstadoParcela, { color: string; label: string; dot: string }> = {
  disponible: { color: "#22c55e", label: "Disponible", dot: "bg-green-500" },
  reservado: { color: "#f59e0b", label: "Reservado", dot: "bg-amber-500" },
  vendido: { color: "#ef4444", label: "Vendido", dot: "bg-red-500" },
  no_disponible: { color: "#94a3b8", label: "No disponible", dot: "bg-slate-400" },
};

const ESTADOS = Object.keys(ESTADO_STYLE) as EstadoParcela[];

// Rotan mientras se espera el plano (el catastro de ARBA puede tardar unos segundos).
const MENSAJES_CARGA = [
  "Consultando el catastro de ARBA…",
  "Clavando las estacas…",
  "Midiendo frentes y fondos…",
  "Revisando qué lotes siguen disponibles…",
  "Ubicando cada lote sobre la foto satelital…",
];
// El público solo ve si el lote está a la venta o no.
const ESTADOS_PUBLICOS: EstadoParcela[] = ["disponible", "no_disponible"];

// "156", "2A" -> "156-2A". Normaliza ceros y mayúsculas para comparar con ARBA.
function nomenclatura(manzana: string, parcela: string) {
  const p = parcela.trim().toUpperCase().replace(/\s+/g, "");
  const match = p.match(/^0*(\d+)([A-Z]*)$/);
  return `${Number(manzana)}-${match ? `${match[1]}${match[2]}` : p}`;
}

// cca de ARBA: "074050F" + manzana (25 dígitos) + "000" + parcela (4 dígitos) + letra (3, con ceros).
function nomenclaturaDeCca(cca: string) {
  const manzana = cca.slice(7, 32);
  const parcela = Number(cca.slice(35, 39));
  const letra = cca.slice(39).replace(/^0+/, "");
  return nomenclatura(manzana, `${parcela}${letra}`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const num = (value: string | null) => (value ? Number(value).toLocaleString("es-AR") : null);

// Filas de datos del lote: las usa el popup y el panel público.
function datosLote(lote: LoteMapa): [string, string][] {
  const medidas =
    lote.metrosFrente && lote.metrosFondo ? `${num(lote.metrosFrente)} × ${num(lote.metrosFondo)} m` : null;
  return [
    ["Estado", ESTADO_STYLE[lote.estado].label],
    ["Superficie", lote.superficieM2 ? `${num(lote.superficieM2)} m²` : null],
    ["Medidas", medidas],
    // Solo el precio de lista y solo si está disponible (lo resuelve /api/mapa).
    ["Precio de lista", lote.precio ? formatUsd(lote.precio) : null],
    ["Nomenclatura", `Circ. V · Secc. F · Mz ${lote.manzana ?? ""} · Parc. ${lote.parcela ?? ""}`],
    ["Partida ARBA", lote.partidaArba],
  ].filter((row): row is [string, string] => !!row[1]);
}

function popupHtml(lote: LoteMapa, publico: boolean) {
  const rows = datosLote(lote);

  return `
    <div style="min-width:200px">
      <strong>Manzana ${escapeHtml(lote.manzana ?? "")} · Lote ${escapeHtml(lote.parcela ?? "")}</strong>
      <table style="margin-top:6px">
        ${rows
          .map(([k, v]) => `<tr><td style="padding-right:8px;opacity:.7">${k}</td><td>${escapeHtml(v)}</td></tr>`)
          .join("")}
      </table>
      ${publico ? "" : `<a href="/crm/lotes/${lote.id}" style="display:inline-block;margin-top:6px">Ver lote →</a>`}
    </div>`;
}

/** Plano de lotes. `publico`: sin links al CRM y con panel de datos + calculadora. */
export function MapaLotes({ publico = false }: { publico?: boolean }) {
  const mapRef = useRef<LeafletMap | null>(null);
  const lotesLayerRef = useRef<GeoJSONLayer | null>(null);
  const limpiarRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geometria, setGeometria] = useState<ArbaCollection | null>(null);
  const [lotes, setLotes] = useState<LoteMapa[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<LoteMapa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<Set<EstadoParcela>>(new Set(ESTADOS));
  const [opacidad, setOpacidad] = useState(0.55);
  const [mapaListo, setMapaListo] = useState(false);

  useEffect(() => {
    fetch("/api/mapa")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "No se pudo cargar el plano");
        return data as { geometria: ArbaCollection; lotes: LoteMapa[] };
      })
      .then((data) => {
        setGeometria(data.geometria);
        setLotes(publico ? data.lotes.map(soloDisponibilidad) : data.lotes);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Cruza cada parcela de ARBA con un lote del sistema: primero por partida
  // ("074" de Moreno + partida ARBA), y si no, por manzana y parcela del código catastral.
  const lotePorCca = useMemo(() => {
    const map = new Map<string, LoteMapa>();
    if (!geometria || !lotes) return map;

    const porPartida = new Map<string, LoteMapa>();
    const porNomenclatura = new Map<string, LoteMapa>();
    for (const lote of lotes) {
      // ARBA guarda la partida con 6 dígitos: 95595 -> "074095595".
      const partida = lote.partidaArba?.replace(/\D/g, "");
      if (partida) porPartida.set(`074${partida.padStart(6, "0")}`, lote);
      if (lote.manzana && lote.parcela) {
        porNomenclatura.set(nomenclatura(lote.manzana, lote.parcela), lote);
      }
    }

    const usados = new Set<number>();
    const asignar = (cca: string, lote: LoteMapa | undefined) => {
      if (!lote || usados.has(lote.id) || map.has(cca)) return;
      map.set(cca, lote);
      usados.add(lote.id);
    };
    for (const f of geometria.features) asignar(f.properties.cca, porPartida.get(f.properties.pda));
    for (const f of geometria.features) asignar(f.properties.cca, porNomenclatura.get(nomenclaturaDeCca(f.properties.cca)));
    return map;
  }, [geometria, lotes]);

  const conteo = useMemo(() => {
    const counts = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoParcela, number>;
    for (const lote of lotes ?? []) counts[lote.estado]++;
    return counts;
  }, [lotes]);

  const sinGeometria = lotes && geometria ? lotes.length - lotePorCca.size : 0;

  // Crea el mapa apenas se monta, sin esperar los datos: la foto satelital aparece
  // primero y los lotes se dibujan encima cuando llegan (Leaflet solo corre en el navegador).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true, maxZoom: 21 });
      const satelite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxNativeZoom: 19, maxZoom: 21, attribution: "Imágenes © Esri, Maxar" }
      ).addTo(map);
      const calles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution: "© OpenStreetMap",
      });
      L.control.layers({ "Foto satelital": satelite, Calles: calles }).addTo(map);
      map.setView([-34.5504, -58.8176], 17);
      mapRef.current = map;
      setMapaListo(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Cuando llega el plano, encuadra los lotes.
  useEffect(() => {
    if (!mapaListo || !geometria) return;
    import("leaflet").then((L) => {
      const bounds = L.geoJSON(geometria).getBounds();
      if (bounds.isValid()) mapRef.current?.fitBounds(bounds, { padding: [20, 20] });
    });
  }, [mapaListo, geometria]);

  const cargando = !lotes && !error;
  const [mensaje, setMensaje] = useState(0);
  useEffect(() => {
    if (!cargando) return;
    const id = window.setInterval(() => setMensaje((i) => (i + 1) % MENSAJES_CARGA.length), 1800);
    return () => window.clearInterval(id);
  }, [cargando]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  // Dibuja (o redibuja) los lotes según filtros y opacidad.
  useEffect(() => {
    if (!mapaListo || !geometria || !lotes) return;

    let cancelled = false;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      limpiarRef.current?.();

      const features = geometria.features.filter((f: Feature<MultiPolygon, ArbaProps>) => {
        const lote = lotePorCca.get(f.properties.cca);
        // Parcelas de ARBA que no están en el sistema se dibujan solo con borde.
        return lote ? visibles.has(lote.estado) : true;
      });

      const etiquetas = L.layerGroup();
      // Un solo lote resaltado por hover y uno por popup abierto. Si el navegador se
      // pierde un mouseout (mouse rápido), el próximo mouseover limpia el anterior.
      type LotePath = Path & { getBounds(): LatLngBounds };
      let enHover: LotePath | null = null;
      let abierto: LotePath | null = null;
      const resaltar = (p: LotePath) =>
        p.setStyle({ color: "#facc15", weight: 4, fillOpacity: Math.min(1, opacidad + 0.25) });
      const restaurar = (p: LotePath) => {
        if (p !== abierto) capa.resetStyle(p);
        p.closeTooltip();
      };
      const capa = L.geoJSON(
        { type: "FeatureCollection", features } as ArbaCollection,
        {
          style: (f) => {
            const lote = f && lotePorCca.get((f.properties as ArbaProps).cca);
            if (!lote) return { color: "#ffffff", weight: 1, dashArray: "3", fillOpacity: 0 };
            return { color: "#ffffff", weight: 1.5, fillColor: ESTADO_STYLE[lote.estado].color, fillOpacity: opacidad };
          },
          onEachFeature: (f, layer) => {
            const lote = lotePorCca.get((f.properties as ArbaProps).cca);
            if (!lote) {
              if (!publico) layer.bindTooltip("Parcela de ARBA que no está en el sistema", { sticky: true });
              return;
            }
            const path = layer as LotePath;
            layer.bindTooltip(`Mz ${lote.manzana} · Lote ${lote.parcela}`, { sticky: true });
            layer.bindPopup(popupHtml(lote, publico));
            layer.on("click", () => setSeleccionado(lote));

            // Resalta el contorno real del lote al pasar el mouse y mientras está abierto.
            // Sin bringToFront en el hover: mover el SVG bajo el cursor hace que el
            // navegador no dispare el mouseout y el lote (y su tooltip) quedan marcados.
            layer.on("mouseover", () => {
              if (enHover && enHover !== path) restaurar(enHover);
              enHover = path;
              resaltar(path);
            });
            layer.on("mouseout", () => {
              if (enHover === path) enHover = null;
              restaurar(path);
            });
            layer.on("popupopen", () => {
              abierto = path;
              resaltar(path);
              path.bringToFront();
            });
            layer.on("popupclose", () => {
              if (abierto === path) abierto = null;
              if (enHover !== path) restaurar(path);
            });

            etiquetas.addLayer(
              L.marker(path.getBounds().getCenter(), {
                interactive: false,
                icon: L.divIcon({
                  className: "",
                  html: `<span style="font:600 11px/1 system-ui;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000">${escapeHtml(lote.parcela ?? "")}</span>`,
                  iconSize: [24, 12],
                  iconAnchor: [12, 6],
                }),
              })
            );
          },
        }
      ).addTo(map);

      // Los números de lote solo se ven de cerca, para no tapar el plano.
      const actualizarEtiquetas = () => {
        if (map.getZoom() >= 19) etiquetas.addTo(map);
        else etiquetas.remove();
      };
      actualizarEtiquetas();
      map.on("zoomend", actualizarEtiquetas);

      lotesLayerRef.current?.remove();
      lotesLayerRef.current = capa;
      limpiarRef.current = () => {
        map.off("zoomend", actualizarEtiquetas);
        etiquetas.remove();
      };
    });

    return () => {
      cancelled = true;
    };
  }, [mapaListo, geometria, lotes, lotePorCca, visibles, opacidad, publico]);

  const toggle = (estado: EstadoParcela) =>
    setVisibles((prev) => {
      const next = new Set(prev);
      if (next.has(estado)) next.delete(estado);
      else next.add(estado);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Plano catastral de ARBA sobre foto satelital. Tocá un lote para ver sus datos.
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Opacidad del plano
          <input
            id="opacidad-plano"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacidad}
            onChange={(e) => setOpacidad(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(publico ? ESTADOS_PUBLICOS : ESTADOS).map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => toggle(estado)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-opacity",
              !visibles.has(estado) && "opacity-40"
            )}
          >
            <span className={cn("h-3 w-3 rounded-full", ESTADO_STYLE[estado].dot)} />
            {ESTADO_STYLE[estado].label}
            <span className="tabular-nums text-muted-foreground">{lotes ? conteo[estado] : "–"}</span>
          </button>
        ))}
        {!publico && sinGeometria > 0 && (
          <span className="self-center text-xs text-muted-foreground">
            {sinGeometria} lotes del sistema no se encontraron en ARBA.
          </span>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">{error}</p>
      ) : (
        <div className={cn(publico && "grid gap-4 lg:grid-cols-[1fr_400px]")}>
          <div
            className={cn(
              "relative isolate overflow-hidden rounded-lg border",
              publico ? "h-[65vh] min-h-[380px]" : "h-[calc(100vh-14rem)] min-h-[420px]"
            )}
          >
            {!mapaListo && <Skeleton className="absolute inset-0" />}
            <div ref={containerRef} className="h-full w-full [&_.leaflet-interactive:focus]:outline-none" />
            {cargando && (
              <div
                role="status"
                className="pointer-events-none absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border bg-background/90 px-4 py-2 text-sm text-foreground shadow-md backdrop-blur"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {MENSAJES_CARGA[mensaje]}
              </div>
            )}
          </div>
          {publico &&
            (seleccionado ? (
              <PanelLote key={seleccionado.id} lote={seleccionado} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tocá un lote en el plano para ver sus datos catastrales, el precio y simular la cuota.
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function PanelLote({ lote }: { lote: LoteMapa }) {
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null);
  const nombre = `Manzana ${lote.manzana} · Lote ${lote.parcela}`;
  const sim = lote.precio ? simulacion : null;
  const resumen = sim
    ? `${nombre} · Anticipo ${formatUsd(sim.anticipo)} + ${sim.plazo} cuotas de ${formatUsd(sim.cuotaMensual)}`
    : nombre;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Lote seleccionado</p>
        <h3 className="text-lg font-semibold text-foreground">
          {nombre}
        </h3>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {datosLote(lote).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {lote.precio ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-semibold text-foreground">Simulá tu cuota</p>
          <CalculadoraCuota precio={lote.precio} publico onSimulacion={setSimulacion} />
          <p className="text-xs text-muted-foreground">
            Las condiciones finales se confirman con un asesor.
          </p>
        </div>
      ) : (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          {lote.estado === "disponible"
            ? "Consultanos el precio de este lote."
            : "Este lote no está disponible. Elegí otro en verde o consultanos."}
        </p>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="block w-full rounded-sm bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Consultar por este lote
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Consultar por este lote</DialogTitle>
            <DialogDescription>
              Dejanos tus datos y un asesor te contacta con este lote y esta simulación.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            consulta={{
              parcelaId: lote.id,
              resumen,
              anticipo: sim?.anticipo,
              plazo: sim?.plazo,
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
