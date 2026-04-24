import type { Parcela, Lead, ParcelasSummary } from "@/lib/report-data";

const ESTADO_PARCELA_LABELS: Record<string, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  reservado: "Reservado",
  vendido: "Vendido",
};

const ESTADO_PARCELA_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  disponible:    { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  reservado:     { bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
  vendido:       { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
  no_disponible: { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" },
};

const ESTADO_LEAD_LABELS: Record<string, string> = {
  nuevo:         "Nuevo",
  asignado:      "Asignado",
  a_contactar:   "A contactar",
  contactado:    "Contactado",
  sin_respuesta: "Sin respuesta",
  closed_won:    "Ganado",
  closed_lost:   "Perdido",
};

const ESTADO_LEAD_STYLES: Record<string, { bg: string; color: string }> = {
  nuevo:         { bg: "#dbeafe", color: "#1d4ed8" },
  asignado:      { bg: "#ede9fe", color: "#7c3aed" },
  a_contactar:   { bg: "#ffedd5", color: "#c2410c" },
  contactado:    { bg: "#dcfce7", color: "#15803d" },
  sin_respuesta: { bg: "#f3f4f6", color: "#374151" },
  closed_won:    { bg: "#dcfce7", color: "#14532d" },
  closed_lost:   { bg: "#fee2e2", color: "#7f1d1d" },
};

const ALL_ESTADOS: Array<keyof typeof ESTADO_PARCELA_LABELS> = [
  "disponible",
  "reservado",
  "vendido",
  "no_disponible",
];

function badge(label: string, bg: string, color: string, border?: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${bg};color:${color};${border ? `border:1px solid ${border};` : ""}">${label}</span>`;
}

function fmt(val: string | null | undefined, fallback = "—"): string {
  return val ?? fallback;
}

function fmtMoney(val: string | null | undefined): string {
  if (!val) return "—";
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return "USD " + num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const [y, m, d] = val.split("-");
  return `${d}/${m}/${y}`;
}

function summaryTable(summary: ParcelasSummary): string {
  const rows = ALL_ESTADOS.map((estado) => {
    const count = summary[estado] ?? 0;
    const style: { bg: string; color: string; border: string } = ESTADO_PARCELA_STYLES[estado] ?? { bg: "#f4f4f5", color: "#374151", border: "#e4e4e7" };
    const label: string = ESTADO_PARCELA_LABELS[estado] ?? estado;
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">
          ${badge(label, style.bg, style.color, style.border)}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:22px;font-weight:700;color:#1a1a2e;">${count}</td>
      </tr>`;
  }).join("");

  const total = ALL_ESTADOS.reduce((sum, e) => sum + (summary[e] ?? 0), 0);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
      <tr>
        <th style="text-align:left;padding:10px 14px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Estado</th>
        <th style="text-align:right;padding:10px 14px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Cantidad</th>
      </tr>
      ${rows}
      <tr>
        <td style="padding:10px 14px;background:#f8f8fa;font-size:13px;font-weight:600;color:#374151;">Total</td>
        <td style="padding:10px 14px;background:#f8f8fa;text-align:right;font-size:18px;font-weight:700;color:#1a1a2e;">${total}</td>
      </tr>
    </table>`;
}

function reservationsTable(reservations: Parcela[]): string {
  if (reservations.length === 0) {
    return `<p style="margin:0;color:#9ca3af;font-style:italic;font-size:14px;">Sin reservas en los últimos 7 días.</p>`;
  }

  const rows = reservations.map((p) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmt(p.numero?.toString())}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmt(p.manzana)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${p.superficieM2 ? parseFloat(p.superficieM2).toLocaleString("es-AR") + " m²" : "—"}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmtMoney(p.precioEtapa1)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;font-weight:500;">${fmt(p.nombreComprador)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmtDate(p.fechaReserva)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmtDate(p.fechaVencimiento)}</td>
    </tr>`).join("");

  return `
    <div style="overflow-x:auto;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;min-width:560px;">
        <tr>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">N°</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Manzana</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Superficie</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Precio</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Comprador</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">F. Reserva</th>
          <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">F. Venc.</th>
        </tr>
        ${rows}
      </table>
    </div>`;
}

function leadsTable(todayLeads: Lead[]): string {
  if (todayLeads.length === 0) {
    return `<p style="margin:0;color:#9ca3af;font-style:italic;font-size:14px;">Sin leads nuevos hoy.</p>`;
  }

  const rows = todayLeads.map((l) => {
    const style: { bg: string; color: string } = ESTADO_LEAD_STYLES[l.estado] ?? { bg: "#f3f4f6", color: "#374151" };
    const label: string = ESTADO_LEAD_LABELS[l.estado] ?? l.estado;
    return `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;font-weight:500;">${fmt(l.nombre)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmt(l.telefono)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">${fmt(l.email)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;">${badge(label, style.bg, style.color)}</td>
      </tr>`;
  }).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
      <tr>
        <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Nombre</th>
        <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Teléfono</th>
        <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Email</th>
        <th style="text-align:left;padding:9px 12px;background:#f8f8fa;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Estado</th>
      </tr>
      ${rows}
    </table>`;
}

export function buildDailyReportHtml(data: {
  date: string;
  summary: ParcelasSummary;
  appUrl: string;
  reservations: Parcela[];
  todayLeads: Lead[];
}): string {
  const { date, summary, appUrl, reservations, todayLeads } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reporte Diario — Barrio Stefani</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:10px;border:1px solid #e4e4e7;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:#0f172a;padding:28px 32px 24px;">
              <p style="margin:0 0 2px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Barrio Stefani CRM</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">Reporte Diario</h1>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">${date}</p>
            </td>
          </tr>

          <!-- SECTION 1: RESUMEN DE PARCELAS -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Resumen de Parcelas</h2>
              <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Estado actual de todos los lotes</p>
              ${summaryTable(summary)}
              <div style="margin-top:20px;">
                <a href="${appUrl}/crm/lotes" style="display:inline-block;padding:11px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:7px;font-size:14px;font-weight:600;">Ver listado completo &rarr;</a>
              </div>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="height:1px;background:#e4e4e7;"></div>
            </td>
          </tr>

          <!-- SECTION 2: RESERVAS RECIENTES -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Reservas de los últimos 7 días</h2>
              <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">${reservations.length} ${reservations.length === 1 ? "reserva" : "reservas"} encontrada${reservations.length === 1 ? "" : "s"}</p>
              ${reservationsTable(reservations)}
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="height:1px;background:#e4e4e7;"></div>
            </td>
          </tr>

          <!-- SECTION 3: LEADS DE HOY -->
          <tr>
            <td style="padding:28px 32px 0;">
              <h2 style="margin:0 0 4px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Leads de hoy</h2>
              <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">${todayLeads.length} ${todayLeads.length === 1 ? "lead nuevo" : "leads nuevos"} en las últimas 24 hs</p>
              ${leadsTable(todayLeads)}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:32px;text-align:center;">
              <div style="height:1px;background:#e4e4e7;margin-bottom:24px;"></div>
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">Generado automáticamente por <strong style="color:#6b7280;">Barrio Stefani CRM</strong></p>
              <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Este email fue enviado a juliankorn@gmail.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
