# Entorno de desarrollo y base de datos

Regla principal: **en local se trabaja contra la base de desarrollo, nunca contra producción.**
Producción solo la toca Vercel (deploys) o una persona que lo hace a propósito.

## Bases de datos

Las dos viven en el mismo proyecto de Neon: **proyecto-barrio-stefani** (`divine-boat-32545870`,
organización "Vercel: Julian's projects", región São Paulo). Neon llama "branch" a cada copia.

| Branch | Para qué | Endpoint | Quién la usa |
|--------|----------|----------|--------------|
| `main` | Producción. Datos reales de clientes, reservas y pagos. | `ep-wandering-lake-ac7dbmpf` | Vercel (Production). Protegida: no se puede borrar. |
| `dev` | Desarrollo y pruebas. Copia de `main` del 15/10/2026. | `ep-fragrant-dust-acbylgbq` | Todos en local (`pnpm dev`, migraciones, scripts). |

`dev` es una copia completa, **con datos reales**: es para probar sin miedo a romper nada,
pero los datos siguen siendo personales (nombres, DNI, teléfonos). No compartirla fuera del equipo.

Cómo saber a qué base apuntás: mirá el host de `POSTGRES_URL` en tu `.env`.
Si dice `ep-fragrant-dust` estás en dev; si dice `ep-wandering-lake` estás en **producción**.

## Configuración local

En `.env` (no se sube al repo):

```env
# Base de DESARROLLO: branch "dev" de Neon
POSTGRES_URL=postgresql://neondb_owner:...@ep-fragrant-dust-acbylgbq-pooler.sa-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

La connection string completa se saca de la consola de Neon: proyecto
proyecto-barrio-stefani → Branches → `dev` → Connect (usar la versión "pooled").

No pongas la URL de producción como `POSTGRES_URL` activa. Si la necesitás para algo
puntual (backup, migración manual), dejala comentada y descomentala solo para esa operación.

Ojo: Next carga `.env.local` por encima de `.env`. Si alguien define `POSTGRES_URL` en
`.env.local` (por ejemplo con `vercel env pull`), **esa** es la que usa `pnpm dev`. `vercel env pull`
trae las variables de Vercel, que apuntan a producción: después de correrlo, revisá `POSTGRES_URL`.

## Cambios de schema (migraciones)

1. Cambiar `src/lib/schema.ts`.
2. `pnpm run db:generate` → crea `drizzle/00XX_*.sql`. Revisarlo; si hace falta mover datos
   (por ejemplo marcar registros existentes), agregar el SQL al final del archivo.
3. `pnpm run db:migrate` → aplica la migración **en dev** (usa el `POSTGRES_URL` del `.env`).
4. Probar en local.
5. Commit + push. **Producción se migra sola en el deploy**: el build de Vercel corre
   `pnpm run db:migrate && next build` contra la base de producción.

Consecuencias:

- No usar `db:push`, `db:reset` ni `db:dev` contra producción: saltean el historial de migraciones
  (`db:reset` además borra todas las tablas).
- Si el código nuevo espera una columna que la base no tiene, la app tira "Error interno del
  servidor" (500) en cualquier pantalla que la use. Si ves eso en local después de un pull,
  probablemente falte `pnpm run db:migrate`.
- Cada migración tiene que ser compatible con el código que está deployado mientras corre
  (agregar columnas con default, no renombrar ni borrar de una).

## Refrescar dev con datos de producción

Cuando dev quede vieja o sucia de pruebas: consola de Neon → Branches → `dev` →
**Reset from parent**. Vuelve a ser una copia exacta de `main` al momento del reset.

- Se pierde todo lo hecho en dev (datos de prueba y migraciones que todavía no están en producción).
- Después del reset, correr `pnpm run db:migrate` para volver a aplicar las migraciones
  nuevas que todavía no están deployadas.
- El endpoint (y la connection string) se mantiene, no hay que tocar el `.env`.

## Cosas que dev comparte con producción

La base está separada, pero otras variables del `.env` local apuntan a servicios reales:

- `BLOB_READ_WRITE_TOKEN`: los archivos que subas en local (comprobantes de pago, etc.) van al
  mismo storage de Vercel Blob que producción. No borres archivos desde local.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `CRON_SECRET`: si llamás a mano los endpoints de cron
  (reporte diario, backups), mandan mails y escriben en Drive reales.
- Login: los usuarios se copian con la base, así que en dev entrás con el mismo usuario de producción.

## Checklist rápido

- [ ] `POSTGRES_URL` del `.env` apunta a `ep-fragrant-dust` (dev).
- [ ] No hay `POSTGRES_URL` en `.env.local` (o apunta a dev).
- [ ] Después de un pull con migraciones nuevas: `pnpm run db:migrate`.
- [ ] Antes de mergear un cambio de schema: la migración corre limpia en dev.
