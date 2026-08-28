"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
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
import type {
  Contrato,
  Cuota,
  ModalidadContrato,
  MonedaPago,
  Pago,
  Reserva,
  IndiceCac,
  TipoCambio,
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
  pendiente_indice: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
  calculada: "bg-emerald-100 text-emerald-800",
  proyectada: "bg-sky-100 text-sky-800",
  parcial_vencida: "bg-orange-100 text-orange-800",
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

function formatDate(value: string | null) {
  if (!value) return "-";
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
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayKey());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [registeringPayment, setRegisteringPayment] = useState(false);
  const [createModalidad, setCreateModalidad] = useState<ModalidadContrato>("requiere_revision");
  const [periodoBaseCac, setPeriodoBaseCac] = useState("");
  const [indicesCac, setIndicesCac] = useState<IndiceCac[]>([]);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [periodPickerYear, setPeriodPickerYear] = useState(currentYear());
  const [tipoCambioBna, setTipoCambioBna] = useState("");
  const [rateDate, setRateDate] = useState(todayKey());
  const [rateValue, setRateValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [savedRates, setSavedRates] = useState<TipoCambio[]>([]);

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
      toast.error(data?.error ?? "No se pudieron cargar los CAC");
      return [];
    }
    const rows = data as IndiceCac[];
    setIndicesCac(rows);
    return rows;
  }

  async function fetchSavedRates() {
    const res = await fetch("/api/crm/tipos-cambio");
    if (!res.ok) return;
    setSavedRates(await res.json());
  }

  async function saveRate() {
    const numericValue = Number(rateValue);
    if (!rateDate || !Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Ingresá fecha y BNA vendedor");
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch("/api/crm/tipos-cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: rateDate, valor: numericValue, fuente: "Carga manual" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar el tipo de cambio");
        return;
      }
      toast.success("BNA vendedor guardado");
      setRateValue("");
      await Promise.all([fetchSavedRates(), fetchDetail()]);
    } finally {
      setSavingRate(false);
    }
  }

  async function fetchReservaForCuenta() {
    const res = await fetch(`/api/crm/reservas/${reservaId}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo cargar la reserva");
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
      const res = await fetch(`/api/crm/reservas/${reservaId}/cuenta-corriente`);
      if (res.status === 404) {
        const reserva = await fetchReservaForCuenta();
        if (!reserva) return;
        setReservaForCuenta(reserva);
        setCreateModalidad(reserva.modalidadContrato ?? "requiere_revision");
        if (reserva.modalidadContrato === "pesos_cac") {
          await fetchTipoCambioBna();
          const rows = await fetchIndicesCac();
          setPeriodPickerYear(rows[0]?.periodo ? yearFromPeriod(rows[0].periodo) : currentYear());
        }
        setMissing(true);
        setDetail(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "No se pudo cargar la cuenta corriente");
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
    if (!session || session.user.role !== "admin") return;
    fetchDetail();
    void fetchSavedRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaId, session]);

  async function createContrato() {
    if (reservaForCuenta?.formaPago === "contado") return;
    const parsedTipoCambioBna = Number(tipoCambioBna);
    if (
      createModalidad === "pesos_cac" &&
      (!Number.isFinite(parsedTipoCambioBna) || parsedTipoCambioBna <= 0)
    ) {
      toast.error("IngresÃ¡ el tipo de cambio vendedor BNA");
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
    if (!payingCuota || !detail || registeringPayment) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }

    setRegisteringPayment(true);
    try {
      const res = await fetch(`/api/crm/cuotas/${payingCuota.id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaPago: paymentDate,
          monto: amount,
          moneda: detail.moneda,
          medio: paymentMethod || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo registrar el pago");
        return;
      }
      toast.success("Pago registrado");
      setPayingCuota(null);
      setPaymentAmount("");
      setPaymentMethod("");
      await fetchDetail();
    } finally {
      setRegisteringPayment(false);
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
          <CardTitle className="text-base">Acceso restringido</CardTitle>
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
          <h1 className="text-foreground mt-2 text-2xl font-semibold">Cuenta corriente</h1>
        </div>
        <Button type="button" variant="outline" onClick={fetchDetail}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Actualizar
        </Button>
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
            <CardTitle className="text-base">Reserva de contado</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Esta reserva esta registrada como contado. No corresponde generar cuenta corriente ni
              cuotas.
            </p>
            <div className="bg-muted/40 rounded-md border px-3 py-2">
              <p className="text-foreground font-medium">
                Lote {reservaForCuenta.loteNumero}
                <span className="text-muted-foreground ml-2 font-normal">
                  Mz {reservaForCuenta.manzana ?? "-"} / Parc. {reservaForCuenta.parcela ?? "-"}
                </span>
              </p>
              <p className="mt-1">{reservaForCuenta.nombreComprador ?? "Comprador sin nombre"}</p>
            </div>
          </CardContent>
        </Card>
      ) : missing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear cuenta corriente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Esta reserva todavía no tiene contrato de cuotas. Solo se puede crear si la reserva
              está realizada y tiene datos suficientes de financiación.
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
                      void fetchIndicesCac().then((rows) => {
                        setPeriodPickerYear(
                          rows[0]?.periodo ? yearFromPeriod(rows[0].periodo) : currentYear()
                        );
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requiere_revision">Requiere revisión</SelectItem>
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
                        periodoBaseCac ? yearFromPeriod(periodoBaseCac) : periodPickerYear
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
                                  ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
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
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
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
                disabled={creating}
                className="bg-green-700 text-white hover:bg-green-800"
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
                <CardTitle className="text-base">
                  Lote {detail.loteNumero}
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    Mz {detail.manzana ?? "-"} / Parc. {detail.parcela ?? "-"}
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
                <CardTitle className="text-base">Próxima cuota</CardTitle>
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
                <CardTitle className="text-base">Comunicación</CardTitle>
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
            <Card className="border-emerald-200 bg-emerald-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900">
                  Total cobrado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-emerald-950">
                  {formatMoney(detail.totalCobradoUsd, "usd")}
                </p>
                <p className="mt-2 text-xs text-emerald-800">
                  Incluye anticipo de {formatMoney(detail.anticipoCobradoUsd, "usd")} y pagos
                  activos dolarizados a su fecha.
                </p>
                {detail.fechasPagoSinTipoCambio.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Falta BNA para completar:{" "}
                    {detail.fechasPagoSinTipoCambio.map(formatDate).join(", ")}.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-sky-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-sky-900">
                  Total pendiente a hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-sky-950">
                  {formatMoney(detail.totalFuturoUsd, "usd")}
                </p>
                <p className="mt-2 text-xs text-sky-800">
                  Incluye cuotas vencidas y futuras. BNA vendedor actual:{" "}
                  {formatMoney(detail.tipoCambioActual, "ars")}.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Cargar BNA vendedor histórico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    type="date"
                    value={rateDate}
                    onChange={(event) => setRateDate(event.target.value)}
                    aria-label="Fecha del tipo de cambio"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rateValue}
                    onChange={(event) => setRateValue(event.target.value)}
                    placeholder="Cotización"
                    aria-label="BNA vendedor"
                  />
                  <Button type="button" size="icon" onClick={saveRate} disabled={savingRate}>
                    {savingRate ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="sr-only">Guardar cotización</span>
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Para pagos sin cotización exacta se usa la última fecha anterior cargada.
                  {savedRates[0]
                    ? ` Última carga: ${formatDate(savedRates[0].fecha)} — $ ${Number(savedRates[0].valor).toLocaleString("es-AR")}.`
                    : " Todavía no hay cotizaciones guardadas."}
                </p>
              </CardContent>
            </Card>
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
                          setPayingCuota(cuota);
                          setPaymentAmount(String(cuota.saldo ?? ""));
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
              <CardTitle className="text-base">Pagos registrados</CardTitle>
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
                          ? `TC $ ${Number(pago.tipoCambioAplicado).toLocaleString("es-AR")}`
                          : pago.moneda === "usd"
                            ? "Pago USD"
                            : "Falta TC"}
                      </span>
                      <span className="font-medium">{formatMoney(pago.montoUsd, "usd")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={Boolean(payingCuota)} onOpenChange={() => setPayingCuota(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar pago</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
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
                <div className="grid gap-2">
                  <Label>Medio / nota</Label>
                  <Input
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    placeholder="Transferencia, efectivo..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayingCuota(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={registerPayment}
                  disabled={registeringPayment}
                  className="bg-green-700 text-white hover:bg-green-800"
                >
                  {registeringPayment ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-1 h-4 w-4" />
                  )}
                  {registeringPayment ? "Registrando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
