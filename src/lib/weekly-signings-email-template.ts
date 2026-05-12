import type { Parcela } from "@/lib/report-data";

type SigningSection = {
  title: string;
  range: { start: string; end: string };
  signings: Parcela[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmt(value: string | number | null | undefined, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(String(value));
}

function fmtMoney(value: string | null | undefined): string {
  if (!value) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return `USD ${number.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function signingsTable(signings: Parcela[], appUrl: string): string {
  if (signings.length === 0) {
    return `<p style="margin:0;color:#6b7280;font-size:14px;">No hay lotes con fecha de firma para este periodo.</p>`;
  }

  const rows = signings
    .map((signing) => {
      const loteUrl = `${appUrl}/crm/lotes/${signing.id}`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${fmt(signing.parcela)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${fmt(signing.manzana)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;font-weight:600;">${fmt(signing.nombreComprador)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${fmtMoney(signing.precioTotalNum ?? signing.precioEtapa1)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${fmtMoney(signing.cuotaMensual)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${fmt(signing.emailComprador)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${signing.fechaFirma ? fmtDate(signing.fechaFirma) : "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">
            <a href="${loteUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">Ver lote</a>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="overflow-x:auto;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;min-width:760px;">
        <tr>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Parcela</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Manzana</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Comprador</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Precio</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Cuota</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Mail</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Firma</th>
          <th style="text-align:left;padding:9px 12px;background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">CRM</th>
        </tr>
        ${rows}
      </table>
    </div>`;
}

function signingSection(section: SigningSection, appUrl: string): string {
  return `
    <div style="margin:0 0 28px;">
      <h2 style="margin:0;color:#111827;font-size:18px;line-height:1.35;">${escapeHtml(section.title)}</h2>
      <p style="margin:4px 0 14px;color:#6b7280;font-size:14px;">${fmtDate(section.range.start)} al ${fmtDate(section.range.end)} · ${section.signings.length} ${section.signings.length === 1 ? "lote con firma prevista" : "lotes con firma prevista"}.</p>
      ${signingsTable(section.signings, appUrl)}
    </div>`;
}

export function buildWeeklySigningsEmailHtml(data: {
  appUrl: string;
  sections: SigningSection[];
}): string {
  const { appUrl, sections } = data;
  const firstSection = sections[0];
  const lastSection = sections[sections.length - 1];
  const totalSignings = sections.reduce((total, section) => total + section.signings.length, 0);
  const title =
    firstSection && lastSection
      ? `Firmas previstas del ${fmtDate(firstSection.range.start)} al ${fmtDate(lastSection.range.end)}`
      : "Firmas previstas";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="820" cellpadding="0" cellspacing="0" style="max-width:820px;width:100%;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:26px 32px;">
              <p style="margin:0 0 6px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Barrio Stefani CRM</p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Resumen semanal de firmas</h1>
              <p style="margin:8px 0 0;color:#d1d5db;font-size:14px;">${title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${totalSignings} ${totalSignings === 1 ? "lote con firma prevista" : "lotes con firma prevista"}.</p>
              ${sections.map((section) => signingSection(section, appUrl)).join("")}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 30px;text-align:center;">
              <div style="height:1px;background:#e5e7eb;margin-bottom:22px;"></div>
              <p style="margin:0;color:#9ca3af;font-size:12px;">Generado automaticamente por Barrio Stefani CRM</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
