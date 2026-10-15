"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileSpreadsheet,
  Filter,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { IndicesCacCard } from "@/components/crm/indices-cac-card";
import { StatsCard } from "@/components/crm/stats-card";
import { TiposCambioCard } from "@/components/crm/tipos-cambio-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import type { ModalidadContrato, MonedaPago } from "@/lib/schema";

type CuentaRow = {
  contratoId: number | null;
  reservaId: number;
  parcelaId: number;
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
  comprador: string | null;
  dniCuit: string | null;
  telefono: string | null;
  email: string | null;
  reservadoPor: string | null;
  modalidad: ModalidadContrato;
  requiereRevision: boolean;
  totalVencido: number;
  saldoPendiente: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  cuotasPendienteIndice: number;
  cuotasProyectadas: number;
  proximoVencimiento: string | null;
  proximaCuotaMonto: number | null;
  moneda: MonedaPago;
  cuentaEstado: "creada" | "pendiente";
  mensajeCuotas: string;
  valorLoteUsd: number | null;
  valorFinanciadoUsd: number | null;
  cantidadCuotasContrato: number | null;
  cuotaBaseUsd: number | null;
  cuotaBaseArs: number | null;
  indiceBase: string | null;
  valorIndiceBase: number | null;
  indiceActual: string | null;
  valorIndiceActual: number | null;
  cuotaActualUsd: number | null;
  cuotaActualArs: number | null;
  totalCobradoUsd: number | null;
};

type DashboardData = {
  cuentasTotales: number;
  cuentasAlDia: number;
  cuentasConDeudaVencida: number;
  cuentasPendientesCreacion: number;
  proximoMes: string;
  cuotasProximoMes: number;
  montoProximoMesUsd: number | null;
  cuotasTotalesACobrar: number;
  montoTotalACobrarUsd: number | null;
  tipoCambioBna: number | null;
  fechaTipoCambioBna: string | null;
};

const modalidadLabels: Record<ModalidadContrato, string> = {
  usd_fijo: "USD fijo",
  pesos_cac: "Pesos + CAC",
  requiere_revision: "Revisar",
};

type SummaryColKey =
  | "lote"
  | "cliente"
  | "email"
  | "mensaje"
  | "valorLoteUsd"
  | "valorFinanciadoUsd"
  | "cantidadCuotasContrato"
  | "modalidad"
  | "cuotaBaseUsd"
  | "cuotaBaseArs"
  | "indiceBase"
  | "valorIndiceBase"
  | "indiceActual"
  | "valorIndiceActual"
  | "cuotaActualUsd"
  | "cuotaActualArs"
  | "estado"
  | "cobrado"
  | "vencido"
  | "saldo"
  | "proximoVencimiento";

const SUMMARY_COLUMNS: { key: SummaryColKey; label: string }[] = [
  { key: "lote", label: "Lote" },
  { key: "cliente", label: "Cliente" },
  { key: "email", label: "Email contacto" },
  { key: "mensaje", label: "Mensaje" },
  { key: "valorLoteUsd", label: "Valor lote USD" },
  { key: "valorFinanciadoUsd", label: "Valor financiado USD" },
  { key: "cantidadCuotasContrato", label: "# Cuotas" },
  { key: "modalidad", label: "Modalidad" },
  { key: "cuotaBaseUsd", label: "Cuota base USD" },
  { key: "cuotaBaseArs", label: "Cuota base ARS" },
  { key: "indiceBase", label: "Índice base" },
  { key: "valorIndiceBase", label: "Valor índice base" },
  { key: "indiceActual", label: "Índice actual" },
  { key: "valorIndiceActual", label: "Valor índice actual" },
  { key: "cuotaActualUsd", label: "Cuota actual USD" },
  { key: "cuotaActualArs", label: "Cuota actual ARS" },
  { key: "estado", label: "Estado" },
  { key: "cobrado", label: "Total cobrado USD" },
  { key: "vencido", label: "Vencido" },
  { key: "saldo", label: "Saldo" },
  { key: "proximoVencimiento", label: "Proximo vencimiento" },
];

const DEFAULT_VISIBLE_SUMMARY_COLS: Record<SummaryColKey, boolean> = {
  lote: true,
  cliente: true,
  email: false,
  mensaje: false,
  valorLoteUsd: false,
  valorFinanciadoUsd: false,
  cantidadCuotasContrato: true,
  modalidad: true,
  cuotaBaseUsd: false,
  cuotaBaseArs: false,
  indiceBase: false,
  valorIndiceBase: false,
  indiceActual: false,
  valorIndiceActual: false,
  cuotaActualUsd: true,
  cuotaActualArs: true,
  estado: true,
  cobrado: false,
  vencido: false,
  saldo: false,
  proximoVencimiento: false,
};

