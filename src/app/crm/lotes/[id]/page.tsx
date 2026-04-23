"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ImageUp, Loader2 } from "lucide-react";
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
import type { Parcela } from "@/lib/schema";
import { BoletoDialog } from "@/components/crm/boleto-dialog";

const schema = z.object({
  estado: z.enum(["disponible", "no_disponible", "reservado", "vendido"]),
  nombreComprador: z.string().nullable().optional(),
  dniCuit: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  emailComprador: z.string().email().or(z.literal("")).nullable().optional(),
  domicilioComprador: z.string().nullable().optional(),
  numeroCuotaEntrega: z.string().nullable().optional(),
  nombreCorredor: z.string().nullable().optional(),
  emailCorredor: z.string().email().or(z.literal("")).nullable().optional(),
  formaPago: z.string().nullable().optional(),
  fechaReserva: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
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
});

type FormValues = z.infer<typeof schema>;

type LeadOption = {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string;
  dniCuit: string | null;
  domicilio: string | null;
};

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<Parcela | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [entregaCuota, setEntregaCuota] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    fetch(`/api/crm/parcelas/${id}`)
      .then((r) => r.json())
      .then((data: Parcela) => {
        setLote(data);
        setEntregaCuota(data.tipoEntrega === "cuota");
        form.reset({
          estado: data.estado,
          nombreComprador: data.nombreComprador ?? "",
          dniCuit: data.dniCuit ?? "",
          telefono: data.telefono ?? "",
          emailComprador: data.emailComprador ?? "",
          domicilioComprador: data.domicilioComprador ?? "",
          numeroCuotaEntrega: data.mesEntrega ?? "",
          nombreCorredor: data.nombreCorredor ?? "",
          emailCorredor: data.emailCorredor ?? "",
          formaPago: data.formaPago ?? "",
          fechaReserva: data.fechaReserva ?? "",
          fechaVencimiento: data.fechaVencimiento ?? "",
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
        });
        setLoading(false);
      });
  }, [id, form]);

  async function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === "numeroCuotaEntrega") continue; // handled separately
      payload[k] = v === "" ? null : v;
    }
    payload.tipoEntrega = entregaCuota ? "cuota" : "saldo";
    payload.mesEntrega = entregaCuota ? (values.numeroCuotaEntrega || null) : null;
    payload.anioEntrega = null;
    const res = await fetch(`/api/crm/parcelas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Lote actualizado");
    } else {
      toast.error("Error al guardar");
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
        ["dniCuit", data.dniCuit],
        ["telefono", data.telefono],
        ["domicilioComprador", data.domicilioComprador],
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
    form.setValue("nombreComprador", lead.nombre);
    form.setValue("telefono", lead.telefono ?? "");
    form.setValue("emailComprador", lead.email);
    form.setValue("dniCuit", lead.dniCuit ?? "");
    form.setValue("domicilioComprador", lead.domicilio ?? "");
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

  return (
    <div className="space-y-6 max-w-3xl">
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
        <BoletoDialog parcela={lote} />
      </div>

      {/* Read-only property data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos catastrales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            ["Circunscripción", lote.circunscripcion ?? "—"],
            ["Sección", lote.seccion ?? "—"],
            ["Superficie", lote.superficieM2 ? `${lote.superficieM2} m²` : "—"],
            ["Valor m²", lote.valorM2 ? `USD ${Number(lote.valorM2).toLocaleString("es-AR")}` : "—"],
            ["Partida ARBA", lote.partidaArba ?? "—"],
            ["Partida Municipal", lote.partidaMunicipal ?? "—"],
            ["Escritura", lote.escritura ?? "—"],
            ["Matrícula / Folio", lote.matriculaFolio ?? "—"],
            ["Cert. Catastral", lote.certificadoCatastral ?? "—"],
            ["Valuación Fiscal", lote.valuacionFiscal ? `$ ${Number(lote.valuacionFiscal).toLocaleString("es-AR")}` : "—"],
            ["VF al Acto", lote.vfAlActo ? `$ ${Number(lote.vfAlActo).toLocaleString("es-AR")}` : "—"],
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
          {lote.nota && (
            <div className="col-span-2 md:col-span-3">
              <span className="text-gray-500">Nota</span>
              <p className="font-medium text-gray-900 mt-0.5">{lote.nota}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
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
                  { name: "nombreCorredor" as const, label: "Nombre corredor" },
                  { name: "emailCorredor" as const, label: "Email corredor" },
                  { name: "formaPago" as const, label: "Forma de pago" },
                  { name: "fechaReserva" as const, label: "Fecha reserva" },
                  { name: "fechaVencimiento" as const, label: "Fecha vencimiento" },
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
                <p className="text-sm font-semibold text-gray-700 mb-3">Precio (USD)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { name: "precioTotalPalabras" as const, label: "Precio total (en letras)", placeholder: "VEINTICINCO MIL" },
                    { name: "precioTotalNum" as const, label: "Precio total (número)", placeholder: "25000" },
                    { name: "anticipoPalabras" as const, label: "Anticipo (en letras)", placeholder: "CINCO MIL" },
                    { name: "anticipoNum" as const, label: "Anticipo (número)", placeholder: "5000" },
                    { name: "saldoPalabras" as const, label: "Saldo (en letras)", placeholder: "VEINTE MIL" },
                    { name: "saldoNum" as const, label: "Saldo (número)", placeholder: "20000" },
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
                disabled={form.formState.isSubmitting}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {form.formState.isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
