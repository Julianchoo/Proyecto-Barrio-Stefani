"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronDown, Download, FileText, Filter, List, Lock, Mail, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ReservaDialog } from "@/components/crm/reserva-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/lib/auth-client";
import type { EstadoParcela, EstadoReserva } from "@/lib/schema";

type ReservaRow = {
  id: number;
  parcelaId: number;
  leadId: number | null;
  estado: EstadoReserva;
  nombreComprador: string | null;
  dniCuit: string | null;
  telefono: string | null;
  emailComprador: string | null;
  reservadoPor: string | null;
  fechaReserva: string | null;
  fechaVencimiento: string | null;
  fechaFirma: string | null;
  formaPago: string | null;
  precioTotalNum: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
  loteEstado: EstadoParcela;
};

type UsuarioRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "comercial";
};

type CalendarEvent = {
  key: string;
  date: string;
  label: string;
  reserva: ReservaRow;
};

type ReservaFilters = {
  estado: EstadoReserva[];
  reservadoPor: string[];
  formaPago: string;
  fechaReservaDesde: string;
  fechaReservaHasta: string;
  fechaVencimientoDesde: string;
  fechaVencimientoHasta: string;
  fechaFirmaDesde: string;
  fechaFirmaHasta: string;
};

type SortKey =
  | "loteNumero"
  | "nombreComprador"
  | "estado"
  | "fechaReserva"
  | "fechaVencimiento"
  | "fechaFirma"
  | "precioTotalNum"
  | "reservadoPor";

type SortDirection = "asc" | "desc";

const defaultFilters: ReservaFilters = {
  estado: [],
  reservadoPor: [],
  formaPago: "",
  fechaReservaDesde: "",
  fechaReservaHasta: "",
  fechaVencimientoDesde: "",
  fechaVencimientoHasta: "",
  fechaFirmaDesde: "",
  fechaFirmaHasta: "",
};

const estadoLabels: Record<EstadoReserva, string> = {
  activa: "Activa",
  cancelada: "Cancelada",
  vencida: "Vencida",
  realizada: "Realizada",
};

const estadoColors: Record<EstadoReserva, string> = {
  activa: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-700",
  vencida: "bg-amber-100 text-amber-700",
  realizada: "bg-blue-100 text-blue-700",
};

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const weekdayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function formatDate(value: string | null) {
  const dateKey = normalizeDateKey(value);
  if (!dateKey) return "-";
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function normalizeDateKey(value: string | null) {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1);
}

function buildEvents(reservas: ReservaRow[]): CalendarEvent[] {
  return reservas.flatMap((reserva): CalendarEvent[] => {
    const comprador = reserva.nombreComprador ?? "Sin comprador";
    const fechaFirma = normalizeDateKey(reserva.fechaFirma);
    return fechaFirma
      ? [
          {
            key: `${reserva.id}-firma`,
            date: fechaFirma,
            label: `Lote ${reserva.loteNumero} - ${comprador}`,
            reserva,
          },
        ]
      : [];
  });
}

