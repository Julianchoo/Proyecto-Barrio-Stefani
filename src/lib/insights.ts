import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Métricas de ventas y cobranza para /crm/insights (solo admins).
// Venta = reserva "realizada", fechada por fecha de firma, en USD (precio_total_num).
// Cuotas en pesos se pasan a USD con el último dólar BNA vendedor cargado.
// Se excluyen contratos de reservas canceladas.

// El estado de cada cuota se recalcula con la fecha de hoy, con la misma regla que
// statusForCuota en cuenta-corriente.ts: si cambia allá, hay que cambiarlo acá.
const cuotasBase = sql`
  hoy AS (SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS d),
  tc AS (SELECT valor::numeric AS v, fecha FROM tipos_cambio WHERE tipo = 'bna_vendedor' ORDER BY fecha DESC LIMIT 1),
  q AS (
    SELECT c.id, c.contrato_id, c.numero, c.fecha_vencimiento, c.moneda, c.saldo::numeric AS saldo, k.modalidad,
      CASE
        WHEN c.saldo::numeric <= 0 THEN 'pagada'
        WHEN c.fecha_vencimiento < (SELECT d FROM hoy) THEN 'vencida'
        ELSE 'a_vencer'
      END AS est,
      CASE WHEN c.moneda = 'usd' THEN c.saldo::numeric ELSE c.saldo::numeric / (SELECT v FROM tc) END AS saldo_usd
    FROM cuotas c
    JOIN contratos k ON k.id = c.contrato_id
    JOIN reservas r ON r.id = k.reserva_id
    WHERE r.estado <> 'cancelada' AND c.estado <> 'cancelada'
  )`;

// Una fila por cuota pagada: días entre el vencimiento y el último pago que la canceló.
const pagosConCuota = sql`
  p AS (
    SELECT max(pg.fecha_pago) - c.fecha_vencimiento AS dias
    FROM cuotas c
    JOIN contratos k ON k.id = c.contrato_id
    JOIN reservas r ON r.id = k.reserva_id
    JOIN pagos pg ON pg.cuota_id = c.id AND pg.estado = 'activo'
    WHERE r.estado <> 'cancelada' AND c.estado <> 'cancelada' AND c.saldo::numeric <= 0
    GROUP BY c.id, c.fecha_vencimiento
  )`;

type Raw = Record<string, string | number | null>;

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v));

async function rows(query: ReturnType<typeof sql>) {
  return (await db.execute(query)) as unknown as Raw[];
}

