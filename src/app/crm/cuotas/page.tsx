"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Edit2,
  FileSpreadsheet,
  Filter,
  Save,
  Search,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import { useSession } from "@/lib/auth-client";
import type { IndiceCac, ModalidadContrato, MonedaPago } from "@/lib/schema";

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
  { key: "vencido", label: "Vencido" },
  { key: "saldo", label: "Saldo" },
  { key: "proximoVencimiento", label: "Proximo vencimiento" },
];

const DEFAULT_VISIBLE_SUMMARY_COLS: Record<SummaryColKey, boolean> = {
  lote: true,
  cliente: true,
  email: true,
  mensaje: false,
  valorLoteUsd: true,
  valorFinanciadoUsd: true,
  cantidadCuotasContrato: true,
  modalidad: true,
  cuotaBaseUsd: true,
  cuotaBaseArs: true,
  indiceBase: true,
  valorIndiceBase: true,
  indiceActual: true,
  valorIndiceActual: true,
  cuotaActualUsd: true,
  cuotaActualArs: true,
  estado: true,
  vencido: true,
  saldo: true,
  proximoVencimiento: true,
};

const SUMMARY_COLS_STORAGE_KEY = "cuotas-summary-visible-cols";

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
  if (row.cuentaEstado === "pendiente") return "Pendiente creacion";
  if (row.cuotasVencidas > 0) return `${row.cuotasVencidas} Vencida(s)`;
  return "Al dia";
}