function buildCalendarDays(monthKey: string) {
  const firstDay = parseMonthKey(monthKey);
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayStartIndex = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < mondayStartIndex; i++) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ReservasPage() {
  const { data: session } = useSession();
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReservaFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<ReservaFilters>(defaultFilters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    for (const estado of filters.estado) params.append("estado", estado);
    for (const email of filters.reservadoPor) params.append("reservadoPor", email);
    if (filters.formaPago.trim()) params.set("formaPago", filters.formaPago.trim());
    if (filters.fechaReservaDesde) params.set("fechaReservaDesde", filters.fechaReservaDesde);
    if (filters.fechaReservaHasta) params.set("fechaReservaHasta", filters.fechaReservaHasta);
    if (filters.fechaVencimientoDesde) {
      params.set("fechaVencimientoDesde", filters.fechaVencimientoDesde);
    }
    if (filters.fechaVencimientoHasta) {
      params.set("fechaVencimientoHasta", filters.fechaVencimientoHasta);
    }
    if (filters.fechaFirmaDesde) params.set("fechaFirmaDesde", filters.fechaFirmaDesde);
    if (filters.fechaFirmaHasta) params.set("fechaFirmaHasta", filters.fechaFirmaHasta);
    if (search.trim()) params.set("search", search.trim());
    return params;
  }, [filters, search]);

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    const params = buildFilterParams();
    const res = await fetch(`/api/crm/reservas?${params}`);
    const data: ReservaRow[] = await res.json();
    setReservas(data);
    setLoading(false);
  }, [buildFilterParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchReservas();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchReservas]);

  useEffect(() => {
    if (session?.user?.role !== "admin") return;
    fetch("/api/crm/usuarios")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: UsuarioRow[]) => {
        setUsuarios(data.filter((usuario) => usuario.role === "comercial"));
      })
      .catch(() => setUsuarios([]));
  }, [session?.user?.role]);

  const events = useMemo(() => buildEvents(reservas), [reservas]);
  const sortedReservas = useMemo(() => {
    if (!sort) return reservas;

    return [...reservas].sort((a, b) => {
      let result = 0;

      if (sort.key === "loteNumero") {
        result = a.loteNumero - b.loteNumero;
      } else if (sort.key === "precioTotalNum") {
        const priceA = Number(a.precioTotalNum ?? 0);
        const priceB = Number(b.precioTotalNum ?? 0);
        result = priceA - priceB;
      } else if (
        sort.key === "fechaReserva" ||
        sort.key === "fechaVencimiento" ||
        sort.key === "fechaFirma"
      ) {
        result = (a[sort.key] ?? "").localeCompare(b[sort.key] ?? "");
      } else {
        result = (a[sort.key] ?? "").localeCompare(b[sort.key] ?? "", "es-AR", {
          sensitivity: "base",
        });
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [reservas, sort]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => buildCalendarDays(monthKey), [monthKey]);
  const activeMonth = parseMonthKey(monthKey);
  const monthLabel = `${monthNames[activeMonth.getMonth()]} ${activeMonth.getFullYear()}`;
  const activeFilters = useMemo(() => {
    const items: Array<{ key: keyof ReservaFilters; label: string }> = [];
    if (filters.estado.length > 0) {
      items.push({
        key: "estado",
        label: `Estado: ${filters.estado.map((estado) => estadoLabels[estado]).join(", ")}`,
      });
    }
    if (filters.reservadoPor.length > 0) {
      const labels = filters.reservadoPor.map((email) => {
        const usuario = usuarios.find((item) => item.email === email);
        return usuario?.name || email;
      });
      items.push({
        key: "reservadoPor",
        label: `Comercial: ${labels.join(", ")}`,
      });
    }
    if (filters.formaPago.trim()) {
      items.push({ key: "formaPago", label: `Pago: ${filters.formaPago.trim()}` });
    }
    if (filters.fechaReservaDesde) {
      items.push({ key: "fechaReservaDesde", label: `Reserva desde ${formatDate(filters.fechaReservaDesde)}` });
    }
    if (filters.fechaReservaHasta) {
      items.push({ key: "fechaReservaHasta", label: `Reserva hasta ${formatDate(filters.fechaReservaHasta)}` });
    }
    if (filters.fechaVencimientoDesde) {
      items.push({
        key: "fechaVencimientoDesde",
        label: `Vence desde ${formatDate(filters.fechaVencimientoDesde)}`,
      });
    }
    if (filters.fechaVencimientoHasta) {
      items.push({
        key: "fechaVencimientoHasta",
        label: `Vence hasta ${formatDate(filters.fechaVencimientoHasta)}`,
      });
    }
    if (filters.fechaFirmaDesde) {
      items.push({ key: "fechaFirmaDesde", label: `Firma desde ${formatDate(filters.fechaFirmaDesde)}` });
    }
    if (filters.fechaFirmaHasta) {
      items.push({ key: "fechaFirmaHasta", label: `Firma hasta ${formatDate(filters.fechaFirmaHasta)}` });
    }
    return items;
  }, [filters, usuarios]);

  function moveMonth(delta: number) {
    const next = parseMonthKey(monthKey);
    next.setMonth(next.getMonth() + delta);
    setMonthKey(getMonthKey(next));
  }

  async function handleEstadoChange(reserva: ReservaRow, estado: EstadoReserva) {
    if (reserva.estado === estado) return;
    if (!canEditReserva(reserva)) {
      toast.error("Solo el comercial que tomó la reserva o un administrador puede modificarla");
      return;
    }
    setUpdatingId(reserva.id);
    try {
      const res = await fetch(`/api/crm/reservas/${reserva.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });

      if (res.ok) {
        toast.success("Reserva actualizada");
        await fetchReservas();
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        toast.error(data?.error ?? "Este lote ya tiene una reserva activa");
      } else {
        toast.error(data?.error ?? "No se pudo actualizar la reserva");
      }
    } catch {
      toast.error("No se pudo actualizar la reserva");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleComercialChange(reserva: ReservaRow, reservadoPor: string) {
    if (reserva.reservadoPor === reservadoPor) return;
    if (session?.user?.role !== "admin") {
      toast.error("Solo un administrador puede reasignar reservas");
      return;
    }
    setUpdatingId(reserva.id);
    try {
      const res = await fetch(`/api/crm/reservas/${reserva.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservadoPor }),
      });

      if (res.ok) {
        toast.success("Reserva reasignada");
        await fetchReservas();
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "No se pudo reasignar la reserva");
    } catch {
      toast.error("No se pudo reasignar la reserva");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSendSummary() {
    setSendingSummary(true);
    try {
      const res = await fetch("/api/crm/reservas/enviar-resumen", {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as {
        count?: number;
        error?: string;
        skipped?: boolean;
      } | null;

      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo enviar el resumen");
        return;
      }

      if (data?.skipped) {
        toast.info("No hay firmas previstas para la semana siguiente");
        return;
      }

      toast.success(`Resumen enviado${data?.count ? ` (${data.count})` : ""}`);
    } catch {
      toast.error("No se pudo enviar el resumen");
    } finally {
      setSendingSummary(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/crm/reservas/export?${params}`);
      if (!res.ok) {
        toast.error("No se pudo generar el Excel");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Reservas_Barrio_Stefani_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el Excel");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleDeleteReserva(reserva: ReservaRow) {
    if (session?.user?.role !== "admin") return;
    const comprador = reserva.nombreComprador ?? `lote ${reserva.loteNumero}`;
    if (!window.confirm(`Borrar la reserva de ${comprador}?`)) return;

    setDeletingId(reserva.id);
    try {
      const res = await fetch(`/api/crm/reservas/${reserva.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Reserva borrada");
        await fetchReservas();
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "No se pudo borrar la reserva");
    } catch {
      toast.error("No se pudo borrar la reserva");
    } finally {
      setDeletingId(null);
    }
  }

  function openFilters() {
    setDraftFilters(filters);
    setFilterSheetOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFilterSheetOpen(false);
  }

  function clearFilters() {
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
    setFilterSheetOpen(false);
  }

  function removeFilter(key: keyof ReservaFilters) {
    setFilters((current) => ({
      ...current,
      [key]: key === "estado" || key === "reservadoPor" ? [] : "",
    }));
  }

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function SortHeader({ sortKey, children }: { sortKey: SortKey; children: ReactNode }) {
    const isActive = sort?.key === sortKey;
    const Icon = !isActive ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleSort(sortKey)}
        className="-ml-3 h-8 px-3"
      >
        {children}
        <Icon className="ml-1 h-3.5 w-3.5" />
      </Button>
    );
  }

  function canEditReserva(reserva: ReservaRow) {
    return session?.user?.role === "admin" || reserva.reservadoPor === session?.user?.email;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="mt-1 text-sm text-gray-500">Reservas por lote y estado</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
          >
            <Download className="mr-1 h-4 w-4" />
            {exportingExcel ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSendSummary}
            disabled={sendingSummary}
          >
            <Mail className="mr-1 h-4 w-4" />
            {sendingSummary ? "Enviando..." : "Enviar resumen"}
          </Button>
          <div className="inline-flex rounded-md border bg-white p-1">
            <Button
              type="button"
              variant={view === "lista" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("lista")}
            >
              <List className="mr-1 h-4 w-4" />
              Lista
            </Button>
            <Button
              type="button"
              variant={view === "calendario" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendario")}
            >
              <CalendarDays className="mr-1 h-4 w-4" />
              Calendario
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar comprador, DNI, lote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" onClick={openFilters} className="justify-start">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {activeFilters.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {activeFilters.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Filtros de reservas</SheetTitle>
              </SheetHeader>
              <div className="grid flex-1 auto-rows-min gap-5 px-4">
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="justify-between">
                        {draftFilters.estado.length
                          ? draftFilters.estado.map((estado) => estadoLabels[estado]).join(", ")
                          : "Todos los estados"}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64">
                      {(Object.keys(estadoLabels) as EstadoReserva[]).map((estado) => (
                        <DropdownMenuCheckboxItem
                          key={estado}
                          checked={draftFilters.estado.includes(estado)}
                          onCheckedChange={() =>
                            setDraftFilters((current) => ({
                              ...current,
                              estado: toggleValue(current.estado, estado),
                            }))
                          }
                          onSelect={(event) => event.preventDefault()}
                        >
                          {estadoLabels[estado]}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {session?.user?.role === "admin" && (
                  <div className="grid gap-2">
                    <Label>Comercial</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-between"
                          disabled={usuarios.length === 0}
                        >
                          {draftFilters.reservadoPor.length
                            ? draftFilters.reservadoPor
                                .map((email) => usuarios.find((usuario) => usuario.email === email)?.name || email)
                                .join(", ")
                            : "Todos los comerciales"}
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-72">
                        {usuarios.map((usuario) => (
                          <DropdownMenuCheckboxItem
                            key={usuario.id}
                            checked={draftFilters.reservadoPor.includes(usuario.email)}
                            onCheckedChange={() =>
                              setDraftFilters((current) => ({
                                ...current,
                                reservadoPor: toggleValue(current.reservadoPor, usuario.email),
                              }))
                            }
                            onSelect={(event) => event.preventDefault()}
                          >
                            {usuario.name || usuario.email}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="forma-pago-filter">Forma de pago</Label>
                  <Input
                    id="forma-pago-filter"
                    value={draftFilters.formaPago}
                    onChange={(e) =>
                      setDraftFilters((current) => ({ ...current, formaPago: e.target.value }))
                    }
                    placeholder="Contado, cuotas..."
                  />
                </div>

                <Separator />

                <div className="grid gap-3">
                  <Label>Fecha de reserva</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={draftFilters.fechaReservaDesde}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaReservaDesde: e.target.value,
                        }))
                      }
                      aria-label="Fecha de reserva desde"
                    />
                    <Input
                      type="date"
                      value={draftFilters.fechaReservaHasta}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaReservaHasta: e.target.value,
                        }))
                      }
                      aria-label="Fecha de reserva hasta"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <Label>Vencimiento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={draftFilters.fechaVencimientoDesde}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaVencimientoDesde: e.target.value,
                        }))
                      }
                      aria-label="Fecha de vencimiento desde"
                    />
                    <Input
                      type="date"
                      value={draftFilters.fechaVencimientoHasta}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaVencimientoHasta: e.target.value,
                        }))
                      }
                      aria-label="Fecha de vencimiento hasta"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <Label>Firma</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={draftFilters.fechaFirmaDesde}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaFirmaDesde: e.target.value,
                        }))
                      }
                      aria-label="Fecha de firma desde"
                    />
                    <Input
                      type="date"
                      value={draftFilters.fechaFirmaHasta}
                      onChange={(e) =>
                        setDraftFilters((current) => ({
                          ...current,
                          fechaFirmaHasta: e.target.value,
                        }))
                      }
                      aria-label="Fecha de firma hasta"
                    />
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button type="button" onClick={applyFilters}>
                  Aplicar filtros
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpiar
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {activeFilters.length > 0 && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
                {filter.label}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.key)}
                  className="rounded-full p-0.5 hover:bg-black/10"
                  aria-label={`Quitar filtro ${filter.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {view === "lista" ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader sortKey="loteNumero">Lote</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="nombreComprador">Comprador</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="estado">Estado</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="fechaReserva">Fecha reserva</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="fechaVencimiento">Vencimiento</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="fechaFirma">Firma</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="precioTotalNum">Precio</SortHeader>
                </TableHead>
                <TableHead>
                  <SortHeader sortKey="reservadoPor">Reservado por</SortHeader>
                </TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : sortedReservas.map((reserva) => (
                    <TableRow key={reserva.id}>
                      <TableCell className="font-mono text-sm">
                        {reserva.loteNumero}
                        <span className="ml-2 font-sans text-xs text-gray-500">
                          Mz {reserva.manzana ?? "-"} / Parc. {reserva.parcela ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {reserva.nombreComprador ?? "-"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {reserva.dniCuit ?? reserva.emailComprador ?? reserva.telefono ?? "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEditReserva(reserva) ? (
                          <Select
                            value={reserva.estado}
                            onValueChange={(value) =>
                              handleEstadoChange(reserva, value as EstadoReserva)
                            }
                            disabled={updatingId === reserva.id}
                          >
                            <SelectTrigger className="h-7 w-32 border-0 p-0 shadow-none focus:ring-0">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColors[reserva.estado]}`}
                              >
                                {estadoLabels[reserva.estado]}
                              </span>
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {(Object.keys(estadoLabels) as EstadoReserva[]).map((estado) => (
                                <SelectItem key={estado} value={estado}>
                                  {estadoLabels[estado]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColors[reserva.estado]}`}
                            >
                              {estadoLabels[reserva.estado]}
                            </span>
                            <Lock className="h-3 w-3 text-amber-600" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(reserva.fechaReserva)}</TableCell>
                      <TableCell>{formatDate(reserva.fechaVencimiento)}</TableCell>
                      <TableCell>{formatDate(reserva.fechaFirma)}</TableCell>
                      <TableCell>
                        {reserva.precioTotalNum ? `USD ${reserva.precioTotalNum}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {session?.user?.role === "admin" ? (
                          <Select
                            value={reserva.reservadoPor ?? ""}
                            onValueChange={(value) => handleComercialChange(reserva, value)}
                            disabled={updatingId === reserva.id || usuarios.length === 0}
                          >
                            <SelectTrigger className="h-8 w-56">
                              <SelectValue placeholder="Sin comercial" />
                            </SelectTrigger>
                            <SelectContent>
                              {usuarios.map((usuario) => (
                                <SelectItem key={usuario.id} value={usuario.email}>
                                  {usuario.name || usuario.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          reserva.reservadoPor ?? "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <ReservaDialog
                            parcelaId={reserva.parcelaId}
                            disabled={!canEditReserva(reserva)}
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!canEditReserva(reserva)}
                              >
                                <FileText className="mr-1 h-4 w-4" />
                                Reserva
                              </Button>
                            }
                          />
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/crm/lotes/${reserva.parcelaId}`}>Ver</Link>
                          </Button>
                          {session?.user?.role === "admin" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteReserva(reserva)}
                              disabled={deletingId === reserva.id}
                              aria-label={`Borrar reserva ${reserva.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!loading && reservas.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No se encontraron reservas</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => moveMonth(-1)}>
              Anterior
            </Button>
            <h2 className="text-base font-semibold text-gray-900 capitalize">{monthLabel}</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => moveMonth(1)}>
              Siguiente
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {weekdayNames.map((day) => (
                <div key={day} className="px-2 py-2 text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayEvents = day.date ? (eventsByDate.get(day.date) ?? []) : [];
                return (
                  <div
                    key={`${day.date ?? "empty"}-${index}`}
                    className="min-h-32 border-r border-b p-2 last:border-r-0"
                  >
                    {day.day && (
                      <div className="mb-2 text-xs font-medium text-gray-500">{day.day}</div>
                    )}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <Link
                          key={event.key}
                          href={`/crm/lotes/${event.reserva.parcelaId}`}
                          className={`block truncate rounded px-1.5 py-1 text-xs ${estadoColors[event.reserva.estado]}`}
                          title={event.label}
                        >
                          {event.label}
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">+{dayEvents.length - 3} mas</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!loading && events.length === 0 && (
            <p className="rounded-lg border bg-white px-4 py-6 text-center text-sm text-gray-500">
              No hay reservas con fecha de firma en este filtro
            </p>
          )}
        </div>
      )}
    </div>
  );
}
