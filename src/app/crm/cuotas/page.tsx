"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Edit2,
  Filter,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  contratoId: number;
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
  proximoVencimiento: string | null;
  proximaCuotaMonto: number | null;
  moneda: MonedaPago;
};

const modalidadLabels: Record<ModalidadContrato, string> = {
  usd_fijo: "USD fijo",
  pesos_cac: "Pesos + CAC",
  requiere_revision: "Revisar",
};

function formatMoney(value: number | null, moneda: MonedaPago) {
  if (value === null) return "-";
  const prefix = moneda === "usd" ? "USD" : "$";
  return `${prefix} ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function CuotasPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<CuentaRow[]>([]);
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

  useEffect(() => {
    if (!session) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, session]);

  useEffect(() => {
    if (session?.user?.role === "admin") {
      void fetchIndices();
    }
  }, [session?.user?.role]);

  if (session && session.user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Solo un administrador puede ver cuentas corrientes y cuotas.
        </CardContent>
      </Card>
    );
  }

  async function saveIndice() {
    const numericValue = Number(valor);
    if (!periodo || !Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Cargá período y valor CAC");
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
        toast.error(data?.error ?? "No se pudo guardar el índice");
        return;
      }
      toast.success("Índice CAC guardado");
      setValor("");
      setFuente("");
      await fetchIndices();
      await fetchRows();
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
      toast.error("CargÃ¡ un valor CAC vÃ¡lido");
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
    } finally {
      setSavingIndice(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cuotas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cuenta corriente por lote vendido
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
          <CircleDollarSign className="h-4 w-4 text-green-700" />
          <span>{rows.length} cuentas activas</span>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
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
                <SelectItem value="pendiente_indice">Falta CAC</SelectItem>
                <SelectItem value="al_dia">Al día</SelectItem>
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
            <Button type="button" variant="outline" onClick={fetchRows}>
              <Filter className="mr-1 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {session?.user?.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Índice CAC mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[150px_160px_1fr_auto] md:items-end">
              <div className="grid gap-2">
                <Label>Período</Label>
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
                      <TableHead>PerÃ­odo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Fuente / nota</TableHead>
                      <TableHead>Cargado por</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-gray-500">
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
                            <TableCell className="text-sm text-gray-500">
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
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditIndice(indice)}
                                >
                                  <Edit2 className="mr-1 h-4 w-4" />
                                  Editar
                                </Button>
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

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vencido</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Próximo vencimiento</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                  No hay cuentas corrientes para este filtro
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.contratoId}>
                  <TableCell className="font-mono text-sm">
                    {row.loteNumero}
                    <span className="ml-2 font-sans text-xs text-gray-500">
                      Mz {row.manzana ?? "-"} / Parc. {row.parcela ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">
                      {row.comprador ?? "-"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {row.dniCuit ?? row.email ?? row.telefono ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell>{modalidadLabels[row.modalidad]}</TableCell>
                  <TableCell>
                    {row.cuotasPendienteIndice > 0 ? (
                      <Badge className="gap-1 bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        Falta CAC
                      </Badge>
                    ) : row.cuotasVencidas > 0 ? (
                      <Badge className="bg-red-100 text-red-700">
                        {row.cuotasVencidas} vencida(s)
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Al día
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatMoney(row.totalVencido, row.moneda)}</TableCell>
                  <TableCell>{formatMoney(row.saldoPendiente, row.moneda)}</TableCell>
                  <TableCell>
                    <div>{formatDate(row.proximoVencimiento)}</div>
                    <div className="text-xs text-gray-500">
                      {formatMoney(row.proximaCuotaMonto, row.moneda)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/crm/cuotas/${row.reservaId}`}>Ver</Link>
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
