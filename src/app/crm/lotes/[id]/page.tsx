"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const schema = z.object({
  estado: z.enum(["disponible", "no_disponible", "reservado", "vendido"]),
  nombreComprador: z.string().nullable().optional(),
  dniCuit: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  emailComprador: z.string().email().or(z.literal("")).nullable().optional(),
  nombreCorredor: z.string().nullable().optional(),
  emailCorredor: z.string().email().or(z.literal("")).nullable().optional(),
  formaPago: z.string().nullable().optional(),
  fechaReserva: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<Parcela | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    fetch(`/api/crm/parcelas/${id}`)
      .then((r) => r.json())
      .then((data: Parcela) => {
        setLote(data);
        form.reset({
          estado: data.estado,
          nombreComprador: data.nombreComprador ?? "",
          dniCuit: data.dniCuit ?? "",
          telefono: data.telefono ?? "",
          emailComprador: data.emailComprador ?? "",
          nombreCorredor: data.nombreCorredor ?? "",
          emailCorredor: data.emailCorredor ?? "",
          formaPago: data.formaPago ?? "",
          fechaReserva: data.fechaReserva ?? "",
          fechaVencimiento: data.fechaVencimiento ?? "",
          observaciones: data.observaciones ?? "",
        });
        setLoading(false);
      });
  }, [id, form]);

  async function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      payload[k] = v === "" ? null : v;
    }
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Lote N° {lote.numero}
          </h1>
          <p className="text-sm text-gray-500">
            Manzana {lote.manzana} · Parcela {lote.parcela}
          </p>
        </div>
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
        <CardHeader>
          <CardTitle className="text-base">Datos de reserva / comprador</CardTitle>
        </CardHeader>
        <CardContent>
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