export default function CuotasPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<CuentaRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("todos");
  const [modalidad, setModalidad] = useState("todas");
  const [periodo, setPeriodo] = useState("");
  const [valor, setValor] = useState("");
  const [fuente, setFuente] = useState("");
  const [indices, setIndices] = useState<IndiceCac[]>([]);
  const [showIndices, setShowIndices] = useState(false);
  const [editingPeriodo, setEditingPeriodo] = useState<string | null>(null);
  const [editingValor, setEditingValor] = useState("");
  const [editingFuente, setEditingFuente] = useState("");
  const [savingIndice, setSavingIndice] = useState(false);
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
    return next;
  }, [estado, modalidad, search]);

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
        toast.error("No se pudieron cargar las cuotas");
        return;
      }
      setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function fetchIndices() {
    const res = await fetch("/api/crm/indices-cac");
    if (!res.ok) {
      toast.error("No se pudieron cargar los CAC");
      return;
    }
    setIndices(await res.json());
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
        toast.error("No se pudo cargar el resumen de cuotas");
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
      void fetchIndices();
      void fetchDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);

  if (session && session.user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Solo un administrador puede ver cuentas corrientes y cuotas.
        </CardContent>
      </Card>
    );
  }

  async function saveIndice() {
    const numericValue = Number(valor);
    if (!periodo || !Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Carga periodo y valor CAC");
      return;
    }

    setSavingIndice(true);
    try {
      const res = await fetch("/api/crm/indices-cac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo,
          valor: numericValue,
          fuente: fuente || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo guardar el indice");
        return;
      }
      toast.success("Indice CAC guardado");
      setValor("");
      setFuente("");
      await fetchIndices();
      await fetchRows();
      await fetchDashboard();
    } finally {
      setSavingIndice(false);
    }
  }

  function startEditIndice(indice: IndiceCac) {
    setEditingPeriodo(indice.periodo);
    setEditingValor(String(indice.valor));
    setEditingFuente(indice.fuente ?? "");
  }

  function cancelEditIndice() {
    setEditingPeriodo(null);
    setEditingValor("");
    setEditingFuente("");
  }

  async function saveEditedIndice(periodoToSave: string) {
    const numericValue = Number(editingValor);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Carga un valor CAC valido");
      return;
    }

    setSavingIndice(true);
    try {
      const res = await fetch("/api/crm/indices-cac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo: periodoToSave,
          valor: numericValue,
          fuente: editingFuente || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo actualizar el CAC");
        return;
      }
      toast.success("CAC actualizado");
      cancelEditIndice();
      await fetchIndices();
      await fetchRows();
      await fetchDashboard();
    } finally {
      setSavingIndice(false);
    }
  }

  async function deleteIndice(indice: IndiceCac) {
    if (!window.confirm(`Borrar CAC ${indice.periodo}?`)) return;

    setSavingIndice(true);
    try {
      const res = await fetch("/api/crm/indices-cac", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: indice.periodo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo borrar el CAC");
        return;
      }
      toast.success("CAC borrado");
      if (editingPeriodo === indice.periodo) {
        cancelEditIndice();
      }
      await fetchIndices();
      await fetchRows();
      await fetchDashboard();
    } finally {
      setSavingIndice(false);
    }
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
          <h1 className="text-2xl font-semibold text-foreground">Cuotas</h1>
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

      <section aria-labelledby="dashboard-cuotas-title" className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="dashboard-cuotas-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Resumen global
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado general de cuentas y cuotas pendientes
            </p>
          </div>
          {dashboard?.tipoCambioBna && dashboard.fechaTipoCambioBna && (
            <p className="text-xs text-muted-foreground">
              Conversión: BNA vendedor ${dashboard.tipoCambioBna.toLocaleString("es-AR")} · {formatDate(dashboard.fechaTipoCambioBna)}
            </p>
          )}
        </div>

        {dashboardLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : dashboard ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 bg-slate-50/70 shadow-none">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-slate-600">Deudores totales</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{dashboard.cuentasTotales}</p>
                  <p className="mt-1 text-xs text-slate-500">Cuentas creadas</p>
                </div>
                <Users className="h-5 w-5 text-slate-500" />
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/70 shadow-none">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-emerald-700">Al día</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-950">{dashboard.cuentasAlDia}</p>
                  <p className="mt-1 text-xs text-emerald-700/70">Sin cuotas vencidas</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </CardContent>
            </Card>
            <Card className="border-rose-200 bg-rose-50/70 shadow-none">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-rose-700">Con deuda vencida</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-950">{dashboard.cuentasConDeudaVencida}</p>
                  <p className="mt-1 text-xs text-rose-700/70">Una o más cuotas vencidas</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/70 shadow-none">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-amber-700">Pendientes de creación</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-950">{dashboard.cuentasPendientesCreacion}</p>
                  <p className="mt-1 text-xs text-amber-700/70">Reservas sin cuenta corriente</p>
                </div>
                <Clock3 className="h-5 w-5 text-amber-600" />
              </CardContent>
            </Card>
            <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-none sm:col-span-1 xl:col-span-2">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-sky-800">A cobrar en {formatPeriod(dashboard.proximoMes)}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-sky-950">{formatUsd(dashboard.montoProximoMesUsd)}</p>
                  <p className="mt-1 text-sm text-sky-700">{dashboard.cuotasProximoMes} cuotas</p>
                </div>
                <CalendarDays className="h-6 w-6 text-sky-600" />
              </CardContent>
            </Card>
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-none sm:col-span-1 xl:col-span-2">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-indigo-800">Total pendiente a cobrar</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-indigo-950">{formatUsd(dashboard.montoTotalACobrarUsd)}</p>
                  <p className="mt-1 text-sm text-indigo-700">{dashboard.cuotasTotalesACobrar} cuotas</p>
                </div>
                <WalletCards className="h-6 w-6 text-indigo-600" />
              </CardContent>
            </Card>
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
        </CardContent>
      </Card>

      {session?.user?.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indice CAC mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[150px_160px_1fr_auto] md:items-end">
              <div className="grid gap-2">
                <Label>Periodo</Label>
                <Input
                  type="month"
                  value={periodo}
                  onChange={(event) => setPeriodo(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fuente / nota</Label>
                <Input
                  value={fuente}
                  onChange={(event) => setFuente(event.target.value)}
                  placeholder="Carga manual"
                />
              </div>
              <Button
                type="button"
                onClick={saveIndice}
                disabled={savingIndice}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {savingIndice ? "Guardando..." : "Guardar CAC"}
              </Button>
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowIndices((value) => !value)}
              >
                <ChevronDown
                  className={`mr-1 h-4 w-4 transition-transform ${showIndices ? "rotate-180" : ""}`}
                />
                {showIndices ? "Ocultar CAC cargados" : "Ver CAC cargados"}
              </Button>
            </div>
            {showIndices && (
              <div className="mt-3 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Fuente / nota</TableHead>
                      <TableHead>Cargado por</TableHead>
                      <TableHead className="w-40" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          No hay CAC cargados
                        </TableCell>
                      </TableRow>
                    ) : (
                      indices.map((indice) => {
                        const isEditing = editingPeriodo === indice.periodo;
                        return (
                          <TableRow key={indice.id}>
                            <TableCell className="font-mono text-sm">
                              {indice.periodo}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingValor}
                                  onChange={(event) => setEditingValor(event.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                Number(indice.valor).toLocaleString("es-AR", {
                                  maximumFractionDigits: 2,
                                })
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  value={editingFuente}
                                  onChange={(event) => setEditingFuente(event.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                indice.fuente ?? indice.nota ?? "-"
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {indice.creadoPor ?? "-"}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => saveEditedIndice(indice.periodo)}
                                    disabled={savingIndice}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEditIndice}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditIndice(indice)}
                                    disabled={savingIndice}
                                  >
                                    <Edit2 className="mr-1 h-4 w-4" />
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteIndice(indice)}
                                    disabled={savingIndice}
                                    aria-label={`Borrar CAC ${indice.periodo}`}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
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
              {visibleSummaryCols.estado && <TableHead>Estado</TableHead>}
              {visibleSummaryCols.vencido && <TableHead>Vencido</TableHead>}
              {visibleSummaryCols.saldo && <TableHead>Saldo</TableHead>}
              {visibleSummaryCols.proximoVencimiento && (
                <TableHead>Proximo vencimiento</TableHead>
              )}
              <TableHead className="w-24" />
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
                  {visibleSummaryCols.lote && (
                    <TableCell className="font-mono text-sm">
                      {row.loteNumero}
                      <span className="ml-2 font-sans text-xs text-muted-foreground">
                        Mz {row.manzana ?? "-"} / Parc. {row.parcela ?? "-"}
                      </span>
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
                  {visibleSummaryCols.estado && (
                    <TableCell>
                      {row.cuentaEstado === "pendiente" ? (
                        <Badge className="gap-1 bg-amber-100 text-amber-800">
                          <AlertTriangle className="h-3 w-3" />
                          Pendiente creacion
                        </Badge>
                      ) : row.cuotasVencidas > 0 ? (
                        <Badge className="bg-red-100 text-red-700">
                          {row.cuotasVencidas} Vencida(s)
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Al dia
                        </Badge>
                      )}
                    </TableCell>
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
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/crm/cuotas/${row.reservaId}`}>
                        {row.cuentaEstado === "pendiente" ? "Crear" : "Ver"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
