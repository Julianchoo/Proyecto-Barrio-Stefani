"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CreditCard,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { parsePaymentDate } from "@/app/crm/cuotas/[reservaId]/payment-date";
import { TiposCambioCard } from "@/components/crm/tipos-cambio-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate } from "@/lib/reservas-ui";
import type {
  Contrato,
  Cuota,
  ModalidadContrato,
  MonedaPago,
  Pago,
  Reserva,
  IndiceCac,
} from "@/lib/schema";

type CuentaDetail = {
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
  cuotasProyectadas: number;
  proximoVencimiento: string | null;
  proximaCuotaMonto: number | null;
  moneda: MonedaPago;
  contrato: Contrato;
  reserva: Reserva;
  cuotas: Cuota[];
  pagos: Pago[];
  indices: IndiceCac[];
  totalCobradoUsd: number | null;
  totalFuturoUsd: number | null;
  anticipoCobradoUsd: number;
  tipoCambioActual: number | null;
  fechasPagoSinTipoCambio: string[];
};

type CuentaCancelada = { contrato: Contrato; pagos: Pago[] };

type ReservaForCuenta = Pick<
  Reserva,
  "id" | "estado" | "formaPago" | "modalidadContrato" | "nombreComprador" | "reservadoPor"
> & {
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
};

const estadoColors: Record<string, string> = {
  pendiente: "bg-muted text-muted-foreground",
  pendiente_indice: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  parcial: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  pagada: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  vencida: "bg-destructive/10 text-destructive",
  calculada: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  proyectada: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  parcial_vencida: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  cancelada: "bg-muted text-muted-foreground",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_indice: "Falta CAC",
  parcial: "Parcial",
  pagada: "Pagada",
  vencida: "Vencida",
  calculada: "Calculada",
  proyectada: "Proyectada",
  parcial_vencida: "Parcial vencida",
  cancelada: "Cancelada",
};

const modalidadLabels: Record<ModalidadContrato, string> = {
  usd_fijo: "USD fijo",
  pesos_cac: "Pesos + CAC",
  requiere_revision: "Requiere revisión",
};