// v2: nuevos defaults; la selección guardada con la clave anterior se descarta.
const SUMMARY_COLS_STORAGE_KEY = "cuotas-summary-visible-cols-v2";

function loadVisibleSummaryCols(): Record<SummaryColKey, boolean> {
  try {
    const raw = localStorage.getItem(SUMMARY_COLS_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_SUMMARY_COLS;
    const parsed = JSON.parse(raw) as Partial<Record<SummaryColKey, boolean>>;
    return { ...DEFAULT_VISIBLE_SUMMARY_COLS, ...parsed };
  } catch {
    return DEFAULT_VISIBLE_SUMMARY_COLS;
  }
}

function formatMoney(value: number | null, moneda: MonedaPago) {
  if (value === null) return "-";
  const prefix = moneda === "usd" ? "USD" : "$";
  return `${prefix} ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatIndexValue(value: number | null) {
  if (value === null) return "Pendiente";
  return value.toLocaleString("es-AR", { maximumFractionDigits: 3 });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatUsd(value: number | null) {
  if (value === null) return "Sin BNA de hoy";
  return `USD ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPeriod(value: string | null) {
  if (!value) return "Próximo mes";
  const [year, month] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function estadoResumen(row: CuentaRow) {
  if (row.cuentaEstado === "pendiente") {
    return row.requiereRevision ? "Pendiente revisión" : "Pendiente creación";
  }
  if (row.cuotasVencidas > 0) return `${row.cuotasVencidas} Vencida(s)`;
  return "Al dia";
}

const ESTADOS_CUENTA = ["todos", "vencidas", "pendiente_cuenta", "al_dia"];

export default function CuotasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  // Permite llegar prefiltrado desde las tarjetas de Insights (?estado=vencidas).
  const { estado: estadoInicial } = use(searchParams);
  const { data: session } = useSession();
  const [rows, setRows] = useState<CuentaRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [showResumen, setShowResumen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState(
    estadoInicial && ESTADOS_CUENTA.includes(estadoInicial) ? estadoInicial : "todos"
  );
  const [modalidad, setModalidad] = useState("todas");
  const [manzanaFiltro, setManzanaFiltro] = useState("");
  const [parcelaFiltro, setParcelaFiltro] = useState("");
  const [compradorFiltro, setCompradorFiltro] = useState("");
  const [firmaDesde, setFirmaDesde] = useState("");
  const [firmaHasta, setFirmaHasta] = useState("");
  const [visibleSummaryCols, setVisibleSummaryCols] = useState<Record<SummaryColKey, boolean>>(
    DEFAULT_VISIBLE_SUMMARY_COLS
  );

  const visibleTableColumnCount =
    SUMMARY_COLUMNS.filter((col) => visibleSummaryCols[col.key]).length + 1;

  const params = useMemo(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("search", search.trim());
    if (estado !== "todos") next.set("estado", estado);
    if (modalidad !== "todas") next.set("modalidad", modalidad);
    if (manzanaFiltro.trim()) next.set("manzana", manzanaFiltro.trim());
    if (parcelaFiltro.trim()) next.set("parcela", parcelaFiltro.trim());
    if (compradorFiltro.trim()) next.set("comprador", compradorFiltro.trim());
    if (firmaDesde) next.set("fechaFirmaDesde", firmaDesde);
    if (firmaHasta) next.set("fechaFirmaHasta", firmaHasta);
    return next;
  }, [
    estado,
    modalidad,
    search,
    manzanaFiltro,
    parcelaFiltro,
    compradorFiltro,
    firmaDesde,
    firmaHasta,
  ]);

  async function fetchRows() {
    if (session?.user?.role !== "admin") {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/cuentas-corrientes?${params}`);
      if (!res.ok) {
        toast.error("No se pudieron cargar las cuotas. Recargá la página; si sigue, avisale a un administrador");
        return;
      }
      setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function fetchDashboard() {
    if (session?.user?.role !== "admin") {
      setDashboard(null);
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    try {
      const res = await fetch("/api/crm/cuotas/dashboard");
      if (!res.ok) {
        toast.error("No se pudo cargar el resumen de cuotas. Recargá la página; si sigue, avisale a un administrador");
        return;
      }
      setDashboard(await res.json());
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    setVisibleSummaryCols(loadVisibleSummaryCols());
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, session]);

  useEffect(() => {
    if (session?.user?.role === "admin") {
      void fetchDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);

  if (session && session.user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Solo un administrador puede ver cuentas corrientes y cuotas.
        </CardContent>
      </Card>
    );
  }

  function exportResumenXls() {
    const data = rows.map((row) => ({
      Lote: row.loteNumero,
      Manzana: row.manzana ?? "",
      Parcela: row.parcela ?? "",
      Cliente: row.comprador ?? "",
      DNI: row.dniCuit ?? "",
      Telefono: row.telefono ?? "",
      "Email contacto": row.email ?? "",
      "Valor lote USD": row.valorLoteUsd,
      "Valor financiado USD": row.valorFinanciadoUsd,
      "Cantidad de cuotas": row.cantidadCuotasContrato,
      Modalidad: modalidadLabels[row.modalidad],
      "Cuota base USD": row.cuotaBaseUsd,
      "Cuota base ARS": row.cuotaBaseArs,
      "Indice base": row.indiceBase ?? "Pendiente",
      "Valor indice base": row.valorIndiceBase,
      "Indice actual": row.indiceActual ?? "Pendiente",
      "Valor indice actual": row.valorIndiceActual,
      "Cuota actual USD": row.cuotaActualUsd,
      "Cuota actual ARS": row.cuotaActualArs,
      Estado: estadoResumen(row),
      "Total cobrado USD": row.totalCobradoUsd,
      Vencido: row.totalVencido,
      Saldo: row.saldoPendiente,
      "Proximo vencimiento": row.proximoVencimiento ?? "",
      "Proxima cuota": row.proximaCuotaMonto ?? "",
      Mensaje: row.cuentaEstado === "pendiente" ? "" : row.mensajeCuotas,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 80 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen cuotas");
    XLSX.writeFile(
      workbook,
      `resumen-cuotas-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  function setVisibleSummaryColumn(key: SummaryColKey, value: boolean) {
    const next = { ...visibleSummaryCols, [key]: value };
    setVisibleSummaryCols(next);
    try {
      localStorage.setItem(SUMMARY_COLS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-normal text-foreground">Cuotas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuenta corriente por lote vendido
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <span>{rows.length} resultados</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                Columnas
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {SUMMARY_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleSummaryCols[col.key]}
                  onCheckedChange={(checked) =>
                    setVisibleSummaryColumn(col.key, Boolean(checked))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            onClick={exportResumenXls}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            Exportar XLS
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cuentas" className="gap-5">
        <TabsList>
          <TabsTrigger value="cuentas">Cuentas corrientes</TabsTrigger>
          <TabsTrigger value="indices">Índices y ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="cuentas" className="space-y-5">
          <section aria-labelledby="dashboard-cuotas-title" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <button
                type="button"
                onClick={() => setShowResumen((value) => !value)}
                aria-expanded={showResumen}
                className="flex items-center gap-2 text-left"
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${showResumen ? "" : "-rotate-90"}`}
                />
                <h2 id="dashboard-cuotas-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Resumen global
                </h2>
              </button>
              {showResumen && dashboard?.tipoCambioBna && dashboard.fechaTipoCambioBna && (
                <p className="text-xs text-muted-foreground">
                  Conversión: BNA vendedor ${dashboard.tipoCambioBna.toLocaleString("es-AR")} · {formatDate(dashboard.fechaTipoCambioBna)}
                </p>
              )}
            </div>

            {!showResumen ? null : dashboardLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
                ))}
              </div>
            ) : dashboard ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatsCard title="Deudores totales" value={dashboard.cuentasTotales} description="Cuentas creadas" />
                <StatsCard title="Al día" value={dashboard.cuentasAlDia} description="Sin cuotas vencidas" />
                <StatsCard
                  title="Con deuda vencida"
                  value={dashboard.cuentasConDeudaVencida}
                  description="Una o más cuotas vencidas"
                  tone={dashboard.cuentasConDeudaVencida > 0 ? "danger" : undefined}
                />
                <StatsCard title="Pendientes de creación" value={dashboard.cuentasPendientesCreacion} description="Reservas sin cuenta corriente" />
                <StatsCard
                  title={`A cobrar en ${formatPeriod(dashboard.proximoMes)}`}
                  value={formatUsd(dashboard.montoProximoMesUsd)}
                  description={`${dashboard.cuotasProximoMes} cuotas`}
                />
                <StatsCard
                  title="Total pendiente a cobrar"
                  value={formatUsd(dashboard.montoTotalACobrarUsd)}
                  description={`${dashboard.cuotasTotalesACobrar} cuotas`}
                />
              </div>
            ) : null}
          </section>

          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente, DNI, lote..."
                    className="pl-9"
                  />
                </label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="vencidas">Vencidas</SelectItem>
                    <SelectItem value="pendiente_cuenta">Pendiente creacion</SelectItem>
                    <SelectItem value="al_dia">Al dia</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={modalidad} onValueChange={setModalidad}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="usd_fijo">USD fijo</SelectItem>
                    <SelectItem value="pesos_cac">Pesos + CAC</SelectItem>
                    <SelectItem value="requiere_revision">Revisar</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void fetchRows();
                    void fetchDashboard();
                  }}
                >
                  <Filter className="mr-1 h-4 w-4" />
                  Actualizar
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-[120px_120px_1fr_160px_160px_auto] md:items-end">
                <div className="grid gap-1">
                  <Label htmlFor="filtro-manzana" className="text-xs text-muted-foreground">
                    Manzana
                  </Label>
                  <Input
                    id="filtro-manzana"
                    value={manzanaFiltro}
                    onChange={(event) => setManzanaFiltro(event.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="filtro-parcela" className="text-xs text-muted-foreground">
                    Parcela
                  </Label>
                  <Input
                    id="filtro-parcela"
                    value={parcelaFiltro}
                    onChange={(event) => setParcelaFiltro(event.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="filtro-comprador" className="text-xs text-muted-foreground">
                    Comprador
                  </Label>
                  <Input
                    id="filtro-comprador"
                    value={compradorFiltro}
                    onChange={(event) => setCompradorFiltro(event.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="filtro-firma-desde" className="text-xs text-muted-foreground">
                    Firma desde
                  </Label>
                  <Input
                    id="filtro-firma-desde"
                    type="date"
                    value={firmaDesde}
                    onChange={(event) => setFirmaDesde(event.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="filtro-firma-hasta" className="text-xs text-muted-foreground">
                    Firma hasta
                  </Label>
                  <Input
                    id="filtro-firma-hasta"
                    type="date"
                    value={firmaHasta}
                    onChange={(event) => setFirmaHasta(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setManzanaFiltro("");
                    setParcelaFiltro("");
                    setCompradorFiltro("");
                    setFirmaDesde("");
                    setFirmaHasta("");
                  }}
                >
                  <X className="mr-1 h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24" />
                  {visibleSummaryCols.estado && <TableHead>Estado</TableHead>}
                  {visibleSummaryCols.lote && <TableHead>Lote</TableHead>}
                  {visibleSummaryCols.cliente && <TableHead>Cliente</TableHead>}
                  {visibleSummaryCols.email && <TableHead>Email contacto</TableHead>}
                  {visibleSummaryCols.mensaje && <TableHead>Mensaje</TableHead>}
                  {visibleSummaryCols.valorLoteUsd && <TableHead>Valor lote USD</TableHead>}
                  {visibleSummaryCols.valorFinanciadoUsd && (
                    <TableHead>Valor financiado USD</TableHead>
                  )}
                  {visibleSummaryCols.cantidadCuotasContrato && <TableHead># Cuotas</TableHead>}
                  {visibleSummaryCols.modalidad && <TableHead>Modalidad</TableHead>}
                  {visibleSummaryCols.cuotaBaseUsd && <TableHead>Cuota base USD</TableHead>}
                  {visibleSummaryCols.cuotaBaseArs && <TableHead>Cuota base ARS</TableHead>}
                  {visibleSummaryCols.indiceBase && <TableHead>Índice base</TableHead>}
                  {visibleSummaryCols.valorIndiceBase && (
                    <TableHead>Valor índice base</TableHead>
                  )}
                  {visibleSummaryCols.indiceActual && <TableHead>Índice actual</TableHead>}
                  {visibleSummaryCols.valorIndiceActual && (
                    <TableHead>Valor índice actual</TableHead>
                  )}
                  {visibleSummaryCols.cuotaActualUsd && <TableHead>Cuota actual USD</TableHead>}
                  {visibleSummaryCols.cuotaActualArs && <TableHead>Cuota actual ARS</TableHead>}
                  {visibleSummaryCols.cobrado && <TableHead>Total cobrado USD</TableHead>}
                  {visibleSummaryCols.vencido && <TableHead>Vencido</TableHead>}
                  {visibleSummaryCols.saldo && <TableHead>Saldo</TableHead>}
                  {visibleSummaryCols.proximoVencimiento && (
                    <TableHead>Proximo vencimiento</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleTableColumnCount}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleTableColumnCount}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No hay cuentas corrientes para este filtro
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.reservaId}>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/crm/cuotas/${row.reservaId}`}>
                            {row.cuentaEstado === "pendiente"
                              ? row.requiereRevision
                                ? "Revisar"
                                : "Crear"
                              : "Ver"}
                          </Link>
                        </Button>
                      </TableCell>
                      {visibleSummaryCols.estado && (
                        <TableCell>
                          {row.cuentaEstado === "pendiente" ? (
                            <Badge className="gap-1 bg-amber-500/10 text-amber-800 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              {row.requiereRevision ? "Pendiente revisión" : "Pendiente creación"}
                            </Badge>
                          ) : row.cuotasVencidas > 0 ? (
                            <Badge className="bg-destructive/10 text-destructive">
                              {row.cuotasVencidas} Vencida(s)
                            </Badge>
                          ) : (
                            <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Al dia
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {visibleSummaryCols.lote && (
                        <TableCell className="text-sm">
                          <div className="whitespace-nowrap font-medium">
                            Manzana {row.manzana ?? "-"} · Parcela {row.parcela ?? "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">Lote #{row.loteNumero}</div>
                        </TableCell>
                      )}
                      {visibleSummaryCols.cliente && (
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {row.comprador ?? "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.dniCuit ?? row.email ?? row.telefono ?? "-"}
                          </div>
                        </TableCell>
                      )}
                      {visibleSummaryCols.email && <TableCell>{row.email ?? ""}</TableCell>}
                      {visibleSummaryCols.mensaje && (
                        <TableCell className="max-w-[420px] whitespace-pre-wrap text-xs text-muted-foreground">
                          {row.cuentaEstado === "pendiente" ? "" : row.mensajeCuotas}
                        </TableCell>
                      )}
                      {visibleSummaryCols.valorLoteUsd && (
                        <TableCell>{formatMoney(row.valorLoteUsd, "usd")}</TableCell>
                      )}
                      {visibleSummaryCols.valorFinanciadoUsd && (
                        <TableCell>{formatMoney(row.valorFinanciadoUsd, "usd")}</TableCell>
                      )}
                      {visibleSummaryCols.cantidadCuotasContrato && (
                        <TableCell>{row.cantidadCuotasContrato ?? "-"}</TableCell>
                      )}
                      {visibleSummaryCols.modalidad && (
                        <TableCell>{modalidadLabels[row.modalidad]}</TableCell>
                      )}
                      {visibleSummaryCols.cuotaBaseUsd && (
                        <TableCell>{formatMoney(row.cuotaBaseUsd, "usd")}</TableCell>
                      )}
                      {visibleSummaryCols.cuotaBaseArs && (
                        <TableCell>{formatMoney(row.cuotaBaseArs, "ars")}</TableCell>
                      )}
                      {visibleSummaryCols.indiceBase && (
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.indiceBase ?? "Pendiente"}
                        </TableCell>
                      )}
                      {visibleSummaryCols.valorIndiceBase && (
                        <TableCell>{formatIndexValue(row.valorIndiceBase)}</TableCell>
                      )}
                      {visibleSummaryCols.indiceActual && (
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.indiceActual ?? "Pendiente"}
                        </TableCell>
                      )}
                      {visibleSummaryCols.valorIndiceActual && (
                        <TableCell>{formatIndexValue(row.valorIndiceActual)}</TableCell>
                      )}
                      {visibleSummaryCols.cuotaActualUsd && (
                        <TableCell>{formatMoney(row.cuotaActualUsd, "usd")}</TableCell>
                      )}
                      {visibleSummaryCols.cuotaActualArs && (
                        <TableCell>{formatMoney(row.cuotaActualArs, "ars")}</TableCell>
                      )}
                      {visibleSummaryCols.cobrado && (
                        <TableCell>{formatMoney(row.totalCobradoUsd, "usd")}</TableCell>
                      )}
                      {visibleSummaryCols.vencido && (
                        <TableCell>{formatMoney(row.totalVencido, row.moneda)}</TableCell>
                      )}
                      {visibleSummaryCols.saldo && (
                        <TableCell>{formatMoney(row.saldoPendiente, row.moneda)}</TableCell>
                      )}
                      {visibleSummaryCols.proximoVencimiento && (
                        <TableCell>
                          <div>{formatDate(row.proximoVencimiento)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(row.proximaCuotaMonto, row.moneda)}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="indices">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <IndicesCacCard onSaved={() => Promise.all([fetchRows(), fetchDashboard()])} />
            <TiposCambioCard onSaved={() => Promise.all([fetchRows(), fetchDashboard()])} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
