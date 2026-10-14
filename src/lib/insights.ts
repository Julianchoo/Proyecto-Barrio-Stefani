import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Métricas de ventas y cobranza para /crm/insights (solo admins).
// Venta = reserva "realizada", fechada por fecha de firma, en USD (precio_total_num).
// Cuotas en pesos se pasan a USD con el último dólar BNA vendedor cargado.
// Solo cuentan contratos de ventas firmadas (reserva realizada), como la cuenta corriente.

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
    WHERE r.estado = 'realizada' AND c.estado <> 'cancelada'
  )`;

// Una fila por cuota pagada: días entre el vencimiento y el último pago que la canceló.
const pagosConCuota = sql`
  p AS (
    SELECT max(pg.fecha_pago) - c.fecha_vencimiento AS dias
    FROM cuotas c
    JOIN contratos k ON k.id = c.contrato_id
    JOIN reservas r ON r.id = k.reserva_id
    JOIN pagos pg ON pg.cuota_id = c.id AND pg.estado = 'activo'
    WHERE r.estado = 'realizada' AND c.estado <> 'cancelada' AND c.saldo::numeric <= 0
    GROUP BY c.id, c.fecha_vencimiento
  )`;

const cuotasDe = (col: string) =>
  sql.raw(`coalesce(k.cantidad_cuotas, nullif(regexp_replace(${col}, '[^0-9]', '', 'g'), '')::int)`);

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
    proyeccion,
    ventasPlazo,
    rentabilidadRaw,
    cuotasActivasRaw,
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
        (SELECT count(*) FROM parcelas WHERE estado IN ('vendido', 'reservado', 'disponible')) AS lotes_en_venta,
        -- Precio de lista: precio_base y, si falta, precio_etapa1 (igual que la API de parcelas).
        (SELECT round(sum(coalesce(precio_base, precio_etapa1)::numeric)) FROM parcelas WHERE estado <> 'vendido') AS valuacion_restantes_usd,
        (SELECT count(*) FROM parcelas WHERE estado <> 'vendido') AS lotes_restantes,
        (SELECT count(*) FROM parcelas WHERE estado <> 'vendido' AND coalesce(precio_base, precio_etapa1) IS NULL) AS lotes_sin_precio,
        -- Desglose de la facturación vendida. Precio del boleto = anticipo + cuotas (con interés).
        -- Contado y anticipos se cobran al firmar.
        (SELECT round(sum(precio_total_num::numeric)) FROM reservas WHERE estado = 'realizada' AND forma_pago = 'contado') AS contado_usd,
        (SELECT count(*) FROM reservas WHERE estado = 'realizada' AND forma_pago = 'contado') AS ventas_contado,
        (SELECT count(*) FROM reservas WHERE estado = 'realizada' AND forma_pago IS DISTINCT FROM 'contado') AS ventas_financiadas,
        (SELECT count(*) FROM reservas WHERE estado = 'realizada' AND fecha_firma IS NULL) AS firmas_sin_fecha,
        (SELECT round(coalesce(sum(precio_total_num::numeric), 0)) FROM reservas WHERE estado = 'realizada' AND fecha_firma IS NULL) AS firmas_sin_fecha_usd,
        (SELECT round(sum(CASE WHEN trim(anticipo_num) ~ '^[0-9]+([.][0-9]+)?$' THEN trim(anticipo_num)::numeric ELSE 0 END))
          FROM reservas WHERE estado = 'realizada' AND forma_pago IS DISTINCT FROM 'contado') AS anticipos_usd,
        -- Ventas financiadas que todavía no tienen cuenta corriente: su saldo aún no está en cuotas.
        (SELECT round(sum(r.precio_total_num::numeric - CASE WHEN trim(r.anticipo_num) ~ '^[0-9]+([.][0-9]+)?$' THEN trim(r.anticipo_num)::numeric ELSE 0 END))
          FROM reservas r LEFT JOIN contratos k ON k.reserva_id = r.id
          WHERE r.estado = 'realizada' AND r.forma_pago IS DISTINCT FROM 'contado' AND k.id IS NULL) AS saldo_sin_cuenta_usd,
        (SELECT count(*) FROM reservas r LEFT JOIN contratos k ON k.reserva_id = r.id
          WHERE r.estado = 'realizada' AND r.forma_pago IS DISTINCT FROM 'contado' AND k.id IS NULL) AS ventas_sin_cuenta`),
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
          WHEN r.forma_pago = 'contado' THEN 'Contado'
          WHEN coalesce(k.modalidad, r.modalidad_contrato) = 'usd_fijo' THEN 'Financiado USD fijo'
          WHEN coalesce(k.modalidad, r.modalidad_contrato) = 'pesos_cac' THEN 'Financiado pesos CAC'
          ELSE 'Financiado (sin modalidad)'
        END AS modalidad,
        count(*) AS lotes, round(sum(r.precio_total_num::numeric)) AS usd
      FROM reservas r LEFT JOIN contratos k ON k.reserva_id = r.id
      WHERE r.estado = 'realizada'
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
        count(*) FILTER (WHERE est <> 'pagada') AS cuotas_pendientes,
        count(*) AS cuotas_totales,
        to_char(max(fecha_vencimiento), 'YYYY-MM') AS ultima_cuota,
        (SELECT avg((dias <= 0)::int) FROM p) AS pct_a_tiempo,
        (SELECT round(avg(-dias), 1) FROM p) AS dias_anticipo_prom,
        (SELECT v FROM tc) AS tipo_cambio,
        (SELECT to_char(fecha, 'YYYY-MM-DD') FROM tc) AS fecha_tc
      FROM q`),
    rows(sql`
      WITH ${cuotasBase}
      SELECT to_char((SELECT d FROM hoy) + interval '1 month', 'YYYY-MM') AS mes,
        round(coalesce(sum(saldo_usd), 0)) AS usd, count(*) AS cuotas
      FROM q
      WHERE est <> 'pagada'
        AND date_trunc('month', fecha_vencimiento) = date_trunc('month', (SELECT d FROM hoy) + interval '1 month')`),
    rows(sql`
      WITH v AS (
        SELECT r.precio_total_num::numeric AS usd,
          CASE WHEN lower(r.forma_pago) = 'contado' THEN 0 ELSE ${cuotasDe("r.cantidad_cuotas")} END AS cuotas
        FROM reservas r LEFT JOIN contratos k ON k.reserva_id = r.id
        WHERE r.estado = 'realizada'
      )
      SELECT x.tramo, x.orden, count(v.usd) AS ventas, round(coalesce(sum(v.usd), 0)) AS usd,
        (SELECT round(sum(usd * cuotas) / nullif(sum(usd), 0), 1) FROM v WHERE cuotas IS NOT NULL) AS plazo_promedio
      FROM (VALUES
        ('Contado', 1, 0, 0), ('Hasta 12 cuotas', 2, 1, 12), ('13 a 24 cuotas', 3, 13, 24), ('25 a 36 cuotas', 4, 25, 36),
        ('37 a 48 cuotas', 5, 37, 48), ('49 a 60 cuotas', 6, 49, 60), ('Más de 60 cuotas', 7, 61, 100000)
      ) AS x(tramo, orden, desde, hasta)
      LEFT JOIN v ON v.cuotas BETWEEN x.desde AND x.hasta
      GROUP BY 1, 2
      UNION ALL
      SELECT 'Sin dato', 8, count(*), round(coalesce(sum(usd), 0)), NULL FROM v WHERE cuotas IS NULL HAVING count(*) > 0
      ORDER BY 2`),
    // Precio de venta contra precio de lista del lote (lista = contado): interés de financiación y descuentos.
    rows(sql`
      WITH v AS (
        SELECT r.precio_total_num::numeric AS precio, coalesce(p.precio_base, p.precio_etapa1)::numeric AS lista,
          lower(r.forma_pago) = 'contado' AS contado, p.superficie_m2::numeric AS m2
        FROM reservas r JOIN parcelas p ON p.id = r.parcela_id
        WHERE r.estado = 'realizada'
      )
      SELECT
        round(sum(lista) FILTER (WHERE NOT contado)) AS lista_financiadas,
        round(sum(precio) FILTER (WHERE NOT contado AND lista IS NOT NULL)) AS precio_financiadas,
        round(sum(lista) FILTER (WHERE contado)) AS lista_contado,
        round(sum(precio) FILTER (WHERE contado AND lista IS NOT NULL)) AS precio_contado,
        count(*) FILTER (WHERE lista IS NULL) AS ventas_sin_lista,
        round(sum(precio) FILTER (WHERE lista IS NULL)) AS precio_sin_lista,
        round(sum(precio) / nullif(sum(m2), 0)) AS precio_m2
      FROM v`),
    // Cuotas activas: la próxima cuota a vencer de cada contrato, o sea lo que entra por mes hoy.
    rows(sql`
      WITH ${cuotasBase},
      prox AS (
        SELECT DISTINCT ON (contrato_id) contrato_id, moneda, saldo_usd
        FROM q WHERE est = 'a_vencer'
        ORDER BY contrato_id, fecha_vencimiento
      )
      SELECT
        count(*) FILTER (WHERE moneda = 'usd') AS en_usd, round(coalesce(sum(saldo_usd) FILTER (WHERE moneda = 'usd'), 0)) AS en_usd_usd,
        count(*) FILTER (WHERE moneda = 'ars') AS en_pesos, round(coalesce(sum(saldo_usd) FILTER (WHERE moneda = 'ars'), 0)) AS en_pesos_usd
      FROM prox`),
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

  // Todo lo que entra por el barrio: lo cobrado, lo comprometido en ventas firmadas y los lotes por vender.
  const cobrado = {
    contado: num(vk.contado_usd),
    anticipos: num(vk.anticipos_usd),
    cuotas: num(vk.cobrado_usd),
  };
  const aCobrar = {
    cuotas: num(ck.por_cobrar_usd),
    sinCuenta: num(vk.saldo_sin_cuenta_usd),
  };
  const totalCobrado = cobrado.contado + cobrado.anticipos + cobrado.cuotas;
  const totalACobrar = aCobrar.cuotas + aCobrar.sinCuenta;
  const totalVendido = totalCobrado + totalACobrar;
  const valuacionRestantes = num(vk.valuacion_restantes_usd);

  return {
    facturacionTotal: {
      cobrado,
      totalCobrado,
      ventasContado: num(vk.ventas_contado),
      ventasFinanciadas: num(vk.ventas_financiadas),
      cuotasCobradas: num(ck.cuotas_pagadas),
      cuotasPendientes: num(ck.cuotas_pendientes),
      lotesVendidos: num(vk.lotes_vendidos),
      aCobrar,
      totalACobrar,
      ventasSinCuenta: num(vk.ventas_sin_cuenta),
      totalVendido,
      facturacionVendida: num(vk.facturacion_usd),
      // Las cuotas en pesos ajustan por CAC y se pasan a USD al dólar: lo que se cobra difiere del precio del boleto.
      ajusteCacDolar: totalVendido - num(vk.facturacion_usd),
      valuacionRestantes,
      lotesRestantes: num(vk.lotes_restantes),
      lotesSinPrecio: num(vk.lotes_sin_precio),
      total: totalVendido + valuacionRestantes,
    },
    rentabilidad: (() => {
      const r = rentabilidadRaw[0] ?? {};
      const listaFin = num(r.lista_financiadas);
      const precioFin = num(r.precio_financiadas);
      const listaCont = num(r.lista_contado);
      const precioCont = num(r.precio_contado);
      return {
        listaVendida: listaFin + listaCont,
        interesFinanciacion: precioFin - listaFin,
        diferenciaContado: precioCont - listaCont,
        ventasSinLista: num(r.ventas_sin_lista),
        precioSinLista: num(r.precio_sin_lista),
        precioM2: num(r.precio_m2),
        ajusteCacDolar: totalVendido - num(vk.facturacion_usd),
      };
    })(),
    ventas: {
      firmasSinFecha: { ventas: num(vk.firmas_sin_fecha), usd: num(vk.firmas_sin_fecha_usd) },
      porPlazo: ventasPlazo.map((r) => ({ tramo: String(r.tramo), ventas: num(r.ventas), usd: num(r.usd) })),
      plazoPromedio: ventasPlazo[0]?.plazo_promedio == null ? null : num(ventasPlazo[0].plazo_promedio),
      lotesVendidos: num(vk.lotes_vendidos),
      facturacionUsd: num(vk.facturacion_usd),
      ticketPromedioUsd: num(vk.ticket_promedio_usd),
      reservasActivas: num(vk.reservas_activas),
      reservasActivasUsd: num(vk.reservas_activas_usd),
      cobradoUsd: num(vk.cobrado_usd),
      pagosSinTc: num(vk.pagos_sin_tc),
      lotesDisponibles: num(vk.lotes_disponibles),
      lotesEnVenta: enVenta,
      valuacionRestantesUsd: num(vk.valuacion_restantes_usd),
      lotesRestantes: num(vk.lotes_restantes),
      lotesSinPrecio: num(vk.lotes_sin_precio),
      pctVendido: enVenta > 0 ? num(vk.lotes_vendidos) / enVenta : 0,
      porMes: ventasMes.map((r) => ({ mes: String(r.mes), lotes: num(r.lotes), usd: num(r.usd) })),
      // Lo que vence el mes que viene y sigue impago: barra "fantasma" del gráfico de cobranza.
      cobranzaProyectada: {
        mes: String(proyeccion[0]?.mes),
        usd: num(proyeccion[0]?.usd),
        cuotas: num(proyeccion[0]?.cuotas),
      },
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
      cuotasActivas: (() => {
        const r = cuotasActivasRaw[0] ?? {};
        return {
          enUsd: num(r.en_usd),
          enUsdUsd: num(r.en_usd_usd),
          enPesos: num(r.en_pesos),
          enPesosUsd: num(r.en_pesos_usd),
        };
      })(),
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
