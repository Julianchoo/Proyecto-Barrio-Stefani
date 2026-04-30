"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, List, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type CalendarEvent = {
  key: string;
  date: string;
  label: string;
  reserva: ReservaRow;
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
      ? [{
        key: `${reserva.id}-firma`,
        date: fechaFirma,
        label: `Lote ${reserva.loteNumero} - ${comprador}`,
        reserva,
      }]
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

export default function ReservasPage() {
  const { data: session } = useSession();
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [monthKey, setMonthKey] = useState(getMonthKey(new Date()));
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchReservas = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterEstado !== "all") params.set("estado", filterEstado);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/crm/reservas?${params}`);
    const data: ReservaRow[] = await res.json();
    setReservas(data);
    setLoading(false);
  }, [filterEstado, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchReservas();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchReservas]);

  const events = useMemo(() => buildEvents(reservas), [reservas]);
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

      const data = await res.json().catch(() => null) as { error?: string } | null;
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

  function canEditReserva(reserva: ReservaRow) {
    return (
      session?.user?.role === "admin" ||
      reserva.reservadoPor === session?.user?.email
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reservas por lote y estado
          </p>
        </div>
        <div className="inline-flex rounded-md border bg-white p-1">
          <Button
            type="button"
            variant={view === "lista" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("lista")}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
          <Button
            type="button"
            variant={view === "calendario" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("calendario")}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendario
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar comprador, DNI, lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="activa">Activas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
            <SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="realizada">Realizadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "lista" ? (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha reserva</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Reservado por</TableHead>
                <TableHead className="w-16" />
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
                : reservas.map((reserva) => (
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
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[reserva.estado]}`}>
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
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[reserva.estado]}`}>
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
                        {reserva.reservadoPor ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/crm/lotes/${reserva.parcelaId}`}>Ver</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!loading && reservas.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-8">
              No se encontraron reservas
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => moveMonth(-1)}>
              Anterior
            </Button>
            <h2 className="text-base font-semibold capitalize text-gray-900">
              {monthLabel}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={() => moveMonth(1)}>
              Siguiente
            </Button>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {weekdayNames.map((day) => (
                <div key={day} className="px-2 py-2 text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayEvents = day.date ? eventsByDate.get(day.date) ?? [] : [];
                return (
                  <div
                    key={`${day.date ?? "empty"}-${index}`}
                    className="min-h-32 border-b border-r p-2 last:border-r-0"
                  >
                    {day.day && (
                      <div className="mb-2 text-xs font-medium text-gray-500">
                        {day.day}
                      </div>
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
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 3} mas
                        </div>
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
