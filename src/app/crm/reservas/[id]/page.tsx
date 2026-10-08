"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CreditCard, FileText, MapPin } from "lucide-react";
import { BoletoDialog } from "@/components/crm/boleto-dialog";
import { CambiarEstadoReserva } from "@/components/crm/cambiar-estado-reserva";
import { ReservaDialog } from "@/components/crm/reserva-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import {
  estadoColors,
  estadoLabels,
  formatDate,
  formatPaymentMode,
  isVigente,
  parcelaFromReserva,
  sortByCreatedDesc,
  type ReservaRow,
} from "@/lib/reservas-ui";

function usd(value: string | null | undefined) {
  return value ? `USD ${value}` : "-";
}

function Section({ title, items }: { title: string; items: Array<[string, string | null | undefined]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          {items.map(([label, value]) => (
            <div key={label}>
              <span className="text-gray-500">{label}</span>
              <p className="mt-0.5 font-medium text-gray-900">{value || "-"}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReservaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [reservas, setReservas] = useState<ReservaRow[] | null>(null);

  // ponytail: trae todas las reservas y filtra en el navegador; alcanza para el volumen del barrio.
  const fetchReservas = useCallback(async () => {
    const res = await fetch("/api/crm/reservas");
    setReservas(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchReservas();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchReservas]);

  const reserva = reservas?.find((item) => item.id === Number(id));
  const historial = useMemo(
    () => sortByCreatedDesc((reservas ?? []).filter((item) => item.parcelaId === reserva?.parcelaId)),
    [reservas, reserva?.parcelaId]
  );
  const vigenteDelLote = historial.find((item) => isVigente(item.estado));
  const isAdmin = session?.user?.role === "admin";
  // Reserva y Boleto guardan datos en la reserva vigente del lote: solo se usan desde una
  // reserva activa o realizada. Realizada: solo admin. Activa: admin o el comercial que la tomo.
  const canUseDocumentos =
    reserva !== undefined &&
    isVigente(reserva.estado) &&
    (isAdmin || (reserva.estado === "activa" && reserva.reservadoPor === session?.user?.email));

  if (!reservas) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!reserva) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/crm/reservas">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Reservas
          </Link>
        </Button>
        <p className="text-sm text-gray-500">Reserva no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild variant="ghost" size="icon">
          <Link href="/crm/reservas" aria-label="Volver a reservas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Reserva #{reserva.id}</h1>
            {isAdmin ? (
              <CambiarEstadoReserva reserva={reserva} onChanged={fetchReservas} />
            ) : (
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${estadoColors[reserva.estado]}`}>
                {estadoLabels[reserva.estado]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {reserva.nombreComprador ?? "Sin comprador"} · Lote {reserva.loteNumero} · Mz{" "}
            {reserva.manzana ?? "-"} / Parc. {reserva.parcela ?? "-"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reserva.estado === "activa" && isAdmin && (
            <CambiarEstadoReserva
              reserva={reserva}
              onChanged={fetchReservas}
              fixedTarget="cancelada"
              label="Cancelar reserva"
            />
          )}
          {isVigente(reserva.estado) && (
            <>
              <ReservaDialog
                parcela={parcelaFromReserva(reserva)}
                disabled={!canUseDocumentos}
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={!canUseDocumentos}>
                    <FileText className="mr-1 h-4 w-4" />
                    Reserva
                  </Button>
                }
              />
              <BoletoDialog
                parcela={parcelaFromReserva(reserva)}
                disabled={!canUseDocumentos}
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={!canUseDocumentos}>
                    <FileText className="mr-1 h-4 w-4" />
                    Boleto
                  </Button>
                }
              />
            </>
          )}
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/crm/cuotas/${reserva.id}`}>
                <CreditCard className="mr-1 h-4 w-4" />
                Cuenta
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={`/crm/lotes/${reserva.parcelaId}`}>
              <MapPin className="mr-1 h-4 w-4" />
              Ver lote
            </Link>
          </Button>
        </div>
      </div>

      {!isVigente(reserva.estado) && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta reserva está {estadoLabels[reserva.estado].toLowerCase()}.{" "}
            {vigenteDelLote ? (
              <>
                El lote {reserva.loteNumero} hoy tiene la reserva{" "}
                <Link href={`/crm/reservas/${vigenteDelLote.id}`} className="font-medium underline">
                  #{vigenteDelLote.id} ({vigenteDelLote.nombreComprador ?? "sin comprador"},{" "}
                  {estadoLabels[vigenteDelLote.estado].toLowerCase()})
                </Link>
                .
              </>
            ) : (
              <>El lote {reserva.loteNumero} no tiene una reserva vigente.</>
            )}
          </span>
        </div>
      )}

      <Section
        title="Comprador"
        items={[
          ["Nombre", reserva.nombreComprador],
          ["DNI / CUIT", reserva.dniCuit],
          ["Teléfono", reserva.telefono],
          ["Email", reserva.emailComprador],
          ["Domicilio", reserva.domicilioComprador],
          ["Nacionalidad", reserva.nacionalidad],
          ["Fecha de nacimiento", formatDate(reserva.fechaNacimiento ?? null)],
          ["Estado civil", reserva.estadoCivil],
          ["CUIT comprador", reserva.cuitComprador],
        ]}
      />

      {reserva.nombreCoComprador && (
        <Section
          title="Co-comprador"
          items={[
            ["Nombre", reserva.nombreCoComprador],
            ["DNI", reserva.dniCoComprador],
            ["Nacionalidad", reserva.nacionalidadCoComprador],
            ["Fecha de nacimiento", reserva.fechaNacimientoCoComprador],
            ["Domicilio", reserva.domicilioCoComprador],
            ["CUIT", reserva.cuitCoComprador],
            ["Estado civil", reserva.estadoCivilCoComprador],
            ["Porcentaje", reserva.porcentajeCoComprador],
          ]}
        />
      )}

      <Section
        title="Condiciones de pago"
        items={[
          ["Modalidad", formatPaymentMode(reserva)],
          ["Precio total", usd(reserva.precioTotalNum)],
          ["Reserva / seña", usd(reserva.reservaNum)],
          ["Anticipo", usd(reserva.anticipoNum)],
          ["Saldo", usd(reserva.saldoNum)],
          ["Cantidad de cuotas", reserva.cantidadCuotas],
          ["Cuota mensual", usd(reserva.cuotaMensual)],
          [
            "Entrega",
            reserva.tipoEntrega === "cuota" ? `Cuota ${reserva.mesEntrega ?? "-"}` : reserva.tipoEntrega ? "Al saldo" : null,
          ],
        ]}
      />

      <Section
        title="Fechas y comercial"
        items={[
          ["Fecha reserva", formatDate(reserva.fechaReserva)],
          ["Vencimiento", formatDate(reserva.fechaVencimiento)],
          ["Firma", formatDate(reserva.fechaFirma)],
          ["Creada", formatDate(reserva.reservaCreatedAt)],
          ["Reservado por", reserva.reservadoPor],
          ["Corredor", reserva.nombreCorredor],
          ["Email corredor", reserva.emailCorredor],
          ["Último cambio por", reserva.modificadoPor],
        ]}
      />

      {reserva.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-gray-900">{reserva.observaciones}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