function formatMoney(value: number | string | null, moneda: MonedaPago) {
  if (value === null || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const prefix = moneda === "usd" ? "USD" : "$";
  return `${prefix} ${amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatIndex(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// dd/mm/yyyy para el input de fecha del pago (lo lee parsePaymentDate)
function toInputDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const monthLabels = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function currentYear() {
  return new Date().getFullYear();
}

function yearFromPeriod(period: string) {
  return Number(period.slice(0, 4)) || currentYear();
}

function monthPeriod(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function formatPeriod(period: string) {
  if (!period) return "Elegir período";
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  return `${monthLabels[monthIndex] ?? month} ${year}`;
}

export default function CuentaDetallePage() {
  const { reservaId } = useParams<{ reservaId: string }>();
  const { data: session } = useSession();
  const [detail, setDetail] = useState<CuentaDetail | null>(null);
  const [reservaForCuenta, setReservaForCuenta] = useState<ReservaForCuenta | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [payingCuota, setPayingCuota] = useState<Cuota | null>(null);
  const [editingPayment, setEditingPayment] = useState<Pago | null>(null);
  const [paymentObservation, setPaymentObservation] = useState("");
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => toInputDate(todayKey()));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentRate, setPaymentRate] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [registeringPayment, setRegisteringPayment] = useState(false);
  const [uploadingReceiptId, setUploadingReceiptId] = useState<number | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [createModalidad, setCreateModalidad] = useState<ModalidadContrato>("requiere_revision");
  const [periodoBaseCac, setPeriodoBaseCac] = useState("");
  const [indicesCac, setIndicesCac] = useState<IndiceCac[]>([]);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [periodPickerYear, setPeriodPickerYear] = useState(currentYear());
  const [tipoCambioBna, setTipoCambioBna] = useState("");
  const [canceladas, setCanceladas] = useState<CuentaCancelada[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const sortedPayments = useMemo(
    () => [...(detail?.pagos ?? [])].sort((a, b) => b.fechaPago.localeCompare(a.fechaPago)),
    [detail?.pagos]
  );
  const loadedCacPeriods = useMemo(
    () => new Set(indicesCac.map((indice) => indice.periodo)),
    [indicesCac]
  );
  const cacByPeriod = useMemo(
    () => new Map(indicesCac.map((indice) => [indice.periodo, indice.valor])),
    [indicesCac]
  );
  const baseCacValue =
    detail?.contrato.indiceBaseCac ??
    (detail?.contrato.periodoBaseCac
      ? (cacByPeriod.get(detail.contrato.periodoBaseCac) ?? null)
      : null);

  async function fetchIndicesCac() {
    const res = await fetch("/api/crm/indices-cac");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudieron cargar los CAC. Recargá la página; si sigue, avisale a un administrador");
      return [];
    }
    const rows = data as IndiceCac[];
    setIndicesCac(rows);
    return rows;
  }

  async function fetchReservaForCuenta() {
    const res = await fetch(`/api/crm/reservas/${reservaId}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo cargar la reserva. Recargá la página; si sigue, avisale a un administrador");
      return null;
    }
    return data as ReservaForCuenta;
  }

  async function fetchTipoCambioBna() {
    const res = await fetch("/api/tipo-cambio/bna");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.sell) {
      setTipoCambioBna(String(data.sell));
    }
  }

  async function fetchDetail() {
    setLoading(true);
    setMissing(false);
    setReservaForCuenta(null);
    try {
      void fetch(`/api/crm/reservas/${reservaId}/cuentas-canceladas`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setCanceladas)
        .catch(() => setCanceladas([]));
      const res = await fetch(`/api/crm/reservas/${reservaId}/cuenta-corriente`);
      if (res.status === 404) {
        const reserva = await fetchReservaForCuenta();
        if (!reserva) return;
        setReservaForCuenta(reserva);
        setCreateModalidad(reserva.modalidadContrato ?? "requiere_revision");
        if (reserva.modalidadContrato === "pesos_cac") {
          await fetchTipoCambioBna();
          await fetchIndicesCac();
        }
        setMissing(true);
        setDetail(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo cargar la cuenta corriente. Recargá la página; si sigue, avisale a un administrador");
        return;
      }
      const data: CuentaDetail = await res.json();
      setDetail(data);
      setIndicesCac(data.indices);
      setCreateModalidad(
        data.reserva.modalidadContrato ?? data.contrato.modalidad ?? "requiere_revision"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.role !== "admin") return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaId, session?.user?.role]);

  async function createContrato() {
    if (reservaForCuenta?.formaPago === "contado") return;
    if (createModalidad === "requiere_revision") {
      toast.error("Elegí la modalidad (USD fijo o Pesos + CAC) antes de crear la cuenta corriente");
      return;
    }
    const parsedTipoCambioBna = Number(tipoCambioBna);
    if (
      createModalidad === "pesos_cac" &&
      (!Number.isFinite(parsedTipoCambioBna) || parsedTipoCambioBna <= 0)
    ) {
      toast.error("Ingresá el tipo de cambio BNA vendedor (mayor a 0) para generar cuotas en Pesos + CAC");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/crm/reservas/${reservaId}/contrato`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modalidad: createModalidad,
          tipoCambioBna: createModalidad === "pesos_cac" ? parsedTipoCambioBna : null,
          periodoBaseCac: createModalidad === "pesos_cac" ? periodoBaseCac || null : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo crear la cuenta corriente");
        return;
      }
      toast.success("Cuenta corriente creada");
      await fetchDetail();
    } finally {
      setCreating(false);
    }
  }

  async function registerPayment() {
    if ((!payingCuota && !editingPayment) || !detail || registeringPayment) return;
    const fechaPago = parsePaymentDate(paymentDate);
    if (!fechaPago) {
      toast.error("Ingresá una fecha válida en formato dd/mm/yyyy");
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresá un monto mayor a 0");
      return;
    }
    const rate = Number(paymentRate);
    if (paymentRate && (!Number.isFinite(rate) || rate <= 0)) {
      toast.error("Ingresá un tipo de cambio mayor a 0, o dejalo vacío para usar el BNA vendedor");
      return;
    }

    setRegisteringPayment(true);
    try {
      const formData = new FormData();
      formData.set("fechaPago", fechaPago);
      formData.set("monto", String(amount));
      formData.set("moneda", editingPayment?.moneda ?? detail.moneda);
      formData.set("observacion", paymentObservation);
      formData.set("quitarComprobante", String(removeReceipt));
      if (paymentMethod) formData.set("medio", paymentMethod);
      if (paymentRate) formData.set("tipoCambio", String(rate));
      if (paymentReceipt) formData.set("comprobante", paymentReceipt);

      const res = await fetch(
        editingPayment
          ? `/api/crm/pagos/${editingPayment.id}`
          : `/api/crm/cuotas/${payingCuota!.id}/pagos`,
        {
          method: editingPayment ? "PATCH" : "POST",
          body: formData,
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar el pago");
        return;
      }
      toast.success(editingPayment ? "Pago actualizado" : "Pago registrado");
      setEditingPayment(null);
      setPayingCuota(null);
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentRate("");
      setPaymentReceipt(null);
      await fetchDetail();
    } catch {
      toast.error("No se pudo guardar el pago. Revisá la conexión y volvé a intentar.");
    } finally {
      setRegisteringPayment(false);
    }
  }

  async function attachPaymentReceipt(pagoId: number, comprobante: File) {
    if (uploadingReceiptId !== null) return;
    setUploadingReceiptId(pagoId);
    try {
      const formData = new FormData();
      formData.set("comprobante", comprobante);
      const res = await fetch(`/api/crm/pagos/${pagoId}/comprobante`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo adjuntar el comprobante");
        return;
      }
      toast.success("Comprobante adjuntado");
      await fetchDetail();
    } finally {
      setUploadingReceiptId(null);
    }
  }

  async function deletePayment(pago: Pago) {
    if (
      !window.confirm(
        `¿Borrar el pago de ${formatMoney(pago.monto, pago.moneda)} del ${formatDate(pago.fechaPago)}? No se puede deshacer.`
      )
    )
      return;
    setDeletingPaymentId(pago.id);
    try {
      const res = await fetch(`/api/crm/pagos/${pago.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo borrar el pago");
        return;
      }
      toast.success("Pago borrado");
      await fetchDetail();
    } finally {
      setDeletingPaymentId(null);
    }
  }

  async function cancelCuenta() {
    if (!detail || cancelling) return;
    const pagosActivos = detail.pagos.filter((pago) => pago.estado === "activo").length;
    const aviso =
      pagosActivos > 0
        ? `\n\nOJO: tiene ${pagosActivos} pago(s) registrado(s). Quedan guardados en la cuenta cancelada y vas a tener que cargarlos de nuevo en la cuenta nueva.`
        : "";
    if (
      !window.confirm(
        `¿Cancelar esta cuenta corriente?\n\nNo se borra: queda guardada como historial (cuotas y pagos) y deja de contar para la cobranza. Después podés corregir la reserva y generar una cuenta nueva.${aviso}`
      )
    )
      return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/crm/reservas/${reservaId}/cuentas-canceladas`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo cancelar la cuenta corriente");
        return;
      }
      toast.success("Cuenta corriente cancelada. Ya podés corregir la reserva.");
      await fetchDetail();
    } finally {
      setCancelling(false);
    }
  }

  async function copyMessage() {
    const res = await fetch(`/api/crm/reservas/${reservaId}/mensaje-cuotas`, {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo generar el mensaje");
      return;
    }
    await navigator.clipboard.writeText(data.message);
    toast.success("Mensaje copiado");
  }

  if (session && session.user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Solo un administrador puede ver cuentas corrientes y cuotas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/crm/cuotas">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver a cuotas
            </Link>
          </Button>
          <h1 className="mt-2 font-serif text-3xl font-normal text-foreground">Cuenta corriente</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/crm/reservas/${reservaId}`}>
              <ExternalLink className="mr-1 h-4 w-4" />
              Ver reserva
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={fetchDetail}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Actualizar
          </Button>
          {detail && !missing && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={cancelCuenta}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-1 h-4 w-4" />
              )}
              Cancelar cuenta corriente
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </CardContent>
        </Card>
      ) : missing && reservaForCuenta?.formaPago === "contado" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Reserva de contado</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Esta reserva esta registrada como contado. No corresponde generar cuenta corriente ni
              cuotas.
            </p>
            <div className="bg-muted/40 rounded-md border px-3 py-2">
              <p className="text-foreground font-medium">
                Manzana {reservaForCuenta.manzana ?? "-"} · Parcela {reservaForCuenta.parcela ?? "-"}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  Lote #{reservaForCuenta.loteNumero}
                </span>
              </p>
              <p className="mt-1">{reservaForCuenta.nombreComprador ?? "Comprador sin nombre"}</p>
            </div>
          </CardContent>
        </Card>
      ) : missing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Crear cuenta corriente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {canceladas.length > 0
                ? "La cuenta corriente anterior fue cancelada (está en el historial, abajo). Antes de crear la nueva, revisá que la reserva tenga las condiciones corregidas: la cuenta se genera con el saldo, las cuotas y el importe de la reserva."
                : "Esta reserva todavía no tiene contrato de cuotas. Solo se puede crear si la reserva está realizada y tiene datos suficientes de financiación."}
            </p>
            <div className="grid gap-3 sm:grid-cols-[220px_180px_180px_auto] sm:items-end">
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Select
                  value={createModalidad}
                  onValueChange={(value) => {
                    const next = value as ModalidadContrato;
                    setCreateModalidad(next);
                    if (next === "pesos_cac" && !tipoCambioBna) {
                      void fetchTipoCambioBna();
                    }
                    if (next === "pesos_cac" && indicesCac.length === 0) {
                      void fetchIndicesCac();
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requiere_revision" disabled>
                      Requiere revisión
                    </SelectItem>
                    <SelectItem value="usd_fijo">USD fijo</SelectItem>
                    <SelectItem value="pesos_cac">Pesos + CAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {createModalidad === "pesos_cac" && (
                <div className="relative grid gap-2">
                  <Label>Período base CAC</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setPeriodPickerYear(
                        periodoBaseCac ? yearFromPeriod(periodoBaseCac) : currentYear()
                      );
                      setShowPeriodPicker((value) => !value);
                    }}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatPeriod(periodoBaseCac)}
                  </Button>
                  {showPeriodPicker && (
                    <div className="bg-card absolute top-full left-0 z-10 mt-2 w-72 rounded-md border p-3 shadow-lg">
                      <div className="mb-3 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPeriodPickerYear((year) => year - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-foreground text-sm font-semibold">
                          {periodPickerYear}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPeriodPickerYear((year) => year + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {monthLabels.map((label, index) => {
                          const period = monthPeriod(periodPickerYear, index);
                          const hasCac = loadedCacPeriods.has(period);
                          const isSelected = periodoBaseCac === period;
                          return (
                            <Button
                              key={period}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className={
                                hasCac && !isSelected
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                                  : ""
                              }
                              onClick={() => {
                                setPeriodoBaseCac(period);
                                setShowPeriodPicker(false);
                              }}
                            >
                              {label}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Mes con CAC cargado
                      </div>
                    </div>
                  )}
                </div>
              )}
              {createModalidad === "pesos_cac" && (
                <div className="grid gap-2">
                  <Label>BNA vendedor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tipoCambioBna}
                    onChange={(event) => setTipoCambioBna(event.target.value)}
                  />
                </div>
              )}
              <Button
                type="button"
                onClick={createContrato}
                disabled={creating || createModalidad === "requiere_revision"}
              >
                {creating ? "Creando..." : "Crear cuenta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : detail ? (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Manzana {detail.manzana ?? "-"} · Parcela {detail.parcela ?? "-"}
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    Lote #{detail.loteNumero}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="text-foreground font-medium">{detail.comprador ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modalidad</p>
                  <p className="text-foreground font-medium">{modalidadLabels[detail.modalidad]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo pendiente</p>
                  <p className="text-foreground font-medium">
                    {formatMoney(detail.saldoPendiente, detail.moneda)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencido</p>
                  <p className="text-foreground font-medium">
                    {formatMoney(detail.totalVencido, detail.moneda)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Próxima cuota</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground text-2xl font-semibold">
                  {formatMoney(detail.proximaCuotaMonto, detail.moneda)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatDate(detail.proximoVencimiento)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Comunicación</CardTitle>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={copyMessage} className="w-full">
                  <Clipboard className="mr-1 h-4 w-4" />
                  Copiar mensaje
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.35fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Total cobrado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(detail.totalCobradoUsd, "usd")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Incluye anticipo de {formatMoney(detail.anticipoCobradoUsd, "usd")} y pagos
                  activos dolarizados a su fecha.
                </p>
                {detail.fechasPagoSinTipoCambio.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-400">
                    Falta BNA para completar:{" "}
                    {detail.fechasPagoSinTipoCambio.map(formatDate).join(", ")}.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Total pendiente a hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(detail.totalFuturoUsd, "usd")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Incluye cuotas vencidas y futuras. BNA vendedor actual:{" "}
                  {formatMoney(detail.tipoCambioActual, "ars")}.
                </p>
              </CardContent>
            </Card>

            <TiposCambioCard onSaved={fetchDetail} />
          </div>

          <div className="bg-card overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>CAC base</TableHead>
                  <TableHead>Periodo CAC base</TableHead>
                  <TableHead>CAC cuota</TableHead>
                  <TableHead>Periodo CAC cuota</TableHead>
                  <TableHead>Ajustado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.cuotas.map((cuota) => (
                  <TableRow key={cuota.id}>
                    <TableCell>{cuota.numero}</TableCell>
                    <TableCell>{formatDate(cuota.fechaVencimiento)}</TableCell>
                    <TableCell>
                      <Badge className={estadoColors[cuota.estado]}>
                        {estadoLabels[cuota.estado] ?? cuota.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(cuota.importeBase, cuota.moneda)}</TableCell>
                    <TableCell>{formatIndex(baseCacValue)}</TableCell>
                    <TableCell>
                      {detail.contrato.periodoBaseCac
                        ? formatPeriod(detail.contrato.periodoBaseCac)
                        : "-"}
                    </TableCell>
                    <TableCell>{formatIndex(cuota.indiceCac)}</TableCell>
                    <TableCell>{cuota.periodoCac ? formatPeriod(cuota.periodoCac) : "-"}</TableCell>
                    <TableCell>
                      {cuota.estado === "pendiente_indice"
                        ? "Falta CAC"
                        : formatMoney(cuota.importeAjustado, cuota.moneda)}
                    </TableCell>
                    <TableCell>{formatMoney(cuota.saldo, cuota.moneda)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPayment(null);
                          setPaymentDate(toInputDate(todayKey()));
                          setPaymentMethod("");
                          setPaymentRate("");
                          setPaymentObservation("");
                          setRemoveReceipt(false);
                          setPayingCuota(cuota);
                          setPaymentAmount(String(cuota.saldo ?? ""));
                          setPaymentReceipt(null);
                        }}
                        disabled={["pagada", "cancelada", "pendiente_indice"].includes(
                          cuota.estado
                        )}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Pago
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Pagos registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedPayments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Todavía no hay pagos registrados.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {sortedPayments.map((pago) => (
                    <div
                      key={pago.id}
                      className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[100px_1fr_110px_110px_110px]"
                    >
                      <span>{formatDate(pago.fechaPago)}</span>
                      <span>{pago.medio || pago.observacion || "Pago registrado"}</span>
                      <span className="font-medium">{formatMoney(pago.monto, pago.moneda)}</span>
                      <span className="text-muted-foreground">
                        {pago.tipoCambioAplicado
                          ? `TC $ ${Number(pago.tipoCambioAplicado).toLocaleString("es-AR")}${pago.tipoCambioManual ? " (manual)" : ""}`
                          : pago.moneda === "usd"
                            ? "Pago USD"
                            : "Falta TC"}
                      </span>
                      <span className="font-medium">{formatMoney(pago.montoUsd, "usd")}</span>
                      {pago.comprobanteUrl ? (
                        <a
                          href={pago.comprobanteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline sm:col-start-2"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {pago.comprobanteNombre || "Ver comprobante"}
                        </a>
                      ) : (
                        <div className="sm:col-start-2">
                          <Input
                            id={`receipt-${pago.id}`}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={uploadingReceiptId !== null}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void attachPaymentReceipt(pago.id, file);
                            }}
                          />
                          <Label
                            htmlFor={`receipt-${pago.id}`}
                            className="text-primary inline-flex cursor-pointer items-center gap-1 font-medium hover:underline"
                          >
                            {uploadingReceiptId === pago.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Paperclip className="h-3.5 w-3.5" />
                            )}
                            {uploadingReceiptId === pago.id
                              ? "Subiendo comprobante..."
                              : "Adjuntar comprobante"}
                          </Label>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            pago.estado !== "activo" || !pago.cuotaId || uploadingReceiptId !== null
                          }
                          onClick={() => {
                            setPayingCuota(null);
                            setEditingPayment(pago);
                            setPaymentDate(toInputDate(pago.fechaPago));
                            setPaymentAmount(String(pago.monto));
                            setPaymentMethod(pago.medio ?? "");
                            setPaymentRate(
                              pago.tipoCambioManual ? String(pago.tipoCambioAplicado ?? "") : ""
                            );
                            setPaymentObservation(pago.observacion ?? "");
                            setPaymentReceipt(null);
                            setRemoveReceipt(false);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingPaymentId !== null || uploadingReceiptId !== null}
                          onClick={() => deletePayment(pago)}
                          aria-label={`Borrar pago del ${formatDate(pago.fechaPago)}`}
                        >
                          {deletingPaymentId === pago.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={Boolean(payingCuota || editingPayment)}
            onOpenChange={(open) => {
              if (!open && !registeringPayment) {
                setEditingPayment(null);
                setPayingCuota(null);
                setPaymentReceipt(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPayment ? "Editar pago" : "Registrar pago"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="payment-date">Fecha (dd/mm/yyyy)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="payment-date"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      maxLength={10}
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                    />
                    <div className="border-input focus-within:ring-ring relative flex h-9 w-10 shrink-0 items-center justify-center rounded-md border focus-within:ring-2">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <input
                        type="date"
                        aria-label="Elegir fecha en el calendario"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        value={parsePaymentDate(paymentDate) ?? ""}
                        onClick={(event) => event.currentTarget.showPicker?.()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.currentTarget.showPicker?.();
                          }
                        }}
                        onChange={(event) => {
                          setPaymentDate(event.target.value ? toInputDate(event.target.value) : "");
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                  />
                </div>
                {(editingPayment?.moneda ?? detail.moneda) === "ars" && (
                  <div className="grid gap-2">
                    <Label htmlFor="payment-rate">Tipo de cambio (opcional)</Label>
                    <Input
                      id="payment-rate"
                      type="number"
                      step="0.01"
                      value={paymentRate}
                      onChange={(event) => setPaymentRate(event.target.value)}
                      placeholder="Vacío = BNA vendedor de la fecha del pago"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Medio / nota</Label>
                  <Input
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    placeholder="Transferencia, efectivo..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment-observation">Observación</Label>
                  <Input
                    id="payment-observation"
                    value={paymentObservation}
                    onChange={(event) => setPaymentObservation(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  {editingPayment?.comprobanteUrl && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <a
                        href={editingPayment.comprobanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        {editingPayment.comprobanteNombre || "Ver comprobante actual"}
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(paymentReceipt)}
                        onClick={() => setRemoveReceipt(!removeReceipt)}
                      >
                        {removeReceipt ? "Conservar adjunto" : "Quitar adjunto"}
                      </Button>
                    </div>
                  )}
                  {editingPayment && (
                    <p className="text-muted-foreground text-xs">
                      {removeReceipt
                        ? "Se quitará el adjunto al guardar."
                        : "El adjunto actual se conserva salvo que elijas otro archivo."}
                    </p>
                  )}
                  <Label htmlFor="payment-receipt">Comprobante (opcional)</Label>
                  <Input
                    id="payment-receipt"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      setPaymentReceipt(event.target.files?.[0] ?? null);
                      setRemoveReceipt(false);
                    }}
                  />
                  <p className="text-muted-foreground text-xs">
                    PDF, JPG, PNG o WEBP. Máximo 5 MB.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={registeringPayment}
                  onClick={() => {
                    setEditingPayment(null);
                    setPayingCuota(null);
                    setPaymentReceipt(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={registerPayment}
                  disabled={registeringPayment}
                >
                  {registeringPayment ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-1 h-4 w-4" />
                  )}
                  {registeringPayment
                    ? "Guardando..."
                    : editingPayment
                      ? "Guardar cambios"
                      : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {!loading && canceladas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Cuentas corrientes canceladas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {canceladas.map(({ contrato, pagos }) => (
              <div key={contrato.id} className="bg-muted/40 space-y-2 rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={estadoColors.cancelada}>Cancelada</Badge>
                  <span className="text-foreground font-medium">Cuenta #{contrato.id}</span>
                  <span className="text-muted-foreground">
                    Cancelada{" "}
                    {contrato.canceladoAt
                      ? `el ${new Date(contrato.canceladoAt).toLocaleDateString("es-AR")}`
                      : ""}{" "}
                    por {contrato.canceladoPor ?? "-"}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {modalidadLabels[contrato.modalidad]} · {contrato.cantidadCuotas} cuotas de{" "}
                  {formatMoney(contrato.cuotaBase, contrato.monedaBase)} · saldo inicial{" "}
                  {formatMoney(contrato.saldoInicial, contrato.monedaBase)} · inicio{" "}
                  {formatDate(contrato.fechaInicio)}
                </p>
                {pagos.length === 0 ? (
                  <p className="text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {pagos.map((pago) => (
                      <div
                        key={pago.id}
                        className="grid gap-2 px-3 py-1.5 sm:grid-cols-[100px_1fr_120px_120px]"
                      >
                        <span>{formatDate(pago.fechaPago)}</span>
                        <span>{pago.medio || pago.observacion || "Pago registrado"}</span>
                        <span className="font-medium">{formatMoney(pago.monto, pago.moneda)}</span>
                        <span className="text-muted-foreground">
                          {pago.estado === "activo" ? formatMoney(pago.montoUsd, "usd") : "Anulado"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
