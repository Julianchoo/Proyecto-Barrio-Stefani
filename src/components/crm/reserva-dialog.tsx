"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";
import { amountToSpanishWords } from "@/lib/number-words";
import type { ParcelaConReserva } from "@/lib/schema";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const schema = z.object({
  fechaReserva: z.string().optional(),
  dia: z.string().min(1, "Requerido"),
  mes: z.string().min(1, "Requerido"),
  anio: z.string().min(4, "Requerido"),
  nombreComprador: z.string().min(1, "Requerido"),
  dniComprador: z.string().min(1, "Requerido"),
  domicilioComprador: z.string().min(1, "Requerido"),
  reservaPalabras: z.string().optional(),
  reservaNum: z.string().optional(),
  lote: z.string().optional(),
  manzana: z.string().optional(),
  calleFrente: z.string().optional(),
  precioTotalPalabras: z.string().optional(),
  precioTotalNum: z.string().optional(),
  anticipoPalabras: z.string().optional(),
  anticipoNum: z.string().optional(),
  saldoPalabras: z.string().optional(),
  saldoNum: z.string().optional(),
  cantidadCuotas: z.string().optional(),
  cuotaMensualPalabras: z.string().optional(),
  cuotaMensual: z.string().optional(),
  numeroCuotaEntrega: z.string().optional(),
  nombreCorredor: z.string().optional(),
  dniCorredor: z.string().optional(),
  honorariosPalabras: z.string().optional(),
  honorariosNum: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type ReservaDialogProps = {
  parcela?: ParcelaConReserva;
  parcelaId?: number;
  disabled?: boolean;
  trigger?: ReactNode;
};

const emptyDefaults: FormValues = {
  fechaReserva: "",
  dia: "",
  mes: "",
  anio: "",
  nombreComprador: "",
  dniComprador: "",
  domicilioComprador: "",
  reservaPalabras: "",
  reservaNum: "",
  lote: "",
  manzana: "",
  calleFrente: "",
  precioTotalPalabras: "",
  precioTotalNum: "",
  anticipoPalabras: "",
  anticipoNum: "",
  saldoPalabras: "",
  saldoNum: "",
  cantidadCuotas: "",
  cuotaMensualPalabras: "",
  cuotaMensual: "",
  numeroCuotaEntrega: "",
  nombreCorredor: "",
  dniCorredor: "",
  honorariosPalabras: "CUATROCIENTOS CINCUENTA",
  honorariosNum: "450",
};

function parseFecha(value: string | null | undefined) {
  const date = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    dia: String(safeDate.getDate()),
    mes: MESES[safeDate.getMonth()] ?? "enero",
    anio: String(safeDate.getFullYear()),
    iso: `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}-${String(safeDate.getDate()).padStart(2, "0")}`,
  };
}

function cleanNumber(value: string | number | null | undefined) {
  if (!value) return "";
  const numeric = Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return String(value);
  return String(Math.round(numeric));
}

function defaultWords(value: string) {
  return amountToSpanishWords(value) ?? "";
}

function buildDefaults(parcela: ParcelaConReserva): FormValues {
  const fecha = parseFecha(parcela.fechaReserva);
  const anticipoNum = cleanNumber(parcela.anticipoNum ?? parcela.anticipoUsd);
  const precioTotalNum = cleanNumber(parcela.precioTotalNum ?? parcela.precioEtapa1);
  const saldoNum = cleanNumber(parcela.saldoNum ?? parcela.saldoUsd);
  const cuotaMensual = cleanNumber(parcela.cuotaMensual ?? parcela.cuotas48);

  return {
    fechaReserva: fecha.iso,
    dia: fecha.dia,
    mes: fecha.mes,
    anio: fecha.anio,
    nombreComprador: parcela.nombreComprador ?? "",
    dniComprador: parcela.dniCuit ?? "",
    domicilioComprador: parcela.domicilioComprador ?? "",
    reservaPalabras: parcela.anticipoPalabras ?? defaultWords(anticipoNum),
    reservaNum: anticipoNum,
    lote: parcela.parcela ?? "",
    manzana: parcela.manzana ?? "",
    calleFrente: parcela.calleFrente ?? "",
    precioTotalPalabras: parcela.precioTotalPalabras ?? defaultWords(precioTotalNum),
    precioTotalNum,
    anticipoPalabras: parcela.anticipoPalabras ?? defaultWords(anticipoNum),
    anticipoNum,
    saldoPalabras: parcela.saldoPalabras ?? defaultWords(saldoNum),
    saldoNum,
    cantidadCuotas: parcela.cantidadCuotas ?? "",
    cuotaMensualPalabras: parcela.cuotaMensualPalabras ?? defaultWords(cuotaMensual),
    cuotaMensual,
    numeroCuotaEntrega: parcela.tipoEntrega === "cuota" ? parcela.mesEntrega ?? "" : "",
    nombreCorredor: parcela.nombreCorredor ?? "",
    dniCorredor: "",
    honorariosPalabras: "CUATROCIENTOS CINCUENTA",
    honorariosNum: "450",
  };
}

export function ReservaDialog({
  parcela,
  parcelaId,
  disabled,
  trigger,
}: ReservaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loadedParcela, setLoadedParcela] = useState<ParcelaConReserva | null>(
    parcela ?? null
  );
  const [loading, setLoading] = useState(false);
  const targetParcela = parcela ?? loadedParcela;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: targetParcela ? buildDefaults(targetParcela) : emptyDefaults,
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    if (parcela) {
      form.reset(buildDefaults(parcela));
      return;
    }
    if (!parcelaId || loadedParcela) return;

    setLoading(true);
    fetch(`/api/crm/parcelas/${parcelaId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch failed");
        return (await res.json()) as ParcelaConReserva;
      })
      .then((data) => {
        setLoadedParcela(data);
        form.reset(buildDefaults(data));
      })
      .catch(() => {
        toast.error("No se pudieron cargar los datos del lote");
      })
      .finally(() => setLoading(false));
  }

  function syncFechaReserva(value: string) {
    const parsed = parseFecha(value);
    form.setValue("dia", parsed.dia);
    form.setValue("mes", parsed.mes);
    form.setValue("anio", parsed.anio);
  }

  function fillAmountWords() {
    const pairs: Array<[keyof FormValues, keyof FormValues]> = [
      ["reservaNum", "reservaPalabras"],
      ["precioTotalNum", "precioTotalPalabras"],
      ["anticipoNum", "anticipoPalabras"],
      ["saldoNum", "saldoPalabras"],
      ["cuotaMensual", "cuotaMensualPalabras"],
      ["honorariosNum", "honorariosPalabras"],
    ];

    for (const [numberField, wordsField] of pairs) {
      const words = amountToSpanishWords(form.getValues(numberField));
      if (words) form.setValue(wordsField, words, { shouldDirty: true });
    }
  }

  async function onSubmit(values: FormValues) {
    if (!targetParcela) return;

    try {
      const res = await fetch(`/api/crm/parcelas/${targetParcela.id}/reserva`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const error = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(error?.error ?? "Error al generar la reserva");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reserva_Lote${targetParcela.parcela}_Manzana${targetParcela.manzana}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Reserva generada y descargada");
      setOpen(false);
    } catch {
      toast.error("Error de red al generar la reserva");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2" disabled={disabled}>
            <FileText className="h-4 w-4" />
            Generar Reserva
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar recibo de reserva</DialogTitle>
        </DialogHeader>

        {loading || !targetParcela ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando datos...
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Fecha</p>
                <FormField
                  control={form.control}
                  name="fechaReserva"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de reserva</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(event) => {
                            field.onChange(event);
                            syncFechaReserva(event.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <Separator />

              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Comprador</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["nombreComprador", "Nombre comprador"],
                    ["dniComprador", "DNI comprador"],
                    ["domicilioComprador", "Domicilio comprador"],
                  ].map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as keyof FormValues}
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
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">Importes</p>
                  <Button type="button" variant="outline" size="sm" onClick={fillAmountWords}>
                    Completar letras
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["reservaPalabras", "Reserva recibida (letras)"],
                    ["reservaNum", "Reserva recibida (USD)"],
                    ["precioTotalPalabras", "Precio total (letras)"],
                    ["precioTotalNum", "Precio total (USD)"],
                    ["anticipoPalabras", "Anticipo (letras)"],
                    ["anticipoNum", "Anticipo (USD)"],
                    ["saldoPalabras", "Saldo (letras)"],
                    ["saldoNum", "Saldo (USD)"],
                    ["cantidadCuotas", "Cantidad cuotas"],
                    ["cuotaMensualPalabras", "Cuota mensual (letras)"],
                    ["cuotaMensual", "Cuota mensual (USD)"],
                    ["numeroCuotaEntrega", "Cuota de entrega"],
                  ].map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as keyof FormValues}
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
              </section>

              <Separator />

              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Lote y broker</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["lote", "Lote"],
                    ["manzana", "Manzana"],
                    ["calleFrente", "Calle frente"],
                    ["nombreCorredor", "Broker"],
                    ["dniCorredor", "DNI broker"],
                    ["honorariosPalabras", "Honorarios (letras)"],
                    ["honorariosNum", "Honorarios (USD)"],
                  ].map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name as keyof FormValues}
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
              </section>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-green-700 hover:bg-green-800 text-white">
                  Descargar reserva
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
