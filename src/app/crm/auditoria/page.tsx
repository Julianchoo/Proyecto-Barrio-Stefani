"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import type { AuditLog } from "@/lib/schema";

type AuditRow = Omit<AuditLog, "createdAt"> & { createdAt: string; label: string };
type AuditResponse = { rows: AuditRow[]; hasMore: boolean; usuarios: string[] };
type UsuarioRow = { id: string; name: string; email: string };

const ALL = "todos";

const entidadLabels: Record<AuditRow["entidad"], string> = {
  lote: "Lote",
  reserva: "Reserva",
  lead: "Lead",
};

const entidadColors: Record<AuditRow["entidad"], string> = {
  lote: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  reserva: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  lead: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

const accionLabels: Record<AuditRow["accion"], string> = {
  crear: "Creó",
  editar: "Editó",
  eliminar: "Eliminó",
};

// Nombres legibles para los campos mas comunes; el resto se muestra separando el camelCase.
const fieldLabels: Record<string, string> = {
  estado: "Estado",
  leadId: "Lead",
  asignadoA: "Asignado a",
  reservadoPor: "Reservado por",
  nombreComprador: "Comprador",
  dniCuit: "DNI / CUIT",
  precioBase: "Precio base",
  precioTotalNum: "Precio total",
  formaPago: "Forma de pago",
  modalidadContrato: "Modalidad",
  fechaReserva: "Fecha reserva",
  fechaVencimiento: "Vencimiento",
  fechaFirma: "Firma",
  superficieM2: "Superficie m²",
  valorM2: "Valor m²",
};

function fieldLabel(key: string) {
  if (fieldLabels[key]) return fieldLabels[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function entidadHref(row: AuditRow) {
  if (row.entidad === "lote") return `/crm/lotes/${row.entidadId}`;
  if (row.entidad === "reserva") return `/crm/reservas/${row.entidadId}`;
  return null;
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [entidad, setEntidad] = useState(ALL);
  const [usuario, setUsuario] = useState(ALL);
  const [entidadId, setEntidadId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const fetchPage = useCallback(
    async (offset: number) => {
      setLoading(true);
      const params = new URLSearchParams({ offset: String(offset) });
      if (entidad !== ALL) params.set("entidad", entidad);
      if (usuario !== ALL) params.set("usuario", usuario);
      if (entidadId.trim()) params.set("entidadId", entidadId.trim());
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/crm/auditoria?${params}`);
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const data: AuditResponse = res.ok ? await res.json() : { rows: [], hasMore: false, usuarios: [] };
      setRows((current) => (offset === 0 ? data.rows : [...current, ...data.rows]));
      setHasMore(data.hasMore);
      setUsuarios(data.usuarios);
      setLoading(false);
    },
    [entidad, usuario, entidadId, desde, hasta]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchPage(0);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchPage]);

  // "Asignado a" de los leads guarda el id del usuario: se muestra su nombre.
  useEffect(() => {
    fetch("/api/crm/usuarios")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: UsuarioRow[]) =>
        setUserNames(new Map(data.map((item) => [item.id, item.name || item.email])))
      )
      .catch(() => setUserNames(new Map()));
  }, []);

  function formatValue(key: string, value: unknown) {
    if (value === null || value === undefined || value === "") return "—";
    if (key === "asignadoA" && typeof value === "string") return userNames.get(value) ?? value;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  if (forbidden) {
    return <p className="text-sm text-muted-foreground">Solo los administradores pueden ver la auditoría.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Auditoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cambios en lotes, reservas y leads: quién los hizo y cuándo
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1.5">
          <Label>Tipo</Label>
          <Select value={entidad} onValueChange={setEntidad}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="lote">Lotes</SelectItem>
              <SelectItem value="reserva">Reservas</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-id">ID</Label>
          <Input
            id="audit-id"
            inputMode="numeric"
            placeholder="ID de lote, reserva o lead"
            value={entidadId}
            onChange={(e) => setEntidadId(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Usuario</Label>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {usuarios.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "web" ? "Formulario web" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-desde">Desde</Label>
          <Input id="audit-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-hasta">Hasta</Label>
          <Input id="audit-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-40">Fecha</TableHead>
              <TableHead className="w-52">Usuario</TableHead>
              <TableHead className="w-64">Qué</TableHead>
              <TableHead>Cambios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = entidadHref(row);
              const cambios = Object.entries(row.cambios);
              return (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="text-sm">
                    {row.usuario === "web" ? "Formulario web" : row.usuario}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{accionLabels[row.accion]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entidadColors[row.entidad]}`}>
                        {entidadLabels[row.entidad]}
                      </span>
                    </div>
                    {href ? (
                      <Link href={href} className="mt-1 block font-medium text-foreground hover:underline">
                        {row.label}
                      </Link>
                    ) : (
                      <p className="mt-1 font-medium text-foreground">{row.label}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <ul className="space-y-0.5">
                      {cambios.map(([key, { antes, despues }]) => (
                        <li key={key} className="break-words">
                          <span className="text-muted-foreground">{fieldLabel(key)}: </span>
                          {row.accion === "editar" ? (
                            <>
                              <span className="text-red-700 line-through dark:text-red-400">
                                {formatValue(key, antes)}
                              </span>{" "}
                              →{" "}
                              <span className="font-medium text-green-700 dark:text-green-400">
                                {formatValue(key, despues)}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium">
                              {formatValue(key, row.accion === "crear" ? despues : antes)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              );
            })}
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay cambios registrados</p>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={loading} onClick={() => fetchPage(rows.length)}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