export async function getInsights() {
  const [
    ventasKpis,
    ventasMes,
    cobranzaMes,
    ventasCorredor,
    ventasModalidad,
    ventasDetalle,
    cobranzaKpis,
    cuotasEstado,
    porCobrarMes,
    puntualidad,
    cuotasVencidas,
    contratosEstado,
  ] = await Promise.all([
    rows(sql`
      SELECT
        (SELECT count(*) FROM reservas WHERE estado = 'realizada') AS lotes_vendidos,
        (SELECT round(sum(precio_total_num::numeric)) FROM reservas WHERE estado = 'realizada') AS facturacion_usd,
        (SELECT round(avg(precio_total_num::numeric)) FROM reservas WHERE estado = 'realizada') AS ticket_promedio_usd,
        (SELECT count(*) FROM reservas WHERE estado = 'activa') AS reservas_activas,
        (SELECT round(sum(precio_total_num::numeric)) FROM reservas WHERE estado = 'activa') AS reservas_activas_usd,
        (SELECT round(sum(monto_usd::numeric)) FROM pagos WHERE estado = 'activo') AS cobrado_usd,
        (SELECT count(*) FROM pagos WHERE estado = 'activo' AND monto_usd IS NULL) AS pagos_sin_tc,
        (SELECT count(*) FROM parcelas WHERE estado = 'disponible') AS lotes_disponibles,
        (SELECT count(*) FROM parcelas WHERE estado IN ('vendido', 'reservado', 'disponible')) AS lotes_en_venta`),
    rows(sql`
      SELECT to_char(date_trunc('month', fecha_firma), 'YYYY-MM') AS mes, count(*) AS lotes, round(sum(precio_total_num::numeric)) AS usd
      FROM reservas WHERE estado = 'realizada' AND fecha_firma IS NOT NULL
      GROUP BY 1 ORDER BY 1`),
    rows(sql`
      SELECT to_char(date_trunc('month', fecha_pago), 'YYYY-MM') AS mes, count(*) AS pagos, round(sum(monto_usd::numeric)) AS usd
      FROM pagos WHERE estado = 'activo'
      GROUP BY 1 ORDER BY 1`),
    rows(sql`
      SELECT coalesce(initcap(trim(nombre_corredor)), 'Sin corredor') AS corredor, count(*) AS lotes, round(sum(precio_total_num::numeric)) AS usd
      FROM reservas WHERE estado = 'realizada'
      GROUP BY 1 ORDER BY usd DESC`),
    rows(sql`
      SELECT
        CASE
          WHEN forma_pago = 'contado' THEN 'Contado'
          WHEN modalidad_contrato = 'usd_fijo' THEN 'Financiado USD fijo'
          WHEN modalidad_contrato = 'pesos_cac' THEN 'Financiado pesos CAC'
          ELSE 'Financiado (sin modalidad)'
        END AS modalidad,
        count(*) AS lotes, round(sum(precio_total_num::numeric)) AS usd
      FROM reservas WHERE estado = 'realizada'
      GROUP BY 1 ORDER BY lotes DESC`),
    rows(sql`
      SELECT r.id AS venta, to_char(r.fecha_firma, 'YYYY-MM-DD') AS fecha_firma, p.manzana, p.parcela,
        p.superficie_m2::numeric AS m2, round(r.precio_total_num::numeric) AS precio_usd,
        CASE WHEN r.forma_pago = 'contado' THEN 'Contado' ELSE coalesce(r.cantidad_cuotas, '—') || ' cuotas' END AS plan,
        coalesce(initcap(trim(r.nombre_corredor)), 'Sin corredor') AS corredor
      FROM reservas r JOIN parcelas p ON p.id = r.parcela_id
      WHERE r.estado = 'realizada'
      ORDER BY r.fecha_firma DESC NULLS LAST, r.id DESC`),
    rows(sql`
      WITH ${cuotasBase}, ${pagosConCuota}
      SELECT
        round(coalesce(sum(saldo_usd) FILTER (WHERE est <> 'pagada'), 0)) AS por_cobrar_usd,
        round(coalesce(sum(saldo_usd) FILTER (WHERE est = 'vencida'), 0)) AS vencido_usd,
        count(*) FILTER (WHERE est = 'vencida') AS cuotas_vencidas,
        count(DISTINCT contrato_id) FILTER (WHERE est = 'vencida') AS contratos_con_mora,
        count(DISTINCT contrato_id) AS contratos,
        round(coalesce(sum(saldo_usd) FILTER (WHERE est = 'a_vencer' AND fecha_vencimiento < (SELECT d FROM hoy) + 30), 0)) AS proximos_30d_usd,
        count(*) FILTER (WHERE est = 'pagada') AS cuotas_pagadas,
        count(*) AS cuotas_totales,
        to_char(max(fecha_vencimiento), 'YYYY-MM') AS ultima_cuota,
        (SELECT avg((dias <= 0)::int) FROM p) AS pct_a_tiempo,
        (SELECT round(avg(-dias), 1) FROM p) AS dias_anticipo_prom,
        (SELECT v FROM tc) AS tipo_cambio,
        (SELECT to_char(fecha, 'YYYY-MM-DD') FROM tc) AS fecha_tc
      FROM q`),
    rows(sql`
      WITH ${cuotasBase}
      SELECT x.estado, x.orden, count(q.id) AS cuotas, round(coalesce(sum(q.saldo_usd), 0)) AS saldo_usd
      FROM (VALUES ('Pagadas', 1), ('Vencidas', 2), ('A vencer · en USD', 3), ('A vencer · en pesos', 4)) AS x(estado, orden)
      LEFT JOIN q ON (x.orden = 1 AND q.est = 'pagada')
        OR (x.orden = 2 AND q.est = 'vencida')
        OR (x.orden = 3 AND q.est = 'a_vencer' AND q.moneda = 'usd')
        OR (x.orden = 4 AND q.est = 'a_vencer' AND q.moneda = 'ars')
      GROUP BY 1, 2 ORDER BY 2`),
    rows(sql`
      WITH ${cuotasBase}
      SELECT to_char(date_trunc('month', fecha_vencimiento), 'YYYY-MM') AS mes,
        round(coalesce(sum(saldo_usd) FILTER (WHERE moneda = 'usd'), 0)) AS en_usd,
        round(coalesce(sum(saldo_usd) FILTER (WHERE moneda = 'ars'), 0)) AS en_pesos,
        count(*) AS cuotas
      FROM q WHERE est = 'a_vencer'
      GROUP BY 1 ORDER BY 1`),
    rows(sql`
      WITH ${pagosConCuota}
      SELECT x.tramo, x.orden, count(p.dias) AS cuotas
      FROM (VALUES
        ('Más de 7 días antes', 1, -100000, -8),
        ('1 a 7 días antes', 2, -7, -1),
        ('El día del vencimiento', 3, 0, 0),
        ('1 a 5 días tarde', 4, 1, 5),
        ('Más de 5 días tarde', 5, 6, 100000)
      ) AS x(tramo, orden, desde, hasta)
      LEFT JOIN p ON p.dias BETWEEN x.desde AND x.hasta
      GROUP BY 1, 2 ORDER BY 2`),
    rows(sql`
      WITH ${cuotasBase}
      SELECT q.id AS cuota, q.contrato_id AS contrato, pa.manzana, pa.parcela, q.numero,
        to_char(q.fecha_vencimiento, 'YYYY-MM-DD') AS vencimiento,
        (SELECT d FROM hoy) - q.fecha_vencimiento AS dias_atraso,
        upper(q.moneda::text) AS moneda, q.saldo, round(q.saldo_usd) AS saldo_usd
      FROM q
      JOIN contratos k ON k.id = q.contrato_id
      JOIN reservas r ON r.id = k.reserva_id
      JOIN parcelas pa ON pa.id = r.parcela_id
      WHERE q.est = 'vencida'
      ORDER BY dias_atraso DESC, q.id`),
    rows(sql`
      WITH ${cuotasBase}
      SELECT q.contrato_id AS contrato, pa.manzana, pa.parcela,
        CASE min(q.modalidad::text)
          WHEN 'usd_fijo' THEN 'USD fijo'
          WHEN 'pesos_cac' THEN 'Pesos CAC'
          ELSE 'Requiere revisión'
        END AS modalidad,
        count(*) FILTER (WHERE q.est = 'pagada') AS pagadas,
        count(*) AS cuotas,
        count(*) FILTER (WHERE q.est = 'vencida') AS vencidas,
        round(coalesce(sum(q.saldo_usd) FILTER (WHERE q.est = 'vencida'), 0)) AS vencido_usd,
        round(coalesce(sum(q.saldo_usd) FILTER (WHERE q.est <> 'pagada'), 0)) AS saldo_usd,
        to_char(min(q.fecha_vencimiento) FILTER (WHERE q.est = 'a_vencer'), 'YYYY-MM-DD') AS proximo_venc
      FROM q
      JOIN contratos k ON k.id = q.contrato_id
      JOIN reservas r ON r.id = k.reserva_id
      JOIN parcelas pa ON pa.id = r.parcela_id
      GROUP BY q.contrato_id, pa.manzana, pa.parcela
      ORDER BY vencido_usd DESC, saldo_usd DESC`),
  ]);

  const vk = ventasKpis[0] ?? {};
  const ck = cobranzaKpis[0] ?? {};
  const enVenta = num(vk.lotes_en_venta);

  return {
    ventas: {
      lotesVendidos: num(vk.lotes_vendidos),
      facturacionUsd: num(vk.facturacion_usd),
      ticketPromedioUsd: num(vk.ticket_promedio_usd),
      reservasActivas: num(vk.reservas_activas),
      reservasActivasUsd: num(vk.reservas_activas_usd),
      cobradoUsd: num(vk.cobrado_usd),
      pagosSinTc: num(vk.pagos_sin_tc),
      lotesDisponibles: num(vk.lotes_disponibles),
      lotesEnVenta: enVenta,
      pctVendido: enVenta > 0 ? num(vk.lotes_vendidos) / enVenta : 0,
      porMes: ventasMes.map((r) => ({ mes: String(r.mes), lotes: num(r.lotes), usd: num(r.usd) })),
      cobranzaPorMes: cobranzaMes.map((r) => ({ mes: String(r.mes), pagos: num(r.pagos), usd: num(r.usd) })),
      porCorredor: ventasCorredor.map((r) => ({ nombre: String(r.corredor), lotes: num(r.lotes), usd: num(r.usd) })),
      porModalidad: ventasModalidad.map((r) => ({ nombre: String(r.modalidad), lotes: num(r.lotes), usd: num(r.usd) })),
      detalle: ventasDetalle.map((r) => ({
        venta: num(r.venta),
        fechaFirma: str(r.fecha_firma),
        manzana: str(r.manzana),
        parcela: str(r.parcela),
        m2: num(r.m2),
        precioUsd: num(r.precio_usd),
        plan: String(r.plan),
        corredor: String(r.corredor),
      })),
    },
    cobranza: {
      porCobrarUsd: num(ck.por_cobrar_usd),
      vencidoUsd: num(ck.vencido_usd),
      cuotasVencidas: num(ck.cuotas_vencidas),
      contratosConMora: num(ck.contratos_con_mora),
      contratos: num(ck.contratos),
      proximos30dUsd: num(ck.proximos_30d_usd),
      cuotasPagadas: num(ck.cuotas_pagadas),
      cuotasTotales: num(ck.cuotas_totales),
      ultimaCuota: str(ck.ultima_cuota),
      pctATiempo: ck.pct_a_tiempo === null || ck.pct_a_tiempo === undefined ? null : num(ck.pct_a_tiempo),
      diasAnticipoProm: ck.dias_anticipo_prom === null || ck.dias_anticipo_prom === undefined ? null : num(ck.dias_anticipo_prom),
      tipoCambio: ck.tipo_cambio === null || ck.tipo_cambio === undefined ? null : num(ck.tipo_cambio),
      fechaTipoCambio: str(ck.fecha_tc),
      estadoCuotas: cuotasEstado.map((r) => ({ estado: String(r.estado), cuotas: num(r.cuotas), saldoUsd: num(r.saldo_usd) })),
      porMes: porCobrarMes.map((r) => ({ mes: String(r.mes), enUsd: num(r.en_usd), enPesos: num(r.en_pesos), cuotas: num(r.cuotas) })),
      puntualidad: puntualidad.map((r) => ({ tramo: String(r.tramo), tarde: num(r.orden) >= 4, cuotas: num(r.cuotas) })),
      vencidas: cuotasVencidas.map((r) => ({
        cuota: num(r.cuota),
        contrato: num(r.contrato),
        manzana: str(r.manzana),
        parcela: str(r.parcela),
        numero: num(r.numero),
        vencimiento: str(r.vencimiento),
        diasAtraso: num(r.dias_atraso),
        moneda: String(r.moneda),
        saldo: num(r.saldo),
        saldoUsd: num(r.saldo_usd),
      })),
      contratosEstado: contratosEstado.map((r) => ({
        contrato: num(r.contrato),
        manzana: str(r.manzana),
        parcela: str(r.parcela),
        modalidad: String(r.modalidad),
        pagadas: num(r.pagadas),
        cuotas: num(r.cuotas),
        vencidas: num(r.vencidas),
        vencidoUsd: num(r.vencido_usd),
        saldoUsd: num(r.saldo_usd),
        proximoVenc: str(r.proximo_venc),
      })),
    },
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;
