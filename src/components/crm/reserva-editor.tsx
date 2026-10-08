"use client";

import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import {
  ANTICIPO_STEP_USD,
  calculateInstallment,
  getMinimumAnticipoUsd,
  roundCurrency,
} from "@/lib/financiacion";
import { amountToSpanishWords } from "@/lib/number-words";
import type { ParcelaConReserva } from "@/lib/schema";

const schema = z.object({
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
  nacionalidadCoComprador: z.string().nullable().optional(),
  fechaNacimientoCoComprador: z.string().nullable().optional(),
  domicilioCoComprador: z.string().nullable().optional(),
  cuitCoComprador: z.string().nullable().optional(),
  estadoCivilCoComprador: z.string().nullable().optional(),
  porcentajeCoComprador: z.string().nullable().optional(),
  numeroCuotaEntrega: z.string().nullable().optional(),
  nombreCorredor: z.string().nullable().optional(),
  emailCorredor: z.string().email().or(z.literal("")).nullable().optional(),
  formaPago: z.string().nullable().optional(),
  modalidadContrato: z
    .enum(["usd_fijo", "pesos_cac", "requiere_revision"])
    .nullable()
    .optional(),
  fechaReserva: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  fechaFirma: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  precioTotalPalabras: z.string().nullable().optional(),
  precioTotalNum: z.string().nullable().optional(),
  reservaPalabras: z.string().nullable().optional(),
  reservaNum: z.string().nullable().optional(),
  anticipoPalabras: z.string().nullable().optional(),
  anticipoNum: z.string().nullable().optional(),
  saldoPalabras: z.string().nullable().optional(),
  saldoNum: z.string().nullable().optional(),
  cantidadCuotas: z.string().nullable().optional(),
  cuotaMensualPalabras: z.string().nullable().optional(),
  cuotaMensual: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;
type TipoPagoReserva = "contado" | "financiado" | "sin_dato";
type ModalidadContratoInput = "usd_fijo" | "pesos_cac" | "requiere_revision";
type PaymentFields = {
  formaPago: FormValues["formaPago"];
  modalidadContrato: FormValues["modalidadContrato"];
};

function modalidadFromReserva(
  modalidadContrato: FormValues["modalidadContrato"]
): ModalidadContratoInput {
  if (modalidadContrato === "usd_fijo") return "usd_fijo";
  if (modalidadContrato === "pesos_cac") return "pesos_cac";
  return "requiere_revision";
}

function hasInstallments(data: Pick<ParcelaConReserva, "cantidadCuotas" | "cuotaMensual">) {
  return Boolean(data.cantidadCuotas?.trim() || data.cuotaMensual?.trim());
}

function tipoPagoFromReserva(
  data: Pick<ParcelaConReserva, "formaPago">
): TipoPagoReserva {
  const formaPago = data.formaPago?.trim().toLowerCase();
  if (formaPago === "contado") return "contado";
  if (formaPago === "financiado" || formaPago === "cuotas") {
    return "financiado";
  }
  return "sin_dato";
}
function paymentFieldsFromSelection(
  tipoPago: TipoPagoReserva,
  modalidadContrato: ModalidadContratoInput
): PaymentFields {
  if (tipoPago === "sin_dato") {
    return { formaPago: null, modalidadContrato: null };
  }
  if (tipoPago === "contado") {
    return { formaPago: "contado", modalidadContrato: null };
  }
  if (modalidadContrato === "usd_fijo" || modalidadContrato === "pesos_cac") {
    return { formaPago: "financiado", modalidadContrato };
  }
  return { formaPago: "financiado", modalidadContrato: "requiere_revision" };
}

const LEAD_PERSONAL_FIELDS = [
  "nombreComprador",
  "dniCuit",
  "telefono",
  "emailComprador",
  "domicilioComprador",
  "nacionalidad",
  "fechaNacimiento",
  "estadoCivil",
  "cuitComprador",
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

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatUsd(value: number) {
  return `USD ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDeliveryInstallment(value: number) {
  if (value <= 0) return "Con el anticipo";
  return `Cuota ${value}`;
}

function defaultsFromLote(data: ParcelaConReserva): FormValues {
  return {
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
    nacionalidadCoComprador: data.nacionalidadCoComprador ?? "",
    fechaNacimientoCoComprador: data.fechaNacimientoCoComprador ?? "",
    domicilioCoComprador: data.domicilioCoComprador ?? "",
    cuitCoComprador: data.cuitCoComprador ?? "",
    estadoCivilCoComprador: data.estadoCivilCoComprador ?? "",
    porcentajeCoComprador: data.porcentajeCoComprador ?? "",
    numeroCuotaEntrega: data.mesEntrega ?? "",
    nombreCorredor: data.nombreCorredor ?? "",
    emailCorredor: data.emailCorredor ?? "",
    formaPago: data.formaPago ?? "",
    modalidadContrato: data.modalidadContrato ?? null,
    fechaReserva: data.fechaReserva ?? "",
    fechaVencimiento: data.fechaVencimiento ?? "",
    fechaFirma: data.fechaFirma ?? "",
    observaciones: data.observaciones ?? "",
    precioTotalPalabras: data.precioTotalPalabras ?? "",
    precioTotalNum: data.precioTotalNum ?? "",
    reservaPalabras: data.reservaPalabras ?? "",
    reservaNum: data.reservaNum ?? "",
    anticipoPalabras: data.anticipoPalabras ?? "",
    anticipoNum: data.anticipoNum ?? "",
    saldoPalabras: data.saldoPalabras ?? "",
    saldoNum: data.saldoNum ?? "",
    cantidadCuotas: data.cantidadCuotas ?? "",
    cuotaMensualPalabras: data.cuotaMensualPalabras ?? "",
    cuotaMensual: data.cuotaMensual ?? "",
  };
}

function calculatorFromLote(data: ParcelaConReserva) {
  const precio = parseNumber(data.precioBase) ?? parseNumber(data.precioEtapa1) ?? 15000;
  return {
    precio,
    anticipo: Math.min(Math.round(precio * 0.3), precio),
    tasa: 1,
    plazo: parseNumber(data.cantidadCuotas) ?? 48,
  };
}

// Datos de una reserva: lead, condiciones, co-comprador, precio, OCR y calculadora.
// En un lote sin reserva, guardar la crea; en la ficha edita la reserva vigente del lote
// (PUT /api/crm/parcelas/[id] siempre escribe en la reserva activa o realizada del lote).
export function ReservaEditor({
  lote,
  locked,
  confirmarEdicionVendida = false,
  onSaved,
}: {
  lote: ParcelaConReserva;
  locked: boolean;
  confirmarEdicionVendida?: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const id = lote.id;
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [entregaCuota, setEntregaCuota] = useState(lote.tipoEntrega === "cuota");
  const [tipoPago, setTipoPago] = useState<TipoPagoReserva>(() => tipoPagoFromReserva(lote));
  const [modalidadContrato, setModalidadContrato] = useState<ModalidadContratoInput>(() =>
    modalidadFromReserva(lote.modalidadContrato)
  );
  const [calculator, setCalculator] = useState(() => calculatorFromLote(lote));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFromLote(lote),
  });
  const calculatorResult = useMemo(() => {
    const saldo = Math.max(calculator.precio - calculator.anticipo, 0);
    const plazo = Math.max(calculator.plazo, 1);
    const cuotaMensual = calculateInstallment(saldo, calculator.tasa, plazo);
    const totalFinanciado = roundCurrency(cuotaMensual * plazo);
    const precioTotalNominal = roundCurrency(calculator.anticipo + totalFinanciado);
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

  const isLocked = locked;
  const isSoldRecord = lote.estado === "vendido" || lote.reservaEstado === "realizada";
  const soldEditConfirmationPayload = isSoldRecord ? { confirmarEdicionVendida } : {};
  const editableCalculatorFields = isAdmin
    ? (["precio", "anticipo", "tasa", "plazo"] as const)
    : (["anticipo", "plazo"] as const);
  const calculatorDisabled = isLocked || (!isAdmin && Boolean(lote.reservaId));

  function fillAmountWords() {
    const mappings: Array<[keyof FormValues, keyof FormValues]> = [
      ["reservaNum", "reservaPalabras"],
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
    value: number,
    enforceAnticipoMinimum = true
  ) {
    setCalculator((current) => {
      const next = {
        ...current,
        [key]: Math.max(value, key === "plazo" ? 1 : 0),
      };
      if (key === "precio" && next.anticipo > value) {
        next.anticipo = value;
      }
      if (key === "precio") {
        next.anticipo = Math.max(
          next.anticipo,
          getMinimumAnticipoUsd(value)
        );
      }
      if (key === "anticipo") {
        next.anticipo = Math.min(
          Math.max(
            value,
            enforceAnticipoMinimum
              ? getMinimumAnticipoUsd(current.precio)
              : 0
          ),
          current.precio
        );
      }
      return next;
    });
  }

  // Carga el calculo en el formulario; se persiste recien con "Guardar".
  function applyCalculatorToReserva() {
    if (tipoPago !== "financiado") {
      toast.error("Seleccioná Financiado para aplicar cuotas");
      return;
    }
    if (modalidadContrato === "requiere_revision") {
      toast.error("Elegí USD fijo o Pesos + CAC para aplicar cuotas");
      return;
    }

    const paymentFields = paymentFieldsFromSelection(
      tipoPago,
      modalidadContrato
    );
    const precioTotalNum = String(roundCurrency(calculatorResult.precioTotalNominal));
    const anticipoNum = String(Math.round(calculator.anticipo));
    const saldoNum = String(roundCurrency(calculatorResult.totalFinanciado));
    const cantidadCuotas = String(Math.max(calculator.plazo, 1));
    const cuotaMensual = String(roundCurrency(calculatorResult.cuotaMensual));
    const useCuotaEntrega = calculatorResult.cuotaEntrega > 0;

    const nextValues: Partial<FormValues> = {
      formaPago: paymentFields.formaPago,
      modalidadContrato: paymentFields.modalidadContrato,
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
    setEntregaCuota(useCuotaEntrega);
    toast.success("Cálculo cargado. Guardá para aplicarlo a la reserva.");
  }

  async function onSubmit(values: FormValues) {
    // Guardar datos en un lote sin reserva la crea (lote -> reservado).
    const hasReservaInput =
      entregaCuota ||
      Object.entries(values).some(
        ([key, value]) =>
          key !== "numeroCuotaEntrega" &&
          value !== null &&
          value !== undefined &&
          value !== ""
      );
    if (hasReservaInput && !values.leadId && !lote?.reservaId) {
      toast.error("Seleccioná un lead antes de reservar el lote");
      return;
    }
    if (hasReservaInput && tipoPago === "sin_dato") {
      toast.error("Elegi tipo de pago");
      return;
    }
    if (hasReservaInput && tipoPago === "financiado" && modalidadContrato === "requiere_revision") {
      toast.error("Elegí USD fijo o Pesos + CAC");
      return;
    }

    const paymentFields = paymentFieldsFromSelection(
      tipoPago,
      modalidadContrato
    );
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === "numeroCuotaEntrega") continue; // handled separately
      if ((LEAD_PERSONAL_FIELDS as readonly string[]).includes(k)) continue;
      payload[k] = v === "" ? null : v;
    }
    payload.formaPago = paymentFields.formaPago;
    payload.modalidadContrato = paymentFields.modalidadContrato;
    Object.assign(payload, soldEditConfirmationPayload);
    if (hasReservaInput) {
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
      toast.success(lote.reservaId ? "Reserva actualizada" : "Reserva creada");
      await onSaved();
    } else {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Error al guardar");
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
        ["nombreCoComprador", data.nombreCoComprador],
        ["dniCoComprador", data.dniCoComprador],
        ["nacionalidadCoComprador", data.nacionalidadCoComprador],
        ["fechaNacimientoCoComprador", data.fechaNacimientoCoComprador],
        ["domicilioCoComprador", data.domicilioCoComprador],
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
        ["reservaPalabras", data.reservaPalabras],
        ["reservaNum", data.reservaNum],
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

  const selectedLeadId = form.watch("leadId") ?? lote.leadId ?? null;
  const leadValue = (field: keyof Pick<
    FormValues,
    | "nombreComprador"
    | "dniCuit"
    | "telefono"
    | "emailComprador"
    | "domicilioComprador"
    | "nacionalidad"
    | "fechaNacimiento"
    | "estadoCivil"
    | "cuitComprador"
  >) => form.watch(field) || lote[field] || "-";
  const leadDisplay = [
    ["Nombre", leadValue("nombreComprador")],
    ["DNI / CUIT", leadValue("dniCuit")],
    ["Telefono", leadValue("telefono")],
    ["Email", leadValue("emailComprador")],
    ["Domicilio", leadValue("domicilioComprador")],
    ["Nacionalidad", leadValue("nacionalidad")],
    ["Fecha de nacimiento", leadValue("fechaNacimiento")],
    ["Estado civil", leadValue("estadoCivil")],
    ["CUIT comprador", leadValue("cuitComprador")],
  ];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
      <Card className="xl:hidden">
        <CardHeader>
          <CardTitle className="text-base">Calculadora de financiación</CardTitle>
        </CardHeader>
        <CardContent>
          <CalculatorContent
            calculator={calculator}
            calculatorResult={calculatorResult}
            disabled={calculatorDisabled}
            editableFields={editableCalculatorFields}
            onChange={updateCalculatorValue}
            onApply={applyCalculatorToReserva}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead asociado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lote.reservaId && !selectedLeadId && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Esta reserva es histórica y todavía no tiene un lead asociado.</span>
            </div>
          )}
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">Seleccionar lead existente</p>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchLeads();
                  }
                }}
                className="text-sm"
                disabled={isLocked}
              />
              <Button type="button" variant="outline" size="sm" onClick={searchLeads} disabled={isLocked}>
                Buscar
              </Button>
            </div>
            {leadResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-white divide-y">
                {leadResults.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => applyLead(lead)}
                  >
                    <span className="font-medium">{lead.nombre}</span>
                    <span className="text-xs text-gray-500">{lead.email} · {lead.telefono}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {leadDisplay.map(([label, value]) => (
              <div key={label}>
                <span className="text-gray-500">{label}</span>
                <p className="font-medium text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editable form */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {lote.reservaId ? `Datos de la reserva #${lote.reservaId}` : "Nueva reserva"}
            </CardTitle>
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
                disabled={isOcrLoading || isLocked}
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
          {lote?.formaPago == null && hasInstallments(lote) && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Esta reserva tiene cuotas cargadas, pero el tipo de pago no fue confirmado. Elegí
                Contado o Financiado antes de guardar.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {false && (
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
          )}
          <Form {...form}>
            <fieldset disabled={isLocked}>
            <form
              onSubmit={form.handleSubmit(onSubmit, (errors) =>
                toast.error(`Campos inválidos: ${Object.keys(errors).join(", ")}`)
              )}
              className="space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                {[
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
                      const val = v as TipoPagoReserva;
                      setTipoPago(val);
                      form.setValue("formaPago", val);
                      if (val === "contado") {
                        form.setValue("modalidadContrato", null);
                      } else {
                        form.setValue(
                          "modalidadContrato",
                          modalidadContrato === "requiere_revision"
                            ? "requiere_revision"
                            : modalidadContrato
                        );
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sin_dato">Sin dato</SelectItem>
                      <SelectItem value="financiado">Financiado (con cuotas)</SelectItem>
                      <SelectItem value="contado">Contado</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
                {tipoPago === "financiado" && (
                  <FormItem className="mt-3">
                    <FormLabel>Modalidad del contrato</FormLabel>
                    <Select
                      value={modalidadContrato}
                      onValueChange={(v) => {
                        const val = v as ModalidadContratoInput;
                        setModalidadContrato(val);
                        form.setValue("modalidadContrato", val);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="requiere_revision" disabled>
                          Requiere revisión
                        </SelectItem>
                        <SelectItem value="usd_fijo">USD fijo</SelectItem>
                        <SelectItem value="pesos_cac">Pesos + CAC</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Co-comprador</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "nombreCoComprador" as const, label: "Nombre co-comprador" },
                    { name: "dniCoComprador" as const, label: "DNI co-comprador" },
                    { name: "nacionalidadCoComprador" as const, label: "Nacionalidad co-comprador" },
                    {
                      name: "fechaNacimientoCoComprador" as const,
                      label: "Fecha nacimiento co-comprador",
                      placeholder: "MM/DD/YYYY",
                    },
                    { name: "domicilioCoComprador" as const, label: "Domicilio co-comprador" },
                    { name: "cuitCoComprador" as const, label: "CUIT co-comprador" },
                    { name: "estadoCivilCoComprador" as const, label: "Estado civil co-comprador" },
                    { name: "porcentajeCoComprador" as const, label: "Porcentaje co-comprador" },
                  ].map(({ name, label, placeholder }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder={placeholder} />
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
                    { name: "reservaPalabras" as const, label: "Reserva / seña (en letras)", placeholder: "QUINIENTOS" },
                    { name: "reservaNum" as const, label: "Reserva / seña (número)", placeholder: "500" },
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
              disabled={calculatorDisabled}
              editableFields={editableCalculatorFields}
              onChange={updateCalculatorValue}
              onApply={applyCalculatorToReserva}
            />
          </CardContent>
        </Card>
      </aside>
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
  editableFields,
  onChange,
  onApply,
}: {
  calculator: CalculatorState;
  calculatorResult: CalculatorResult;
  disabled: boolean;
  editableFields: readonly (keyof CalculatorState)[];
  onChange: (
    key: keyof CalculatorState,
    value: number,
    enforceAnticipoMinimum?: boolean
  ) => void;
  onApply: () => void;
}) {
  const minimumAnticipo = getMinimumAnticipoUsd(calculator.precio);
  const anticipoInvalid = calculator.anticipo < minimumAnticipo;
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
      min: minimumAnticipo,
      max: calculator.precio,
      step: ANTICIPO_STEP_USD,
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
        {fields.map((item) => {
          const fieldDisabled = disabled || !editableFields.includes(item.key);

          return (
          <label key={item.key} className="block space-y-2">
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-700">{item.label}</span>
              <span className="flex items-center gap-2">
                <Input
                  type="number"
                  min={item.min}
                  max={item.max}
                  step={item.key === "anticipo" ? "any" : item.step}
                  value={calculator[item.key]}
                  onChange={(e) =>
                    onChange(
                      item.key,
                      Number(e.target.value),
                      item.key !== "anticipo"
                    )
                  }
                  disabled={fieldDisabled}
                  aria-invalid={item.key === "anticipo" && anticipoInvalid}
                  className={`h-8 w-28 text-right ${
                    item.key === "anticipo" && anticipoInvalid
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }`}
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
              disabled={fieldDisabled}
              className="w-full accent-green-700"
            />
            {item.key === "anticipo" && anticipoInvalid && (
              <p className="text-xs font-medium text-red-600" role="alert">
                Mínimo: {formatUsd(minimumAnticipo)}
              </p>
            )}
          </label>
          );
        })}
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
        disabled={disabled || anticipoInvalid}
        className="w-full bg-green-700 hover:bg-green-800 text-white"
      >
        Aplicar al formulario
      </Button>
    </div>
  );
}
