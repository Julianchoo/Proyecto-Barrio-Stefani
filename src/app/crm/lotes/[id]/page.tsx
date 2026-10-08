"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Lock, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { calculateInstallment } from "@/lib/financiacion";
import {
  estadoColors,
  estadoLabels,
  formatDate,
  formatPaymentMode,
  sortByCreatedDesc,
  type ReservaRow,
} from "@/lib/reservas-ui";
import type { EstadoParcela, ParcelaConReserva } from "@/lib/schema";
import { CambiarEstadoReserva } from "@/components/crm/cambiar-estado-reserva";
import { ReservaEditor } from "@/components/crm/reserva-editor";

const schema = z.object({
  circunscripcion: z.string().nullable().optional(),
  seccion: z.string().nullable().optional(),
  manzana: z.string().nullable().optional(),
  parcela: z.string().nullable().optional(),
  partidaArba: z.string().nullable().optional(),
  partidaMunicipal: z.string().nullable().optional(),
  escritura: z.string().nullable().optional(),
  matriculaFolio: z.string().nullable().optional(),
  certificadoCatastral: z.string().nullable().optional(),
  valuacionFiscal: z.string().nullable().optional(),
  vfAlActo: z.string().nullable().optional(),
  precioBase: z.string().nullable().optional(),
  precioEtapa1: z.string().nullable().optional(),
  valorM2: z.string().nullable().optional(),
  superficieM2: z.string().nullable().optional(),
  metrosFrente: z.string().nullable().optional(),
  metrosFondo: z.string().nullable().optional(),
  calleFrente: z.string().nullable().optional(),
  calleLindera1: z.string().nullable().optional(),
  calleLindera2: z.string().nullable().optional(),
  anticipoPct: z.string().nullable().optional(),
  anticipoUsd: z.string().nullable().optional(),
  tasaMensual: z.string().nullable().optional(),
  saldoUsd: z.string().nullable().optional(),
  cuotas48: z.string().nullable().optional(),
  cuotas60: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;
const LOTE_PARAM_FIELDS = [
  "circunscripcion",
  "seccion",
  "manzana",
  "parcela",
  "partidaArba",
  "partidaMunicipal",
  "escritura",
  "matriculaFolio",
  "certificadoCatastral",
  "valuacionFiscal",
  "vfAlActo",
  "precioBase",
  "precioEtapa1",
  "valorM2",
  "superficieM2",
  "metrosFrente",
  "metrosFondo",
  "calleFrente",
  "calleLindera1",
  "calleLindera2",
  "anticipoPct",
  "anticipoUsd",
  "tasaMensual",
  "saldoUsd",
  "cuotas48",
  "cuotas60",
  "nota",
] as const;

const editableLoteFields = [
  { name: "precioBase" as const, label: "Precio", suffix: "USD" },
  { name: "superficieM2" as const, label: "Superficie", suffix: "m²" },
  { name: "metrosFrente" as const, label: "Frente", suffix: "m" },
  { name: "metrosFondo" as const, label: "Fondo", suffix: "m" },
  { name: "calleFrente" as const, label: "Calle de frente" },
  { name: "calleLindera1" as const, label: "Calle lindera 1" },
  { name: "calleLindera2" as const, label: "Calle lindera 2" },
];

const comercialEditableLoteFieldNames = [
  "superficieM2",
  "metrosFrente",
  "metrosFondo",
  "calleFrente",
  "calleLindera1",
  "calleLindera2",
] as const;

const calculatedLoteFields = [
  { name: "valorM2" as const, label: "Valor m²", suffix: "USD" },
  { name: "anticipoUsd" as const, label: "Anticipo USD", suffix: "USD" },
  { name: "saldoUsd" as const, label: "Saldo USD", suffix: "USD" },
  { name: "cuotas48" as const, label: "48 cuotas", suffix: "USD" },
  { name: "cuotas60" as const, label: "60 cuotas", suffix: "USD" },
];

const readonlyCatastralFields = [
  { key: "circunscripcion" as const, label: "Circunscripción" },
  { key: "seccion" as const, label: "Sección" },
  { key: "partidaArba" as const, label: "Partida ARBA" },
  { key: "partidaMunicipal" as const, label: "Partida Municipal" },
  { key: "escritura" as const, label: "Escritura" },
  { key: "matriculaFolio" as const, label: "Matrícula / Folio" },
  { key: "certificadoCatastral" as const, label: "Cert. Catastral" },
];

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCalculated(value: number | null, decimals = 0) {
  if (value === null || !Number.isFinite(value)) return "";
  return String(decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value));
}

const loteEstadoLabels: Record<EstadoParcela, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  reservado: "Reservado",
  vendido: "Vendido",
};

