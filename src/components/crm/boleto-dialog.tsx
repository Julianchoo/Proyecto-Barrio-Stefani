"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { Parcela } from "@/lib/schema";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const ESTADOS_CIVILES = [
  "soltero/a",
  "casado/a",
  "divorciado/a",
  "viudo/a",
  "unión convivencial",
];

const schema = z.object({
  dia: z.string().min(1, "Requerido"),
  mes: z.string().min(1, "Requerido"),
  anio: z.string().min(4, "Requerido"),
  // Buyer
  nombreComprador: z.string().min(1, "Requerido"),
  dniComprador: z.string().min(1, "Requerido"),
  nacionalidad: z.string().min(1, "Requerido"),
  fechaNacimiento: z.string().min(1, "Requerido"),
  estadoCivil: z.string().min(1, "Requerido"),
  cuitComprador: z.string().min(1, "Requerido"),
  domicilioComprador: z.string().min(1, "Requerido"),
  // Property extras
  calleInmueble: z.string().optional(),
  limites: z.string().optional(),
  medidas: z.string().optional(),
  // Price (in words + numbers)
  precioTotalPalabras: z.string().optional(),
  precioTotalNum: z.string().optional(),
  anticipoPalabras: z.string().optional(),
  anticipoNum: z.string().optional(),
  saldoPalabras: z.string().optional(),
  saldoNum: z.string().optional(),
  cantidadCuotas: z.string().optional(),
  cuotaMensualPalabras: z.string().optional(),
  cuotaMensual: z.string().optional(),
  // Entrega
  tipoEntrega: z.enum(["saldo", "mes"]).optional(),
  mesEntrega: z.string().optional(),
  anioEntrega: z.string().optional(),
  // Co-buyer (hasCoComprador is managed by local state, not Zod)
  nombreCoComprador: z.string().optional(),
  dniCoComprador: z.string().optional(),
  cuitCoComprador: z.string().optional(),
  estadoCivilCoComprador: z.string().optional(),
  porcentajeCoComprador: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface BoletoDialogProps {
  parcela: Parcela;
}

export function BoletoDialog({ parcela }: BoletoDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dia: String(new Date().getDate()),
      mes: MESES[new Date().getMonth()] ?? "enero",
      anio: String(new Date().getFullYear()),
      nombreComprador: parcela.nombreComprador ?? "",
      dniComprador: parcela.dniCuit ?? "",
      nacionalidad: "argentina/o",
      fechaNacimiento: "",
      estadoCivil: "",
      cuitComprador: "",
      domicilioComprador: parcela.domicilioComprador ?? "",
      calleInmueble: "",
      limites: "",
      medidas: parcela.superficieM2 ? `${parcela.superficieM2} m²` : "",
      precioTotalPalabras: "",
      precioTotalNum: parcela.precioEtapa1 ? String(Number(parcela.precioEtapa1)) : "",
      anticipoPalabras: "",
      anticipoNum: parcela.anticipoUsd ? String(Number(parcela.anticipoUsd)) : "",
      saldoPalabras: "",
      saldoNum: parcela.saldoUsd ? String(Number(parcela.saldoUsd)) : "",
      cantidadCuotas: parcela.cuotas48 ? "48" : "",
      cuotaMensualPalabras: "",
      cuotaMensual: parcela.cuotas48 ? String(parcela.cuotas48) : "",
      tipoEntrega: (parcela.tipoEntrega as "saldo" | "mes") ?? "saldo",
      mesEntrega: parcela.mesEntrega ?? "",
      anioEntrega: parcela.anioEntrega ?? "",
      nombreCoComprador: "",
      dniCoComprador: "",
      cuitCoComprador: "",
      estadoCivilCoComprador: "",
      porcentajeCoComprador: "50",
    },
  });

  const [showCoComprador, setShowCoComprador] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form with current parcela data every time the dialog opens
  useEffect(() => {
    if (!open) return;
    const today = new Date();
    form.reset({
      dia: String(today.getDate()),
      mes: MESES[today.getMonth()] ?? "enero",
      anio: String(today.getFullYear()),
      nombreComprador: parcela.nombreComprador ?? "",
      dniComprador: parcela.dniCuit ?? "",
      nacionalidad: "argentina/o",
      fechaNacimiento: "",
      estadoCivil: "",
      cuitComprador: "",
      domicilioComprador: parcela.domicilioComprador ?? "",
      calleInmueble: "",
      limites: "",
      medidas: parcela.superficieM2 ? `${parcela.superficieM2} m²` : "",
      precioTotalPalabras: "",
      precioTotalNum: parcela.precioEtapa1 ? String(Number(parcela.precioEtapa1)) : "",
      anticipoPalabras: "",
      anticipoNum: parcela.anticipoUsd ? String(Number(parcela.anticipoUsd)) : "",
      saldoPalabras: "",
      saldoNum: parcela.saldoUsd ? String(Number(parcela.saldoUsd)) : "",
      cantidadCuotas: parcela.cuotas48 ? "48" : "",
      cuotaMensualPalabras: "",
      cuotaMensual: parcela.cuotas48 ? String(parcela.cuotas48) : "",
      tipoEntrega: (parcela.tipoEntrega as "saldo" | "mes") ?? "saldo",
      mesEntrega: parcela.mesEntrega ?? "",
      anioEntrega: parcela.anioEntrega ?? "",
      nombreCoComprador: "",
      dniCoComprador: "",
      cuitCoComprador: "",
      estadoCivilCoComprador: "",
      porcentajeCoComprador: "50",
    });
    setShowCoComprador(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/crm/parcelas/${parcela.id}/ocr-boleto`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        toast.error("No se pudo procesar la imagen");
        return;
      }
      const data = await res.json();

      // Fecha
      if (data.dia) form.setValue("dia", data.dia);
      if (data.mes) form.setValue("mes", data.mes);
      if (data.anio) form.setValue("anio", data.anio);
      // Comprador
      if (data.nombreComprador) form.setValue("nombreComprador", data.nombreComprador);
      if (data.dniComprador) form.setValue("dniComprador", data.dniComprador);
      if (data.cuitComprador) form.setValue("cuitComprador", data.cuitComprador);
      if (data.domicilioComprador) form.setValue("domicilioComprador", data.domicilioComprador);
      if (data.nacionalidad) form.setValue("nacionalidad", data.nacionalidad);
      if (data.fechaNacimiento) form.setValue("fechaNacimiento", data.fechaNacimiento);
      if (data.estadoCivil) form.setValue("estadoCivil", data.estadoCivil);
      // Co-comprador
      if (data.nombreCoComprador) {
        setShowCoComprador(true);
        form.setValue("nombreCoComprador", data.nombreCoComprador);
        if (data.dniCoComprador) form.setValue("dniCoComprador", data.dniCoComprador);
        if (data.cuitCoComprador) form.setValue("cuitCoComprador", data.cuitCoComprador);
        if (data.estadoCivilCoComprador) form.setValue("estadoCivilCoComprador", data.estadoCivilCoComprador);
        if (data.porcentajeCoComprador) form.setValue("porcentajeCoComprador", data.porcentajeCoComprador);
      }
      // Precio
      if (data.precioTotalPalabras) form.setValue("precioTotalPalabras", data.precioTotalPalabras);
      if (data.precioTotalNum) form.setValue("precioTotalNum", data.precioTotalNum);
      if (data.anticipoPalabras) form.setValue("anticipoPalabras", data.anticipoPalabras);
      if (data.anticipoNum) form.setValue("anticipoNum", data.anticipoNum);
      if (data.saldoPalabras) form.setValue("saldoPalabras", data.saldoPalabras);
      if (data.saldoNum) form.setValue("saldoNum", data.saldoNum);
      if (data.cantidadCuotas) form.setValue("cantidadCuotas", data.cantidadCuotas);
      if (data.cuotaMensualPalabras) form.setValue("cuotaMensualPalabras", data.cuotaMensualPalabras);
      if (data.cuotaMensual) form.setValue("cuotaMensual", data.cuotaMensual);

      toast.success("Datos extraídos. Revisá y completá lo que falte.");
    } catch {
      toast.error("Error al procesar la imagen");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch(`/api/crm/parcelas/${parcela.id}/boleto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, hasCoComprador: showCoComprador }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Error al generar el boleto");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Boleto_Lote${parcela.numero}_Manzana${parcela.manzana}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Boleto generado y descargado");
      setOpen(false);
    } catch {
      toast.error("Error de red al generar el boleto");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Generar Boleto
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between gap-4">
          <DialogTitle>
            Generar Boleto — Lote {parcela.numero} · Manzana {parcela.manzana}
          </DialogTitle>
          <div className="shrink-0">
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
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">

            {/* ── Fecha ── */}
            <section>
              <p className="text-sm font-semibold text-gray-700 mb-3">Fecha del boleto</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="dia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día</FormLabel>
                      <FormControl>
                        <Input placeholder="15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mes</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="mes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MESES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="anio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Año</FormLabel>
                      <FormControl>
                        <Input placeholder="2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            {/* ── Datos comprador ── */}
            <section>
              <p className="text-sm font-semibold text-gray-700 mb-3">Comprador</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { name: "nombreComprador" as const, label: "Nombre completo", placeholder: "Juan Pérez" },
                  { name: "dniComprador" as const, label: "DNI", placeholder: "12345678" },
                  { name: "nacionalidad" as const, label: "Nacionalidad", placeholder: "argentina/o" },
                  { name: "fechaNacimiento" as const, label: "Fecha de nacimiento", placeholder: "01/01/1990" },
                  { name: "cuitComprador" as const, label: "CUIT", placeholder: "20-12345678-9" },
                  { name: "domicilioComprador" as const, label: "Domicilio", placeholder: "Av. Ejemplo 123, CABA" },
                ].map(({ name, label, placeholder }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input placeholder={placeholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <FormField
                  control={form.control}
                  name="estadoCivil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado civil</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="seleccioná" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESTADOS_CIVILES.map((e) => (
                            <SelectItem key={e} value={e}>
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            {/* ── Co-comprador ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id="hasCoComprador"
                  checked={showCoComprador}
                  onCheckedChange={(checked) => setShowCoComprador(!!checked)}
                />
                <label
                  htmlFor="hasCoComprador"
                  className="text-sm font-semibold text-gray-700 cursor-pointer"
                >
                  Agregar co-comprador
                </label>
              </div>

              {showCoComprador && (
                <div className="grid sm:grid-cols-2 gap-3 pl-6">
                  {[
                    { name: "nombreCoComprador" as const, label: "Nombre completo", placeholder: "Juan Pérez" },
                    { name: "dniCoComprador" as const, label: "DNI", placeholder: "12345678" },
                    { name: "cuitCoComprador" as const, label: "CUIT", placeholder: "20-12345678-9" },
                    { name: "porcentajeCoComprador" as const, label: "Porcentaje de compra", placeholder: "50" },
                  ].map(({ name, label, placeholder }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormField
                    control={form.control}
                    name="estadoCivilCoComprador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado civil</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="seleccioná" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ESTADOS_CIVILES.map((e) => (
                              <SelectItem key={e} value={e}>
                                {e}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </section>

            <Separator />

            {/* ── Precio ── */}
            <section>
              <p className="text-sm font-semibold text-gray-700 mb-3">Precio (USD)</p>
              <div className="grid sm:grid-cols-2 gap-3">
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
                          <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {/* Entrega */}
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <FormField
                  control={form.control}
                  name="tipoEntrega"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entrega</FormLabel>
                      <Select value={field.value ?? "saldo"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="saldo">Contra el pago total del saldo</SelectItem>
                          <SelectItem value="mes">Mes específico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("tipoEntrega") === "mes" && (
                  <>
                    <FormField
                      control={form.control}
                      name="mesEntrega"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mes (número)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ej: 3"
                              type="number"
                              min="1"
                              max="12"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="anioEntrega"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Año</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ej: 2027"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </section>

            <Separator />

            {/* ── Inmueble extras ── */}
            <section>
              <p className="text-sm font-semibold text-gray-700 mb-3">Datos del inmueble (opcionales)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { name: "calleInmueble" as const, label: "Calle con frente", placeholder: "Av. Ejemplo" },
                  { name: "limites" as const, label: "Linderos (calles)", placeholder: "Av. Norte y Av. Sur" },
                  { name: "medidas" as const, label: "Medidas y superficie", placeholder: "10 x 25 m — 250 m²" },
                ].map(({ name, label, placeholder }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-green-700 hover:bg-green-800 text-white gap-2"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Descargar Boleto
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
