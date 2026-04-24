# Reporte Diario por Email

Email automático que se manda todos los días con un resumen del CRM.

## Cómo funciona

1. **cron-job.org** dispara un `POST` al endpoint `/api/cron/daily-report` a la hora configurada
2. El endpoint consulta la base de datos y arma el HTML del email
3. Se manda vía Gmail SMTP usando nodemailer

## Archivos relevantes

| Archivo | Qué hace |
|---------|----------|
| `src/app/api/cron/daily-report/route.ts` | Endpoint POST que recibe el cron, valida el secret, y envía el email |
| `src/app/api/cron/daily-report/preview/route.ts` | Endpoint GET para ver el email en el browser sin mandarlo |
| `src/lib/email.ts` | Función `sendEmail()` — configura el transport de nodemailer con Gmail |
| `src/lib/report-data.ts` | Las 3 queries a la DB: resumen por estado, reservas recientes, leads de hoy |
| `src/lib/email-template.ts` | Arma el HTML del email (estilos inline, tablas, badges de estado) |

## Variables de entorno

```
GMAIL_USER=juliankorn@gmail.com       # cuenta desde la que se manda
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx # App Password de Google (no es la contraseña normal)
CRON_SECRET=<string largo>             # token que protege el endpoint
```

Para obtener un App Password nuevo: Google Account > Seguridad > Verificación en 2 pasos > Contraseñas de aplicación.

## Seguridad del endpoint

El POST a `/api/cron/daily-report` requiere el header:
```
Authorization: Bearer <CRON_SECRET>
```
Sin ese header devuelve 401. En cron-job.org se configura en la sección "Headers" del job.

## Receptores

Están hardcodeados en `route.ts`:
```typescript
to: "juliankorn@gmail.com, hugo.guindani@gmail.com"
```
Para agregar o sacar alguien, editá esa línea.

## Contenido del email

Definido en `report-data.ts`. Tres secciones:

1. **Resumen de parcelas** — `getParcelasSummary()`: GROUP BY estado, muestra los 4 estados (disponible, reservado, vendido, no_disponible) con su conteo
2. **Reservas recientes** — `getRecentReservations()`: parcelas con `estado = 'reservado'` y `fecha_reserva >= hace 7 días`
3. **Leads de hoy** — `getTodayLeads()`: leads con `created_at >= medianoche UTC de hoy`

## Template HTML

`email-template.ts` exporta `buildDailyReportHtml(data)` que devuelve un string HTML puro (sin JSX, sin React). Usa estilos inline porque Gmail no soporta `<style>` tags.

Para cambiar colores de los badges de estado, editar los objetos `ESTADO_PARCELA_STYLES` y `ESTADO_LEAD_STYLES` al principio del archivo.

## Preview local

Con el dev server corriendo, abrir:
```
http://localhost:3000/api/cron/daily-report/preview
```
Muestra el email con datos reales de la DB sin mandarlo.

## Configuración en cron-job.org

- **URL:** `https://proyecto-barrio-stefani.vercel.app/api/cron/daily-report`
- **Method:** `POST`
- **Header:** `Authorization: Bearer <CRON_SECRET>`
- **Schedule:** a elección (ej. todos los días 9am Argentina = 12:00 UTC)
