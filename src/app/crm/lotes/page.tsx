"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Parcela, EstadoParcela } from "@/lib/schema";

const estadoColors: Record<EstadoParcela, string> = {
  disponible: "bg-green-100 text-green-700",
  reservado: "bg-yellow-100 text-yellow-700",
  vendido: "bg-gray-100 text-gray-700",
  no_disponible: "bg-red-100 text-red-700",
};

const estadoLabels: Record<EstadoParcela, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  no_disponible: "No disponible",
};

const SUPERFICIE_RANGES = [
  { label: "Hasta 300 m²", min: undefined, max: 300 },
  { label: "300 – 500 m²", min: 300, max: 500 },
  { label: "500 – 800 m²", min: 500, max: 800 },
  { label: "Más de 800 m²", min: 800, max: undefined },
] as const;

type ColKey =
  | "comprador"
  | "dniCuit"
  | "telefono"
  | "email"
  | "domicilio"
  | "corredor"
  | "emailCorredor"
  | "formaPago"
  | "entrega"
  | "fechaReserva"
  | "fechaVencimiento"
  | "precioTotal"
  | "anticipo"
  | "saldo"
  | "cuotas"
  | "cuotaMensual"
  | "observaciones";

const OPTIONAL_COLS: { key: ColKey; label: string }[] = [
  { key: "comprador", label: "Comprador" },
  { key: "dniCuit", label: "DNI / CUIT" },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Email comprador" },
  { key: "domicilio", label: "Domicilio" },
  { key: "corredor", label: "Corredor" },
  { key: "emailCorredor", label: "Email corredor" },
  { key: "formaPago", label: "Forma de pago" },
  { key: "entrega", label: "Entrega posesión" },
  { key: "fechaReserva", label: "Fecha reserva" },
  { key: "fechaVencimiento", label: "Fecha vencimiento" },
  { key: "precioTotal", label: "Precio total" },
  { key: "anticipo", label: "Anticipo" },
  { key: "saldo", label: "Saldo" },
  { key: "cuotas", label: "Cuotas" },
  { key: "cuotaMensual", label: "Cuota mensual" },
  { key: "observaciones", label: "Observaciones" },
];

function formatEntrega(lote: Parcela): string {
  if (!lote.tipoEntrega) return "—";
  if (lote.tipoEntrega === "cuota") {
    return lote.mesEntrega ? `Contra cuota N° ${lote.mesEntrega}` : "Contra cuota";
  }
  return "Contra saldo";
}

function getCellValue(lote: Parcela, key: ColKey): string {
  switch (key) {
    case "comprador": return lote.nombreComprador ?? "—";
    case "dniCuit": return lote.dniCuit ?? "—";
    case "telefono": return lote.telefono ?? "—";
    case "email": return lote.emailComprador ?? "—";
    case "domicilio": return lote.domicilioComprador ?? "—";
    case "corredor": return lote.nombreCorredor ?? "—";
    case "emailCorredor": return lote.emailCorredor ?? "—";
    case "formaPago": return lote.formaPago ?? "—";
    case "entrega": return formatEntrega(lote);
    case "fechaReserva": return lote.fechaReserva ?? "—";
    case "fechaVencimiento": return lote.fechaVencimiento ?? "—";
    case "precioTotal": return lote.precioTotalNum ? `USD ${lote.precioTotalNum}` : "—";
    case "anticipo": return lote.anticipoNum ? `USD ${lote.anticipoNum}` : "—";
    case "saldo": return lote.saldoNum ? `USD ${lote.saldoNum}` : "—";
    case "cuotas": return lote.cantidadCuotas ?? "—";
    case "cuotaMensual": return lote.cuotaMensual ? `USD ${lote.cuotaMensual}` : "—";
    case "observaciones": return lote.observaciones ?? "—";
  }
}

const DEFAULT_COLS: Record<ColKey, boolean> = {
  comprador: true,
  dniCuit: false,
  telefono: false,
  email: false,
  domicilio: false,
  corredor: false,
  emailCorredor: false,
  formaPago: false,
  entrega: false,
  fechaReserva: false,
  fechaVencimiento: false,
  precioTotal: false,
  anticipo: false,
  saldo: false,
  cuotas: false,
  cuotaMensual: false,
  observaciones: false,
};

const STORAGE_KEY = "lotes-visible-cols";

function loadVisibleCols(): Record<ColKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLS;
    const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
    // Merge with defaults to handle new keys added later
    return { ...DEFAULT_COLS, ...parsed };
  } catch {
    return DEFAULT_COLS;
  }
}

