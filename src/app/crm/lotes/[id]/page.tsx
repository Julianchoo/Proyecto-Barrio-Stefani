"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ImageUp, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSession } from "@/lib/auth-client";
import { amountToSpanishWords } from "@/lib/number-words";
import type { ParcelaConReserva } from "@/lib/schema";
import { BoletoDialog } from "@/components/crm/boleto-dialog";
import { ReservaDialog } from "@/components/crm/reserva-dialog";

const schema = z.object({
  estado: z.enum(["disponible", "no_disponible", "reservado", "vendido"]),
  leadId: z.number().nullable().optional(),
  nombreComprador: z.string().nullable().optional(),
  dniCuit: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  emailComprador: z.string().email().or(z.literal("")).nullable().optional(),
  domicilioComprador: z.string().nullable().optional(),
  nacionalidad: z.string().nullable().optional(),
  fechaNacimiento: z.string().nullable().optional(),
  estadoCivil: z.string().nullable().optional(),
  cuitComprador: z.string().nullable().optional(),
  nombreCoComprador: z.string().nullable().optional(),
  dniCoComprador: z.string().nullable().optional(),
  cuitCoComprador: z.string().nullable().optional(),
  estadoCivilCoComprador: z.string().nullable().optional(),
  porcentajeCoComprador: z.string().nullable().optional(),
  numeroCuotaEntrega: z.string().nullable().optional(),
  nombreCorredor: z.string().nullable().optional(),
  emailCorredor: z.string().email().or(z.literal("")).nullable().optional(),
  formaPago: z.string().nullable().optional(),
  fechaReserva: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  fechaFirma: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  precioTotalPalabras: z.string().nullable().optional(),
  precioTotalNum: z.string().nullable().optional(),
  anticipoPalabras: z.string().nullable().optional(),
  anticipoNum: z.string().nullable().optional(),
  saldoPalabras: z.string().nullable().optional(),
  saldoNum: z.string().nullable().optional(),
  cantidadCuotas: z.string().nullable().optional(),
  cuotaMensualPalabras: z.string().nullable().optional(),
  cuotaMensual: z.string().nullable().optional(),
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

type LeadOption = {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string;
  dniCuit: string | null;
  domicilio: string | null;
  nacionalidad: string | null;
  fechaNacimiento: string | null;
  estadoCivil: string | null;
  cuitComprador: string | null;
};

const editableLoteFields = [
  { name: "precioEtapa1" as const, label: "Precio", suffix: "USD" },
  { name: "superficieM2" as const, label: "Superficie", suffix: "m²" },
  { name: "metrosFrente" as const, label: "Frente", suffix: "m" },
  { name: "metrosFondo" as const, label: "Fondo", suffix: "m" },
  { name: "calleFrente" as const, label: "Calle de frente" },
  { name: "calleLindera1" as const, label: "Calle lindera 1" },
  { name: "calleLindera2" as const, label: "Calle lindera 2" },
  { name: "anticipoPct" as const, label: "Anticipo", suffix: "%" },
  { name: "tasaMensual" as const, label: "Tasa mensual", suffix: "%" },
];

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

function calculateInstallment(saldo: number, tasaMensual: number, plazo: number) {
  return Math.round((saldo * (1 + (tasaMensual / 100) * plazo)) / plazo);
}

function formatUsd(value: number) {
  return `USD ${Math.round(value).toLocaleString("es-AR")}`;
}

function formatDeliveryInstallment(value: number) {
  if (value <= 0) return "Con el anticipo";
  return `Cuota ${value}`;
}

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [lote, setLote] = useState<ParcelaConReserva | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [entregaCuota, setEntregaCuota] = useState(false);
  const [tipoPago, setTipoPago] = useState<"contado" | "financiado">("financiado");
  const [calculatorSaving, setCalculatorSaving] = useState(false);
  const [calculator, setCalculator] = useState({
    precio: 15000,
    anticipo: 4500,
    tasa: 1,
    plazo: 48,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const precioEtapa1 = useWatch({ control: form.control, name: "precioEtapa1" });
  const superficieM2 = useWatch({ control: form.control, name: "superficieM2" });
  const anticipoPct = useWatch({ control: form.control, name: "anticipoPct" });
  const tasaMensual = useWatch({ control: form.control, name: "tasaMensual" });
  const calculatorResult = useMemo(() => {
    const saldo = Math.max(calculator.precio - calculator.anticipo, 0);
    const plazo = Math.max(calculator.plazo, 1);
    const cuotaMensual = calculateInstallment(saldo, calculator.tasa, plazo);
    const totalFinanciado = cuotaMensual * plazo;
    const precioTotalNominal = calculator.anticipo + totalFinanciado;
    const umbralEntrega = precioTotalNominal * 0.5;
    const cuotaEntrega =
      calculator.anticipo >= umbralEntrega || cuotaMensual <= 0
        ? 0
        : Math.ceil((umbralEntrega - calculator.anticipo) / cuotaMensual);

    return {
      saldo,
      cuotaMensual,
      totalFinanciado,
      precioTotalNominal,
      cuotaEntrega: Math.min(cuotaEntrega, plazo),
    };
  }, [calculator]);

  useEffect(() => {
    if (session?.user?.role !== "admin") return;

    const precio = parseNumber(precioEtapa1);
    const superficie = parseNumber(superficieM2);
    const anticipoPorcentaje = parseNumber(anticipoPct) ?? 30;
    const tasa = parseNumber(tasaMensual) ?? 1;

    const valorM2 = precio !== null && superficie !== null && superficie > 0
      ? precio / superficie
      : null;
    const anticipo = precio !== null ? (precio * anticipoPorcentaje) / 100 : null;
    const saldo = precio !== null && anticipo !== null ? Math.max(precio - anticipo, 0) : null;
    const cuotas48 = saldo !== null ? calculateInstallment(saldo, tasa, 48) : null;
    const cuotas60 = saldo !== null ? calculateInstallment(saldo, tasa, 60) : null;

    const derivedValues: Partial<FormValues> = {
      valorM2: formatCalculated(valorM2, 2),
      anticipoUsd: formatCalculated(anticipo),
      saldoUsd: formatCalculated(saldo),
      cuotas48: formatCalculated(cuotas48),
      cuotas60: formatCalculated(cuotas60),
    };

    for (const [key, value] of Object.entries(derivedValues) as Array<
      [keyof FormValues, string]
    >) {
      if (form.getValues(key) !== value) {
        form.setValue(key, value, { shouldDirty: true });
      }
    }
  }, [anticipoPct, form, precioEtapa1, session?.user?.role, superficieM2, tasaMensual]);

  async function fetchLote() {
    const r = await fetch(`/api/crm/parcelas/${id}`);
    const data: ParcelaConReserva = await r.json();
    setLote(data);
    setEntregaCuota(data.tipoEntrega === "cuota");
    setTipoPago(data.formaPago === "contado" ? "contado" : "financiado");
    const reservaAnticipo = parseNumber(data.anticipoNum);
    const reservaSaldo = parseNumber(data.saldoNum);
    const precioBase =
      reservaAnticipo !== null && reservaSaldo !== null
        ? reservaAnticipo + reservaSaldo
        : parseNumber(data.precioEtapa1) ?? 15000;
    const anticipoBase =
      reservaAnticipo ?? parseNumber(data.anticipoUsd) ?? Math.round(precioBase * 0.3);
    setCalculator({
      precio: precioBase,
      anticipo: Math.min(anticipoBase, precioBase),
      tasa: parseNumber(data.tasaMensual) ?? 1,
      plazo: parseNumber(data.cantidadCuotas) ?? (data.cuotas48 ? 48 : 48),
    });
    form.reset({
      estado: data.estado,
      leadId: data.leadId ?? null,
      nombreComprador: data.nombreComprador ?? "",
      dniCuit: data.dniCuit ?? "",
      telefono: data.telefono ?? "",
      emailComprador: data.emailComprador ?? "",
      domicilioComprador: data.domicilioComprador ?? "",
      nacionalidad: data.nacionalidad ?? "",
      fechaNacimiento: data.fechaNacimiento ?? "",
      estadoCivil: data.estadoCivil ?? "",
      cuitComprador: data.cuitComprador ?? "",
      nombreCoComprador: data.nombreCoComprador ?? "",
      dniCoComprador: data.dniCoComprador ?? "",
      cuitCoComprador: data.cuitCoComprador ?? "",
      estadoCivilCoComprador: data.estadoCivilCoComprador ?? "",
      porcentajeCoComprador: data.porcentajeCoComprador ?? "",
      numeroCuotaEntrega: data.mesEntrega ?? "",
      nombreCorredor: data.nombreCorredor ?? "",
      emailCorredor: data.emailCorredor ?? "",
      formaPago: data.formaPago ?? "",
      fechaReserva: data.fechaReserva ?? "",
      fechaVencimiento: data.fechaVencimiento ?? "",
      fechaFirma: data.fechaFirma ?? "",
      observaciones: data.observaciones ?? "",
      precioTotalPalabras: data.precioTotalPalabras ?? "",
      precioTotalNum: data.precioTotalNum ?? "",
      anticipoPalabras: data.anticipoPalabras ?? "",
      anticipoNum: data.anticipoNum ?? "",
      saldoPalabras: data.saldoPalabras ?? "",
      saldoNum: data.saldoNum ?? "",
      cantidadCuotas: data.cantidadCuotas ?? "",
      cuotaMensualPalabras: data.cuotaMensualPalabras ?? "",
      cuotaMensual: data.cuotaMensual ?? "",
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
      precioEtapa1: data.precioEtapa1 ?? "",
      valorM2: data.valorM2 ?? "",
      superficieM2: data.superficieM2 ?? "",
      metrosFrente: data.metrosFrente ?? "",
      metrosFondo: data.metrosFondo ?? "",
      calleFrente: data.calleFrente ?? "",
      calleLindera1: data.calleLindera1 ?? "",
      calleLindera2: data.calleLindera2 ?? "",
      anticipoPct: data.anticipoPct ?? "30",
      anticipoUsd: data.anticipoUsd ?? "",
      tasaMensual: data.tasaMensual ?? "1",
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

  function fillAmountWords() {
    const mappings: Array<[keyof FormValues, keyof FormValues]> = [
      ["precioTotalNum", "precioTotalPalabras"],
      ["anticipoNum", "anticipoPalabras"],
      ["saldoNum", "saldoPalabras"],
      ["cuotaMensual", "cuotaMensualPalabras"],
    ];

    for (const [numberField, wordsField] of mappings) {
      const words = amountToSpanishWords(form.getValues(numberField));
      if (words) {
        form.setValue(wordsField, words, { shouldDirty: true });
      }
    }
  }

  function updateCalculatorValue(
    key: keyof typeof calculator,
    value: number
  ) {
    setCalculator((current) => {
      const next = {
        ...current,
        [key]: Math.max(value, key === "plazo" ? 1 : 0),
      };
      if (key === "precio" && next.anticipo > value) {
        next.anticipo = value;
      }
      if (key === "anticipo" && value > current.precio) {
        next.anticipo = current.precio;
      }
      return next;
    });
  }

  async function applyCalculatorToReserva() {
    setCalculatorSaving(true);
    const precioTotalNum = String(Math.round(calculatorResult.precioTotalNominal));
    const anticipoNum = String(Math.round(calculator.anticipo));
    const saldoNum = String(Math.round(calculatorResult.saldo));
    const cantidadCuotas = String(Math.max(calculator.plazo, 1));
    const cuotaMensual = String(Math.round(calculatorResult.cuotaMensual));
    const useCuotaEntrega = calculatorResult.cuotaEntrega > 0;

    const nextValues: Partial<FormValues> = {
      estado: "reservado",
      formaPago: "financiado",
      precioTotalNum,
      precioTotalPalabras: amountToSpanishWords(precioTotalNum),
      anticipoNum,
      anticipoPalabras: amountToSpanishWords(anticipoNum),
      saldoNum,
      saldoPalabras: amountToSpanishWords(saldoNum),
      cantidadCuotas,
      cuotaMensual,
      cuotaMensualPalabras: amountToSpanishWords(cuotaMensual),
      numeroCuotaEntrega: useCuotaEntrega ? String(calculatorResult.cuotaEntrega) : "",
    };

    for (const [key, value] of Object.entries(nextValues) as Array<
      [keyof FormValues, string | null | undefined]
    >) {
      form.setValue(key, value ?? "", { shouldDirty: true });
    }
    setTipoPago("financiado");
    setEntregaCuota(useCuotaEntrega);

    const payload = {
      estado: "reservado",
      formaPago: "financiado",
      precioTotalNum,
      precioTotalPalabras: nextValues.precioTotalPalabras,
      anticipoNum,
      anticipoPalabras: nextValues.anticipoPalabras,
      saldoNum,
      saldoPalabras: nextValues.saldoPalabras,
      cantidadCuotas,
      cuotaMensual,
      cuotaMensualPalabras: nextValues.cuotaMensualPalabras,
      tipoEntrega: useCuotaEntrega ? "cuota" : "saldo",
      mesEntrega: useCuotaEntrega ? String(calculatorResult.cuotaEntrega) : null,
      anioEntrega: null,
    };

    const res = await fetch(`/api/crm/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Cálculo aplicado a la reserva");
      await fetchLote();
    } else {
      toast.error("No se pudo aplicar el cálculo");
    }
    setCalculatorSaving(false);
  }

  async function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === "numeroCuotaEntrega") continue; // handled separately
      payload[k] = v === "" ? null : v;
    }
    const hasReservaInput =
      values.estado === "reservado" ||
      entregaCuota ||
      Object.entries(values).some(
        ([key, value]) =>
          ![
            "estado",
            "numeroCuotaEntrega",
            ...LOTE_PARAM_FIELDS,
          ].includes(key) &&
          value !== null &&
          value !== undefined &&
          value !== ""
      );
    const explicitNonReservedStateChange =
      lote !== null && values.estado !== lote.estado && values.estado !== "reservado";
    if (hasReservaInput && !explicitNonReservedStateChange) {
      payload.estado = "reservado";
      payload.tipoEntrega = entregaCuota ? "cuota" : "saldo";
      payload.mesEntrega = entregaCuota ? (values.numeroCuotaEntrega || null) : null;
      payload.anioEntrega = null;
    }
    const res = await fetch(`/api/crm/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Lote actualizado");
      await fetchLote();
    } else {
      toast.error("Error al guardar");
    }
  }

  async function handleLoteParamsSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {};
    for (const field of LOTE_PARAM_FIELDS) {
      const value = values[field];
      payload[field] = value === "" ? null : value;
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

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/crm/parcelas/${id}/ocr-reserva`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        toast.error("No se pudo procesar la imagen");
        return;
      }
      const data = await res.json();
      const fieldMap: Array<[keyof FormValues, string | null]> = [
        ["nombreComprador", data.nombreComprador],
        ["dniCuit", data.dniCuit ?? data.dniComprador],
        ["telefono", data.telefono],
        ["emailComprador", data.emailComprador],
        ["domicilioComprador", data.domicilioComprador],
        ["nacionalidad", data.nacionalidad],
        ["fechaNacimiento", data.fechaNacimiento],
        ["estadoCivil", data.estadoCivil],
        ["cuitComprador", data.cuitComprador],
        ["nombreCoComprador", data.nombreCoComprador],
        ["dniCoComprador", data.dniCoComprador],
        ["cuitCoComprador", data.cuitCoComprador],
        ["estadoCivilCoComprador", data.estadoCivilCoComprador],
        ["porcentajeCoComprador", data.porcentajeCoComprador],
        ["fechaReserva", data.fechaReserva],
        ["fechaVencimiento", data.fechaVencimiento],
        ["formaPago", data.formaPago],
        ["nombreCorredor", data.nombreCorredor],
        ["observaciones", data.observaciones],
        ["precioTotalPalabras", data.precioTotalPalabras],
        ["precioTotalNum", data.precioTotalNum],
        ["anticipoPalabras", data.anticipoPalabras],
        ["anticipoNum", data.anticipoNum],
        ["saldoPalabras", data.saldoPalabras],
        ["saldoNum", data.saldoNum],
        ["cantidadCuotas", data.cantidadCuotas],
        ["cuotaMensualPalabras", data.cuotaMensualPalabras],
        ["cuotaMensual", data.cuotaMensual],
      ];
      for (const [field, value] of fieldMap) {
        if (value != null) form.setValue(field, value);
      }
      toast.success("Datos extraídos. Revisá y guardá los cambios.");
    } catch {
      toast.error("Error al procesar la imagen");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function searchLeads() {
    if (!leadSearch.trim()) return;
    const res = await fetch("/api/crm/leads");
    if (!res.ok) return;
    const all: LeadOption[] = await res.json();
    const q = leadSearch.toLowerCase();
    setLeadResults(
      all
        .filter(
          (l) =>
            l.nombre.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q) ||
            (l.telefono ?? "").includes(q)
        )
        .slice(0, 8)
    );
  }

  function applyLead(lead: LeadOption) {
    form.setValue("leadId", lead.id);
    form.setValue("nombreComprador", lead.nombre);
    form.setValue("telefono", lead.telefono ?? "");
    form.setValue("emailComprador", lead.email);
    form.setValue("dniCuit", lead.dniCuit ?? "");
    form.setValue("domicilioComprador", lead.domicilio ?? "");
    form.setValue("nacionalidad", lead.nacionalidad ?? "");
    form.setValue("fechaNacimiento", lead.fechaNacimiento ?? "");
    form.setValue("estadoCivil", lead.estadoCivil ?? "");
    form.setValue("cuitComprador", lead.cuitComprador ?? "");
    setLeadResults([]);
    setLeadSearch("");
    toast.success(`Datos de "${lead.nombre}" cargados`);
  }

  if (loading || !lote) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const isLocked =
    lote.estado === "reservado" &&
    session?.user?.role !== "admin" &&
    lote.reservadoPor !== session?.user?.email;

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
            Manzana {lote.manzana} · Parcela {lote.parcela}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReservaDialog parcela={lote} disabled={isLocked} />
          <BoletoDialog parcela={lote} />
        </div>
      </div>

      {lote.estado === "reservado" &&
        session?.user?.role !== "admin" &&
        lote.reservadoPor !== session?.user?.email && (
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Este lote fue reservado por <strong>{lote.reservadoPor}</strong>. Solo ese comercial o un administrador puede modificarlo.
            </span>
          </div>
        )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 min-w-0">
      {/* Read-only property data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos catastrales</CardTitle>
        </CardHeader>
        <CardContent>
          {session?.user?.role === "admin" ? (
            <form onSubmit={form.handleSubmit(handleLoteParamsSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {readonlyCatastralFields.map(({ key, label }) => (
                  <div key={key}>
                    <span className="text-gray-500">{label}</span>
                    <p className="font-medium text-gray-900 mt-0.5">{lote[key] ?? "—"}</p>
                  </div>
                ))}
                <div>
                  <span className="text-gray-500">Valuación Fiscal</span>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {lote.valuacionFiscal
                      ? `$ ${Number(lote.valuacionFiscal).toLocaleString("es-AR")}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">VF al Acto</span>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {lote.vfAlActo ? `$ ${Number(lote.vfAlActo).toLocaleString("es-AR")}` : "—"}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editableLoteFields.map(({ name, label, suffix }) => (
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
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {calculatedLoteFields.map(({ name, label, suffix }) => {
                  const value = form.watch(name);
                  return (
                    <div key={name}>
                      <span className="text-gray-500">{label}</span>
                      <p className="font-medium text-gray-900 mt-0.5">
                        {value ? `${suffix} ${Number(value).toLocaleString("es-AR")}` : "—"}
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
                ["Circunscripción", lote.circunscripcion ?? "—"],
                ["Sección", lote.seccion ?? "—"],
                ["Superficie", lote.superficieM2 ? `${lote.superficieM2} m²` : "—"],
                ["Frente", lote.metrosFrente ? `${lote.metrosFrente} m` : "—"],
                ["Fondo", lote.metrosFondo ? `${lote.metrosFondo} m` : "—"],
                ["Calle de frente", lote.calleFrente ?? "—"],
                ["Calle lindera 1", lote.calleLindera1 ?? "—"],
                ["Calle lindera 2", lote.calleLindera2 ?? "—"],
                ["Valor m²", lote.valorM2 ? `USD ${Number(lote.valorM2).toLocaleString("es-AR")}` : "—"],
                ["Partida ARBA", lote.partidaArba ?? "—"],
                ["Partida Municipal", lote.partidaMunicipal ?? "—"],
                ["Escritura", lote.escritura ?? "—"],
                ["Matrícula / Folio", lote.matriculaFolio ?? "—"],
                ["Cert. Catastral", lote.certificadoCatastral ?? "—"],
                ["Precio Etapa 1", lote.precioEtapa1 ? `USD ${Number(lote.precioEtapa1).toLocaleString("es-AR")}` : "—"],
                ["Anticipo", lote.anticipoPct ? `${lote.anticipoPct}%` : "—"],
                ["Anticipo USD", lote.anticipoUsd ? `USD ${Number(lote.anticipoUsd).toLocaleString("es-AR")}` : "—"],
                ["Tasa mensual", lote.tasaMensual ? `${lote.tasaMensual}%` : "—"],
                ["Saldo USD", lote.saldoUsd ? `USD ${Number(lote.saldoUsd).toLocaleString("es-AR")}` : "—"],
                ["48 cuotas", lote.cuotas48 ? `USD ${lote.cuotas48}` : "—"],
                ["60 cuotas", lote.cuotas60 ? `USD ${lote.cuotas60}` : "—"],
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

      <Card className="xl:hidden">
        <CardHeader>
          <CardTitle className="text-base">Calculadora de financiación</CardTitle>
        </CardHeader>
        <CardContent>
          <CalculatorContent
            calculator={calculator}
            calculatorResult={calculatorResult}
            disabled={isLocked || calculatorSaving}
            saving={calculatorSaving}
            onChange={updateCalculatorValue}
            onApply={applyCalculatorToReserva}
          />
        </CardContent>
      </Card>

      {/* Editable form */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Datos de reserva / comprador</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleOcrUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isOcrLoading}
              >
                {isOcrLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ImageUp className="h-4 w-4 mr-1" />
                )}
                {isOcrLoading ? "Procesando..." : "Subir reserva"}
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              La extracción de datos por OCR puede contener errores. Revisá los campos antes de guardar.
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2">Cargar datos desde lead existente</p>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchLeads(); } }}
                className="text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={searchLeads}>
                Buscar
              </Button>
            </div>
            {leadResults.length > 0 && (
              <div className="mt-2 border rounded-md bg-white divide-y max-h-40 overflow-y-auto">
                {leadResults.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                    onClick={() => applyLead(lead)}
                  >
                    <span className="font-medium">{lead.nombre}</span>
                    <span className="text-gray-500 text-xs">{lead.email} · {lead.telefono}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Form {...form}>
            <fieldset disabled={isLocked}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Status */}
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="no_disponible">No disponible</SelectItem>
                        <SelectItem value="reservado">Reservado</SelectItem>
                        <SelectItem value="vendido">Vendido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { name: "nombreComprador" as const, label: "Nombre comprador" },
                  { name: "dniCuit" as const, label: "DNI / CUIT" },
                  { name: "telefono" as const, label: "Teléfono" },
                  { name: "emailComprador" as const, label: "Email comprador" },
                  { name: "domicilioComprador" as const, label: "Domicilio comprador" },
                  { name: "nacionalidad" as const, label: "Nacionalidad" },
                  { name: "fechaNacimiento" as const, label: "Fecha de nacimiento" },
                  { name: "estadoCivil" as const, label: "Estado civil" },
                  { name: "cuitComprador" as const, label: "CUIT comprador" },
                  { name: "nombreCorredor" as const, label: "Nombre corredor" },
                  { name: "emailCorredor" as const, label: "Email corredor" },
                  { name: "fechaReserva" as const, label: "Fecha reserva" },
                  { name: "fechaVencimiento" as const, label: "Fecha vencimiento" },
                  { name: "fechaFirma" as const, label: "Fecha de firma" },
                ].map(({ name, label }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            type={name.includes("fecha") ? "date" : "text"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                {/* Tipo de pago */}
                <FormItem>
                  <FormLabel>Tipo de pago</FormLabel>
                  <Select
                    value={tipoPago}
                    onValueChange={(v) => {
                      const val = v as "contado" | "financiado";
                      setTipoPago(val);
                      form.setValue("formaPago", val);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="financiado">Financiado (con cuotas)</SelectItem>
                      <SelectItem value="contado">Contado</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Co-comprador</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "nombreCoComprador" as const, label: "Nombre co-comprador" },
                    { name: "dniCoComprador" as const, label: "DNI co-comprador" },
                    { name: "cuitCoComprador" as const, label: "CUIT co-comprador" },
                    { name: "estadoCivilCoComprador" as const, label: "Estado civil co-comprador" },
                    { name: "porcentajeCoComprador" as const, label: "Porcentaje co-comprador" },
                  ].map(({ name, label }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Entrega */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="entregaCuota"
                    checked={entregaCuota}
                    onCheckedChange={(checked: boolean) => setEntregaCuota(checked)}
                  />
                  <label htmlFor="entregaCuota" className="text-sm text-gray-700 cursor-pointer">
                    Entrega contra pago de cuota número específico
                  </label>
                </div>
                {entregaCuota && (
                  <FormField
                    control={form.control}
                    name="numeroCuotaEntrega"
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>Número de cuota</FormLabel>
                        <FormControl>
                          <Input placeholder="ej: 12" type="number" min="1" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Precio */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">Precio (USD)</p>
                  <Button type="button" variant="outline" size="sm" onClick={fillAmountWords}>
                    Completar letras
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "precioTotalPalabras" as const, label: "Precio total (en letras)", placeholder: "VEINTICINCO MIL" },
                    { name: "precioTotalNum" as const, label: "Precio total (número)", placeholder: "25000" },
                    { name: "anticipoPalabras" as const, label: "Anticipo (en letras)", placeholder: "CINCO MIL" },
                    { name: "anticipoNum" as const, label: "Anticipo (número)", placeholder: "5000" },
                    { name: "saldoPalabras" as const, label: "Saldo (en letras)", placeholder: "VEINTE MIL" },
                    { name: "saldoNum" as const, label: "Saldo (número)", placeholder: "20000" },
                  ].map(({ name, label, placeholder }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder={placeholder}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}

                  {tipoPago === "financiado" && [
                    { name: "cantidadCuotas" as const, label: "Cantidad de cuotas", placeholder: "48" },
                    { name: "cuotaMensualPalabras" as const, label: "Cuota mensual (en letras)", placeholder: "QUINIENTOS" },
                    { name: "cuotaMensual" as const, label: "Cuota mensual (USD)", placeholder: "500" },
                  ].map(({ name, label, placeholder }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder={placeholder}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {lote.modificadoPor && (
                <p className="text-xs text-gray-400">
                  Último cambio por: {lote.modificadoPor}
                </p>
              )}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting || isLocked}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {form.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
            </fieldset>
          </Form>
        </CardContent>
      </Card>
        </div>
        <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calculadora de financiación</CardTitle>
            </CardHeader>
            <CardContent>
              <CalculatorContent
                calculator={calculator}
                calculatorResult={calculatorResult}
                disabled={isLocked || calculatorSaving}
                saving={calculatorSaving}
                onChange={updateCalculatorValue}
                onApply={applyCalculatorToReserva}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

type CalculatorState = {
  precio: number;
  anticipo: number;
  tasa: number;
  plazo: number;
};

type CalculatorResult = {
  saldo: number;
  cuotaMensual: number;
  totalFinanciado: number;
  precioTotalNominal: number;
  cuotaEntrega: number;
};

function CalculatorContent({
  calculator,
  calculatorResult,
  disabled,
  saving,
  onChange,
  onApply,
}: {
  calculator: CalculatorState;
  calculatorResult: CalculatorResult;
  disabled: boolean;
  saving: boolean;
  onChange: (key: keyof CalculatorState, value: number) => void;
  onApply: () => void;
}) {
  const fields = [
    {
      key: "precio" as const,
      label: "Precio",
      min: 0,
      max: 100000,
      step: 500,
      suffix: "USD",
    },
    {
      key: "anticipo" as const,
      label: "Anticipo",
      min: 0,
      max: calculator.precio,
      step: 500,
      suffix: "USD",
    },
    {
      key: "tasa" as const,
      label: "Tasa mensual",
      min: 0,
      max: 5,
      step: 0.1,
      suffix: "%",
    },
    {
      key: "plazo" as const,
      label: "Plazo",
      min: 1,
      max: 120,
      step: 1,
      suffix: "meses",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {fields.map((item) => (
          <label key={item.key} className="block space-y-2">
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-700">{item.label}</span>
              <span className="flex items-center gap-2">
                <Input
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={calculator[item.key]}
                  onChange={(e) => onChange(item.key, Number(e.target.value))}
                  className="h-8 w-28 text-right"
                />
                <span className="w-10 text-left text-xs text-gray-500">
                  {item.suffix}
                </span>
              </span>
            </span>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={Math.min(calculator[item.key], item.max)}
              onChange={(e) => onChange(item.key, Number(e.target.value))}
              className="w-full accent-green-700"
            />
          </label>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {[
          ["Cuota mensual", formatUsd(calculatorResult.cuotaMensual)],
          ["Saldo", formatUsd(calculatorResult.saldo)],
          ["Total financiado", formatUsd(calculatorResult.totalFinanciado)],
          ["Precio total nominal", formatUsd(calculatorResult.precioTotalNominal)],
          ["Entrega", formatDeliveryInstallment(calculatorResult.cuotaEntrega)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-base font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={onApply}
        disabled={disabled}
        className="w-full bg-green-700 hover:bg-green-800 text-white"
      >
        {saving ? "Aplicando..." : "Aplicar a reserva"}
      </Button>
    </div>
  );
}
