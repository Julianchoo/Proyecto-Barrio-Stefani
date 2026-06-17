"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
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
  proximoVencimiento: string | null;
  proximaCuotaMonto: number | null;
  moneda: MonedaPago;
  contrato: Contrato;
  reserva: Reserva;
  cuotas: Cuota[];
  pagos: Pago[];
};

type ReservaForCuenta = Pick<
  Reserva,
  | "id"
  | "estado"
  | "formaPago"
  | "modalidadContrato"
  | "nombreComprador"
  | "reservadoPor"
> & {
  loteNumero: number;
  manzana: string | null;
  parcela: string | null;
};

const estadoColors: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-700",
  pendiente_indice: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-gray-100 text-gray-500",
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

function formatDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function CuentaDetallePage() {
  const { reservaId } = useParams<{ reservaId: string }>();
  const { data: session } = useSession();
  const [detail, setDetail] = useState<CuentaDetail | null>(null);
  const [reservaForCuenta, setReservaForCuenta] =
    useState<ReservaForCuenta | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [payingCuota, setPayingCuota] = useState<Cuota | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayKey());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [createModalidad, setCreateModalidad] =
    useState<ModalidadContrato>("requiere_revision");
  const [periodoBaseCac, setPeriodoBaseCac] = useState("");
  const [tipoCambioBna, setTipoCambioBna] = useState("");

  const sortedPayments = useMemo(
    () => [...(detail?.pagos ?? [])].sort((a, b) => b.fechaPago.localeCompare(a.fechaPago)),
    [detail?.pagos]
  );

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
          tipoCambioBna:
            createModalidad === "pesos_cac" ? parsedTipoCambioBna : null,
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
    if (!payingCuota || !detail) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }

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
        <CardContent className="text-sm text-gray-600">
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
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">
            Cuenta corriente
          </h1>
        </div>
        <Button type="button" variant="outline" onClick={fetchDetail}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </CardContent>
        </Card>
      ) : missing && reservaForCuenta?.formaPago === "contado" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reserva de contado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>
              Esta reserva esta registrada como contado. No corresponde generar
              cuenta corriente ni cuotas.
            </p>
            <div className="rounded-md border bg-gray-50 px-3 py-2">
              <p className="font-medium text-gray-900">
                Lote {reservaForCuenta.loteNumero}
                <span className="ml-2 font-normal text-gray-500">
                  Mz {reservaForCuenta.manzana ?? "-"} / Parc.{" "}
                  {reservaForCuenta.parcela ?? "-"}
                </span>
              </p>
              <p className="mt-1">
                {reservaForCuenta.nombreComprador ?? "Comprador sin nombre"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : missing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear cuenta corriente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Esta reserva todavía no tiene contrato de cuotas. Solo se puede crear
              si la reserva está realizada y tiene datos suficientes de financiación.
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
                <div className="grid gap-2">
                  <Label>Período base CAC</Label>
                  <Input
                    type="month"
                    value={periodoBaseCac}
                    onChange={(event) => setPeriodoBaseCac(event.target.value)}
                  />
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
                className="bg-green-700 hover:bg-green-800 text-white"
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
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    Mz {detail.manzana ?? "-"} / Parc. {detail.parcela ?? "-"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{detail.comprador ?? "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Modalidad</p>
                  <p className="font-medium text-gray-900">
                    {modalidadLabels[detail.modalidad]}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Saldo pendiente</p>
                  <p className="font-medium text-gray-900">
                    {formatMoney(detail.saldoPendiente, detail.moneda)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Vencido</p>
                  <p className="font-medium text-gray-900">
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
                <p className="text-2xl font-semibold text-gray-900">
                  {formatMoney(detail.proximaCuotaMonto, detail.moneda)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
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

          <div className="overflow-x-auto rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Base</TableHead>
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
                        {cuota.estado.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(cuota.importeBase, cuota.moneda)}</TableCell>
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
                <p className="text-sm text-gray-500">Todavía no hay pagos registrados.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {sortedPayments.map((pago) => (
                    <div
                      key={pago.id}
                      className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[120px_1fr_120px]"
                    >
                      <span>{formatDate(pago.fechaPago)}</span>
                      <span>{pago.medio || pago.observacion || "Pago registrado"}</span>
                      <span className="font-medium">
                        {formatMoney(pago.monto, pago.moneda)}
                      </span>
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
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  <CreditCard className="mr-1 h-4 w-4" />
                  Registrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
