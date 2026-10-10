"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Skeleton } from "@/components/ui/skeleton";
import type { EstadoParcela, ParcelaConReserva } from "@/lib/schema";
import { cn } from "@/lib/utils";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import type { GeoJSON as GeoJSONLayer, Map as LeafletMap } from "leaflet";

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

// Igual que en /crm/lotes: una reserva realizada cuenta como vendido.
const estadoDe = (lote: ParcelaConReserva): EstadoParcela =>
  lote.reservaEstado === "realizada" ? "vendido" : lote.estado;

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

function popupHtml(lote: ParcelaConReserva) {
  const estado = estadoDe(lote);
  const num = (value: string | null) => (value ? Number(value).toLocaleString("es-AR") : null);
  const medidas =
    lote.metrosFrente && lote.metrosFondo ? `${num(lote.metrosFrente)} × ${num(lote.metrosFondo)} m` : null;
  // Solo el precio de lista (precio base); sin él, el lote no muestra precio.
  const precioLista = lote.precioBase;
  const rows = [
    ["Estado", ESTADO_STYLE[estado].label],
    ["Superficie", lote.superficieM2 ? `${num(lote.superficieM2)} m²` : null],
    ["Medidas", medidas],
    ["Precio", estado === "disponible" && precioLista ? `USD ${num(precioLista)}` : null],
    ["Nomenclatura", `Circ. V · Secc. F · Mz ${lote.manzana ?? ""} · Parc. ${lote.parcela ?? ""}`],
    ["Partida ARBA", lote.partidaArba],
  ].filter((row): row is [string, string] => !!row[1]);

  return `
    <div style="min-width:200px">
      <strong>Manzana ${escapeHtml(lote.manzana ?? "")} · Lote ${escapeHtml(lote.parcela ?? "")}</strong>
      <table style="margin-top:6px">
        ${rows
          .map(([k, v]) => `<tr><td style="padding-right:8px;opacity:.7">${k}</td><td>${escapeHtml(v)}</td></tr>`)
          .join("")}
      </table>
      <a href="/crm/lotes/${lote.id}" style="display:inline-block;margin-top:6px">Ver lote →</a>
    </div>`;
}

export function MapaLotes() {
  const mapRef = useRef<LeafletMap | null>(null);
  const lotesLayerRef = useRef<GeoJSONLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geometria, setGeometria] = useState<ArbaCollection | null>(null);
  const [lotes, setLotes] = useState<ParcelaConReserva[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<Set<EstadoParcela>>(new Set(ESTADOS));
  const [opacidad, setOpacidad] = useState(0.55);
  const [mapaListo, setMapaListo] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/mapa").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "No se pudo cargar el plano");
        return data as ArbaCollection;
      }),
      fetch("/api/crm/parcelas").then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los lotes");
        return r.json() as Promise<ParcelaConReserva[]>;
      }),
    ])
      .then(([geo, rows]) => {
        setGeometria(geo);
        setLotes(rows);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Cruza cada parcela de ARBA con un lote del sistema: primero por partida
  // ("074" de Moreno + partida ARBA), y si no, por manzana y parcela del código catastral.
  const lotePorCca = useMemo(() => {
    const map = new Map<string, ParcelaConReserva>();
    if (!geometria || !lotes) return map;

    const porPartida = new Map<string, ParcelaConReserva>();
    const porNomenclatura = new Map<string, ParcelaConReserva>();
    for (const lote of lotes) {
      if (lote.partidaArba) porPartida.set(`074${lote.partidaArba.trim()}`, lote);
      if (lote.manzana && lote.parcela) {
        porNomenclatura.set(nomenclatura(lote.manzana, lote.parcela), lote);
      }
    }

    const usados = new Set<number>();
    const asignar = (cca: string, lote: ParcelaConReserva | undefined) => {
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
    for (const lote of lotes ?? []) counts[estadoDe(lote)]++;
    return counts;
  }, [lotes]);

  const sinGeometria = lotes && geometria ? lotes.length - lotePorCca.size : 0;

  // Crea el mapa una sola vez (Leaflet solo corre en el navegador).
  useEffect(() => {
    if (!geometria || !containerRef.current || mapRef.current) return;
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
      mapRef.current = map;
      setMapaListo(true);

      const bounds = L.geoJSON(geometria).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
      else map.setView([-34.5504, -58.8176], 17);
    });

    return () => {
      cancelled = true;
    };
  }, [geometria]);

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
      lotesLayerRef.current?.remove();

      const features = geometria.features.filter((f: Feature<MultiPolygon, ArbaProps>) => {
        const lote = lotePorCca.get(f.properties.cca);
        // Parcelas de ARBA que no están en el sistema se dibujan solo con borde.
        return lote ? visibles.has(estadoDe(lote)) : true;
      });

      lotesLayerRef.current = L.geoJSON(
        { type: "FeatureCollection", features } as ArbaCollection,
        {
          style: (f) => {
            const lote = f && lotePorCca.get((f.properties as ArbaProps).cca);
            if (!lote) return { color: "#ffffff", weight: 1, dashArray: "3", fillOpacity: 0 };
            return { color: "#ffffff", weight: 1, fillColor: ESTADO_STYLE[estadoDe(lote)].color, fillOpacity: opacidad };
          },
          onEachFeature: (f, layer) => {
            const lote = lotePorCca.get((f.properties as ArbaProps).cca);
            if (!lote) {
              layer.bindTooltip("Parcela de ARBA que no está en el sistema", { sticky: true });
              return;
            }
            layer.bindTooltip(`Mz ${lote.manzana} · Lote ${lote.parcela}`, { sticky: true });
            layer.bindPopup(popupHtml(lote));
          },
        }
      ).addTo(map);
    });

    return () => {
      cancelled = true;
    };
  }, [mapaListo, geometria, lotes, lotePorCca, visibles, opacidad]);

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
        {ESTADOS.map((estado) => (
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
        {sinGeometria > 0 && (
          <span className="self-center text-xs text-muted-foreground">
            {sinGeometria} lotes del sistema no se encontraron en ARBA.
          </span>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">{error}</p>
      ) : (
        <div className="relative h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-lg border">
          {!geometria && <Skeleton className="absolute inset-0" />}
          <div ref={containerRef} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