export default function LotesPage() {
  const [lotes, setLotes] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [manzanas, setManzanas] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("disponible");
  const [filterManzana, setFilterManzana] = useState<string>("all");
  const [filterSuperficie, setFilterSuperficie] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEstado, setBulkEstado] = useState<EstadoParcela | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(DEFAULT_COLS);

  // Load persisted columns on mount
  useEffect(() => {
    setVisibleCols(loadVisibleCols());
  }, []);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const lastCheckedIndexRef = useRef<number | null>(null);
  const lastColPickerIndexRef = useRef<number | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/crm/parcelas/manzanas")
      .then((r) => r.json())
      .then(setManzanas)
      .catch(() => {});
  }, []);

  // Close col picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    if (colPickerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colPickerOpen]);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEstado !== "all") params.set("estado", filterEstado);
    if (filterManzana !== "all") params.set("manzana", filterManzana);
    if (filterSuperficie !== "all") {
      const range = SUPERFICIE_RANGES[Number(filterSuperficie)];
      if (range) {
        if (range.min !== undefined) params.set("superficieMin", String(range.min));
        if (range.max !== undefined) params.set("superficieMax", String(range.max));
      }
    }
    if (search) params.set("search", search);
    const res = await fetch(`/api/crm/parcelas?${params}`);
    const data = await res.json();
    setLotes(data);
    setSelected(new Set());
    lastCheckedIndexRef.current = null;
    setLoading(false);
  }, [filterEstado, filterManzana, filterSuperficie, search]);

  useEffect(() => {
    fetchLotes();
  }, [fetchLotes]);

  const handleEstadoChange = async (id: number, estado: EstadoParcela) => {
    const prev = lotes;
    setLotes((ls) => ls.map((l) => (l.id === id ? { ...l, estado } : l)));
    const res = await fetch(`/api/crm/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) {
      setLotes(prev);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleCheckbox = (id: number, index: number, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastCheckedIndexRef.current !== null) {
        const from = Math.min(lastCheckedIndexRef.current, index);
        const to = Math.max(lastCheckedIndexRef.current, index);
        const isSelecting = !prev.has(id);
        for (let i = from; i <= to; i++) {
          const lote = lotes[i];
          if (!lote) continue;
          if (isSelecting) next.add(lote.id);
          else next.delete(lote.id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastCheckedIndexRef.current = index;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelected(new Set(lotes.map((l) => l.id)));
    } else {
      setSelected(new Set());
    }
    lastCheckedIndexRef.current = null;
  };

  const handleBulkUpdate = async () => {
    if (!bulkEstado || selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const prev = lotes;
    setLotes((ls) =>
      ls.map((l) =>
        selected.has(l.id) ? { ...l, estado: bulkEstado as EstadoParcela } : l
      )
    );
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/crm/parcelas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: bulkEstado }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setLotes(prev);
        toast.error(`${failed} actualizacion(es) fallaron`);
      } else {
        toast.success(`${ids.length} lote(s) actualizados`);
        setSelected(new Set());
        setBulkEstado("");
      }
    } catch {
      setLotes(prev);
      toast.error("Error al actualizar");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportExcel = () => {
    const activeCols = OPTIONAL_COLS.filter((c) => visibleCols[c.key]);

    const headers = [
      "N°",
      "Circ.",
      "Secc.",
      "Manzana",
      "Parcela",
      "Partida ARBA",
      "Superficie",
      "Precio Etapa 1",
      "Estado",
      ...activeCols.map((c) => c.label),
    ];

    const rows = lotes.map((lote) => [
      lote.numero,
      lote.circunscripcion ?? "",
      lote.seccion ?? "",
      lote.manzana ?? "",
      lote.parcela ?? "",
      lote.partidaArba ?? "",
      lote.superficieM2 ? `${lote.superficieM2} m²` : "",
      lote.precioEtapa1 ? `USD ${Number(lote.precioEtapa1).toLocaleString("es-AR")}` : "",
      estadoLabels[lote.estado],
      ...activeCols.map((c) => {
        const v = getCellValue(lote, c.key);
        return v === "—" ? "" : v;
      }),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lotes");
    XLSX.writeFile(wb, "lotes-export.xlsx");
  };

  const allSelected = lotes.length > 0 && selected.size === lotes.length;
  const someSelected = selected.size > 0 && selected.size < lotes.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const activeOptionalCols = OPTIONAL_COLS.filter((c) => visibleCols[c.key]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Lotes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de parcelas del barrio
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <Input
          placeholder="Buscar por parcela o comprador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="disponible">Disponible</SelectItem>
            <SelectItem value="reservado">Reservado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
            <SelectItem value="no_disponible">No disponible</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterManzana} onValueChange={setFilterManzana}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="Manzana" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las manzanas</SelectItem>
            {manzanas.map((m) => (
              <SelectItem key={m} value={m}>
                Manzana {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSuperficie} onValueChange={setFilterSuperficie}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Superficie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda superficie</SelectItem>
            {SUPERFICIE_RANGES.map((r, i) => (
              <SelectItem key={i} value={String(i)}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Column picker */}
        <div className="relative" ref={colPickerRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setColPickerOpen((o) => !o)}
          >
            Columnas
            {activeOptionalCols.length > 0 && (
              <span className="ml-1.5 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                {activeOptionalCols.length}
              </span>
            )}
          </Button>
          {colPickerOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 bg-white border rounded-lg shadow-lg p-3 min-w-[200px] space-y-1">
              {OPTIONAL_COLS.map((col, colIndex) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={visibleCols[col.key]}
                    onChange={() => {}}
                    onClick={(e) => {
                      const newValue = !visibleCols[col.key];
                      let next = { ...visibleCols };
                      if (e.shiftKey && lastColPickerIndexRef.current !== null) {
                        const from = Math.min(lastColPickerIndexRef.current, colIndex);
                        const to = Math.max(lastColPickerIndexRef.current, colIndex);
                        for (let i = from; i <= to; i++) {
                          const c = OPTIONAL_COLS[i];
                          if (c) next[c.key] = newValue;
                        }
                      } else {
                        next[col.key] = newValue;
                      }
                      lastColPickerIndexRef.current = colIndex;
                      setVisibleCols(next);
                      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
                    }}
                    className="size-4 cursor-pointer accent-primary"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Excel export */}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleExportExcel}
          disabled={lotes.length === 0}
        >
          Exportar Excel
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  aria-label="Seleccionar todos"
                  className="size-4 cursor-pointer accent-primary"
                />
              </TableHead>
              <TableHead className="w-12">N°</TableHead>
              <TableHead>Circ.</TableHead>
              <TableHead>Secc.</TableHead>
              <TableHead>Manzana</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Partida ARBA</TableHead>
              <TableHead>Superficie</TableHead>
              <TableHead>Precio Etapa 1</TableHead>
              <TableHead>Estado</TableHead>
              {activeOptionalCols.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 + activeOptionalCols.length }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : lotes.map((lote, index) => (
                  <TableRow
                    key={lote.id}
                    data-state={selected.has(lote.id) ? "selected" : undefined}
                    className={selected.has(lote.id) ? "bg-blue-50" : undefined}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(lote.id)}
                        onChange={() => {}}
                        onClick={(e) => handleCheckbox(lote.id, index, e.shiftKey)}
                        aria-label={`Seleccionar lote ${lote.numero}`}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {lote.numero}
                    </TableCell>
                    <TableCell>{lote.circunscripcion ?? "—"}</TableCell>
                    <TableCell>{lote.seccion ?? "—"}</TableCell>
                    <TableCell>{lote.manzana ?? "—"}</TableCell>
                    <TableCell>{lote.parcela ?? "—"}</TableCell>
                    <TableCell>{lote.partidaArba ?? "—"}</TableCell>
                    <TableCell>
                      {lote.superficieM2 ? `${lote.superficieM2} m²` : "—"}
                    </TableCell>
                    <TableCell>
                      {lote.precioEtapa1
                        ? `USD ${Number(lote.precioEtapa1).toLocaleString("es-AR")}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lote.estado}
                        onValueChange={(v) =>
                          handleEstadoChange(lote.id, v as EstadoParcela)
                        }
                      >
                        <SelectTrigger className="h-7 w-36 text-xs border-0 p-0 shadow-none focus:ring-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[lote.estado]}`}
                          >
                            {estadoLabels[lote.estado]}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(estadoLabels) as EstadoParcela[]).map(
                            (e) => (
                              <SelectItem key={e} value={e}>
                                {estadoLabels[e]}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {activeOptionalCols.map((col) => (
                      <TableCell key={col.key} className="text-sm text-gray-600 max-w-[200px] truncate">
                        {getCellValue(lote, col.key)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/crm/lotes/${lote.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!loading && lotes.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">
            No se encontraron lotes
          </p>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-white px-5 py-3 shadow-xl">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <Select
            value={bulkEstado}
            onValueChange={(v) => setBulkEstado(v as EstadoParcela)}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="Cambiar estado..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(estadoLabels) as EstadoParcela[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {estadoLabels[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkUpdate}
            disabled={!bulkEstado || bulkLoading}
          >
            {bulkLoading ? "Aplicando..." : "Aplicar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelected(new Set());
              setBulkEstado("");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