const DEFAULT_ANTICIPO_PCT = 30;
const DEFAULT_TASA_MENSUAL = 1;

function calculateLotePricing(precioBase: string | null | undefined, superficieM2: string | null | undefined) {
  const precio = parseNumber(precioBase);
  const superficie = parseNumber(superficieM2);
  const anticipo = precio !== null ? (precio * DEFAULT_ANTICIPO_PCT) / 100 : null;
  const saldo = precio !== null && anticipo !== null ? Math.max(precio - anticipo, 0) : null;

  return {
    valorM2:
      precio !== null && superficie !== null && superficie > 0
        ? formatCalculated(precio / superficie, 2)
        : "",
    anticipoUsd: formatCalculated(anticipo),
    saldoUsd: formatCalculated(saldo),
    cuotas48: formatCalculated(
      saldo !== null ? calculateInstallment(saldo, DEFAULT_TASA_MENSUAL, 48) : null,
      2
    ),
    cuotas60: formatCalculated(
      saldo !== null ? calculateInstallment(saldo, DEFAULT_TASA_MENSUAL, 60) : null,
      2
    ),
  };
}

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [lote, setLote] = useState<ParcelaConReserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [soldEditUnlocked, setSoldEditUnlocked] = useState(false);
  const [historial, setHistorial] = useState<ReservaRow[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const precioBase = useWatch({ control: form.control, name: "precioBase" });
  const superficieM2 = useWatch({ control: form.control, name: "superficieM2" });
  useEffect(() => {
    const derivedValues = calculateLotePricing(precioBase, superficieM2);

    for (const [key, value] of Object.entries(derivedValues) as Array<
      [keyof FormValues, string]
    >) {
      if (form.getValues(key) !== value) {
        form.setValue(key, value, { shouldDirty: true });
      }
    }
  }, [form, precioBase, superficieM2]);

  async function fetchLote() {
    fetch("/api/crm/reservas")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: ReservaRow[]) =>
        setHistorial(sortByCreatedDesc(rows.filter((row) => row.parcelaId === Number(id))))
      )
      .catch(() => setHistorial([]));
    const r = await fetch(`/api/crm/parcelas/${id}`);
    const data: ParcelaConReserva = await r.json();
    setLote(data);
    setSoldEditUnlocked(false);
    form.reset({
      circunscripcion: data.circunscripcion ?? "",
      seccion: data.seccion ?? "",
      manzana: data.manzana ?? "",
      parcela: data.parcela ?? "",
      partidaArba: data.partidaArba ?? "",
      partidaMunicipal: data.partidaMunicipal ?? "",
      escritura: data.escritura ?? "",
      matriculaFolio: data.matriculaFolio ?? "",
      certificadoCatastral: data.certificadoCatastral ?? "",
      valuacionFiscal: data.valuacionFiscal ?? "",
      vfAlActo: data.vfAlActo ?? "",
      precioBase: data.precioBase ?? data.precioEtapa1 ?? "",
      precioEtapa1: data.precioEtapa1 ?? "",
      valorM2: data.valorM2 ?? "",
      superficieM2: data.superficieM2 ?? "",
      metrosFrente: data.metrosFrente ?? "",
      metrosFondo: data.metrosFondo ?? "",
      calleFrente: data.calleFrente ?? "",
      calleLindera1: data.calleLindera1 ?? "",
      calleLindera2: data.calleLindera2 ?? "",
      anticipoPct: String(DEFAULT_ANTICIPO_PCT),
      anticipoUsd: data.anticipoUsd ?? "",
      tasaMensual: String(DEFAULT_TASA_MENSUAL),
      saldoUsd: data.saldoUsd ?? "",
      cuotas48: data.cuotas48 ?? "",
      cuotas60: data.cuotas60 ?? "",
      nota: data.nota ?? "",
    });
    setLoading(false);
  }

  useEffect(() => {
    fetchLote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLoteParamsSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {};
    const derivedValues = calculateLotePricing(values.precioBase, values.superficieM2);

    for (const field of LOTE_PARAM_FIELDS) {
      const value = values[field];
      payload[field] = value === "" ? null : value;
    }
    payload.anticipoPct = String(DEFAULT_ANTICIPO_PCT);
    Object.assign(payload, soldEditConfirmationPayload);
    payload.tasaMensual = String(DEFAULT_TASA_MENSUAL);
    for (const [key, value] of Object.entries(derivedValues)) {
      payload[key] = value === "" ? null : value;
    }

    const res = await fetch(`/api/crm/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Parámetros del lote actualizados");
      await fetchLote();
    } else {
      toast.error("No se pudieron guardar los parámetros del lote");
    }
  }

  if (loading || !lote) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const isReservedByOther =
    lote.estado === "reservado" &&
    session?.user?.role !== "admin" &&
    lote.reservadoPor !== session?.user?.email;
  const isSoldRecord = lote.estado === "vendido" || lote.reservaEstado === "realizada";
  const isSoldLocked = isSoldRecord && !soldEditUnlocked;
  const isLocked = isReservedByOther || isSoldLocked;
  const soldEditConfirmationPayload = isSoldRecord
    ? { confirmarEdicionVendida: soldEditUnlocked }
    : {};
  const canEditLoteParams =
    session?.user?.role === "admin" ||
    (session?.user?.role === "comercial" &&
      (lote.estado === "disponible" || lote.reservadoPor === session.user.email));
  const visibleEditableLoteFields =
    session?.user?.role === "admin"
      ? editableLoteFields
      : editableLoteFields.filter(({ name }) =>
          (comercialEditableLoteFieldNames as readonly string[]).includes(name)
        );
  const readonlyPrecioBase = parseNumber(lote.precioBase);
  const readonlyAnticipoUsd =
    readonlyPrecioBase !== null ? Math.round(readonlyPrecioBase * (DEFAULT_ANTICIPO_PCT / 100)) : null;
  const readonlySaldoUsd =
    readonlyPrecioBase !== null && readonlyAnticipoUsd !== null
      ? Math.max(readonlyPrecioBase - readonlyAnticipoUsd, 0)
      : null;
  const readonlyCuotas48 =
    readonlySaldoUsd !== null ? calculateInstallment(readonlySaldoUsd, DEFAULT_TASA_MENSUAL, 48) : null;
  const readonlyCuotas60 =
    readonlySaldoUsd !== null ? calculateInstallment(readonlySaldoUsd, DEFAULT_TASA_MENSUAL, 60) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/crm/lotes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Lote N° {lote.numero}
          </h1>
          <p className="text-sm text-gray-500">
            Manzana {lote.manzana} · Parcela {lote.parcela} · Estado:{" "}
            <span className="font-medium text-gray-900">{loteEstadoLabels[lote.estado]}</span>
            {lote.reservaId ? ` (por la reserva #${lote.reservaId})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSoldRecord && session?.user?.role === "admin" && !soldEditUnlocked && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar vendido
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    OJO! Est?s por cambiar datos de un lote o reserva ya vendido
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acci?n habilita cambios sobre datos ya marcados como vendidos. Revis? bien antes de guardar porque puede afectar reserva, boleto, cuenta corriente y reportes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setSoldEditUnlocked(true)}>
                    Entiendo, habilitar edici?n
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {lote.reservaId && lote.reservaEstado === "activa" && session?.user?.role === "admin" && (
            <CambiarEstadoReserva
              reserva={{
                id: lote.reservaId,
                estado: lote.reservaEstado,
                loteNumero: lote.numero,
                nombreComprador: lote.nombreComprador ?? null,
              }}
              onChanged={fetchLote}
              fixedTarget="cancelada"
              label="Cancelar reserva"
            />
          )}
          {lote.reservaId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/crm/reservas/${lote.reservaId}`}>Ver reserva actual</Link>
            </Button>
          )}
        </div>
      </div>

      {isReservedByOther && (
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Este lote fue reservado por <strong>{lote.reservadoPor}</strong>. Solo ese comercial o un administrador puede modificarlo.
            </span>
          </div>
        )}

      {isSoldLocked && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Este lote o reserva ya figura como vendido. Los datos est?n bloqueados; solo un administrador puede habilitar edici?n con confirmaci?n.
          </span>
        </div>
      )}

      {/* Read-only property data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del lote</CardTitle>
        </CardHeader>
        <CardContent>
          {canEditLoteParams && !isLocked ? (
            <form onSubmit={form.handleSubmit(handleLoteParamsSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {readonlyCatastralFields.map(({ key, label }) => (
                  <div key={key}>
                    <span className="text-gray-500">{label}</span>
                    <p className="font-medium text-gray-900 mt-0.5">{lote[key] ?? "-"}</p>
                  </div>
                ))}
                <div>
                  <span className="text-gray-500">Valuación Fiscal</span>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {lote.valuacionFiscal
                      ? `$ ${Number(lote.valuacionFiscal).toLocaleString("es-AR")}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">VF al Acto</span>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {lote.vfAlActo ? `$ ${Number(lote.vfAlActo).toLocaleString("es-AR")}` : "-"}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleEditableLoteFields.map(({ name, label, suffix }) => (
                  <div key={name} className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500" htmlFor={name}>
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={name}
                        {...form.register(name)}
                        type={
                          [
                            "precioBase",
                            "precioEtapa1",
                            "superficieM2",
                            "metrosFrente",
                            "metrosFondo",
                            "anticipoPct",
                            "tasaMensual",
                          ].includes(name)
                            ? "number"
                            : "text"
                        }
                        min="0"
                        step="0.01"
                        className="h-9"
                      />
                      {suffix && <span className="w-9 text-xs text-gray-500">{suffix}</span>}
                    </div>
                  </div>
                ))}
                <div>
                  <span className="text-xs font-medium text-gray-500">Anticipo</span>
                  <p className="font-medium text-gray-900 mt-1.5">{DEFAULT_ANTICIPO_PCT}%</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Tasa mensual</span>
                  <p className="font-medium text-gray-900 mt-1.5">{DEFAULT_TASA_MENSUAL}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {calculatedLoteFields.map(({ name, label, suffix }) => {
                  const value = form.watch(name);
                  return (
                    <div key={name}>
                      <span className="text-gray-500">{label}</span>
                      <p className="font-medium text-gray-900 mt-0.5">
                        {value ? `${suffix} ${Number(value).toLocaleString("es-AR")}` : "-"}
                      </p>
                    </div>
                  );
                })}
              </div>

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {form.formState.isSubmitting ? "Guardando..." : "Guardar parámetros"}
              </Button>
            </form>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                ["Circunscripción", lote.circunscripcion ?? "-"],
                ["Sección", lote.seccion ?? "-"],
                ["Superficie", lote.superficieM2 ? `${lote.superficieM2} m²` : "-"],
                ["Frente", lote.metrosFrente ? `${lote.metrosFrente} m` : "-"],
                ["Fondo", lote.metrosFondo ? `${lote.metrosFondo} m` : "-"],
                ["Calle de frente", lote.calleFrente ?? "-"],
                ["Calle lindera 1", lote.calleLindera1 ?? "-"],
                ["Calle lindera 2", lote.calleLindera2 ?? "-"],
                ["Valor m²", lote.valorM2 ? `USD ${Number(lote.valorM2).toLocaleString("es-AR")}` : "-"],
                ["Partida ARBA", lote.partidaArba ?? "-"],
                ["Partida Municipal", lote.partidaMunicipal ?? "-"],
                ["Escritura", lote.escritura ?? "-"],
                ["Matrícula / Folio", lote.matriculaFolio ?? "-"],
                ["Cert. Catastral", lote.certificadoCatastral ?? "-"],
                ["Precio base", lote.precioBase ? `USD ${Number(lote.precioBase).toLocaleString("es-AR")}` : "-"],
                ["Anticipo", `${DEFAULT_ANTICIPO_PCT}%`],
                ["Anticipo USD", readonlyAnticipoUsd !== null ? `USD ${readonlyAnticipoUsd.toLocaleString("es-AR")}` : "-"],
                ["Tasa mensual", `${DEFAULT_TASA_MENSUAL}%`],
                ["Saldo USD", readonlySaldoUsd !== null ? `USD ${readonlySaldoUsd.toLocaleString("es-AR")}` : "-"],
                ["48 cuotas", readonlyCuotas48 !== null ? `USD ${readonlyCuotas48}` : "-"],
                ["60 cuotas", readonlyCuotas60 !== null ? `USD ${readonlyCuotas60}` : "-"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-gray-500">{label}</span>
                  <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {lote.reservaId && lote.reservaEstado ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              Reserva actual ·{" "}
              <Link href={`/crm/reservas/${lote.reservaId}`} className="hover:underline">
                #{lote.reservaId}
              </Link>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColors[lote.reservaEstado]}`}
              >
                {estadoLabels[lote.reservaEstado]}
              </span>
            </CardTitle>
            <Button asChild size="sm">
              <Link href={`/crm/reservas/${lote.reservaId}`}>Ver o editar reserva</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              {[
                ["Comprador", lote.nombreComprador],
                ["DNI / CUIT", lote.dniCuit],
                ["Teléfono", lote.telefono],
                ["Modalidad", formatPaymentMode(lote)],
                ["Precio total", lote.precioTotalNum ? `USD ${lote.precioTotalNum}` : null],
                ["Fecha reserva", formatDate(lote.fechaReserva)],
                ["Vencimiento", formatDate(lote.fechaVencimiento)],
                ["Firma", formatDate(lote.fechaFirma)],
                ["Reservado por", lote.reservadoPor],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-gray-500">{label}</span>
                  <p className="mt-0.5 font-medium text-gray-900">{value || "-"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : lote.estado === "no_disponible" ? (
        <div className="rounded-md border bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Este lote está marcado como no disponible. Pasalo a disponible desde la lista de lotes para
          reservarlo.
        </div>
      ) : (
        <ReservaEditor
          lote={lote}
          locked={isLocked}
          confirmarEdicionVendida={soldEditUnlocked}
          onSaved={fetchLote}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de reservas del lote</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-gray-500">Este lote no tiene reservas registradas.</p>
          ) : (
            <div className="divide-y rounded-md border text-sm">
              {historial.map((reserva) => (
                <Link
                  key={reserva.id}
                  href={`/crm/reservas/${reserva.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 hover:bg-gray-50"
                >
                  <span className="w-14 font-mono text-gray-500">#{reserva.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColors[reserva.estado]}`}
                  >
                    {estadoLabels[reserva.estado]}
                  </span>
                  <span className="flex-1 font-medium text-gray-900">
                    {reserva.nombreComprador ?? "Sin comprador"}
                  </span>
                  <span className="text-xs text-gray-500">
                    Reserva {formatDate(reserva.fechaReserva)} · Creada {formatDate(reserva.reservaCreatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
