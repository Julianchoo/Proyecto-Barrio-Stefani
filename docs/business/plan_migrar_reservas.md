# Plan: Migrar datos de reserva a tabla `reservas` separada

## Contexto

Los datos del comprador y la reserva viven hoy como columnas en la tabla `parcelas` (~20 campos). Esto mezcla dos entidades distintas, pierde historial al reemplazar compradores, y llena de NULLs los lotes disponibles. El objetivo es extraer esos campos a una tabla `reservas` con relación 1:1 activa por lote, manteniendo historial de reservas anteriores (estado `cancelada`).

**Restricción crítica:** El flujo OCR → formulario → guardado → generación de boleto no debe romperse en ningún paso.

---

## Flujos que NO cambian

- `POST /api/crm/parcelas/[id]/ocr-reserva` — solo devuelve JSON al frontend, no escribe en DB
- `POST /api/crm/parcelas/[id]/ocr-boleto` — idem
- `POST /api/crm/parcelas/[id]/boleto` — recibirá los mismos datos, solo cambia de dónde los lee
- Frontend completo — recibirá la misma forma de respuesta de los GETs

---

## Campos que se mueven a `reservas`

```
nombreComprador, dniCuit, telefono, emailComprador, domicilioComprador,
tipoEntrega, mesEntrega, anioEntrega, nombreCorredor, emailCorredor,
formaPago, fechaReserva, fechaVencimiento, fechaFirma,
reservadoPor, modificadoPor, observaciones,
precioTotalPalabras, precioTotalNum, anticipoPalabras, anticipoNum,
saldoPalabras, saldoNum, cantidadCuotas, cuotaMensualPalabras, cuotaMensual
```

`parcelas` mantiene: estado, pricing (precioEtapa1, valorM2, etc.), datos catastrales, superficie, nota.

---

## Schema nuevo

**Archivo:** `src/lib/schema.ts`

```ts
export const estadoReservaEnum = pgEnum("estado_reserva", ["activa", "cancelada", "firmada"]);

export const reservas = pgTable("reservas", {
  id: serial("id").primaryKey(),
  parcelaId: integer("parcela_id").notNull().references(() => parcelas.id, { onDelete: "cascade" }),
  estado: estadoReservaEnum("estado").default("activa").notNull(),

  // todos los campos que hoy están en parcelas
  nombreComprador: text("nombre_comprador"),
  dniCuit: text("dni_cuit"),
  // ... resto de campos
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("reservas_parcela_idx").on(table.parcelaId),
  index("reservas_estado_idx").on(table.estado),
]);
```

No hay UNIQUE constraint en `parcelaId` — esto permite historial. La unicidad de "1 activa por lote" se controla en la lógica de la API.

---

## Pasos de implementación

### 1. Schema (`src/lib/schema.ts`)
- Agregar `estadoReservaEnum`
- Agregar tabla `reservas` con todos los campos migrados
- **NO** eliminar los campos de `parcelas` todavía (se eliminan después de migrar datos)

### 2. Migración Drizzle
```bash
pnpm run db:generate   # genera el SQL de la nueva tabla
pnpm run db:migrate    # aplica en la DB
```

### 3. Script de migración de datos
Inline en la migración SQL generada (o en un script separado):
```sql
INSERT INTO reservas (parcela_id, estado, nombre_comprador, dni_cuit, ...)
SELECT id, 'activa', nombre_comprador, dni_cuit, ...
FROM parcelas
WHERE nombre_comprador IS NOT NULL;
```

### 4. Segunda migración: eliminar campos de `parcelas`
- Remover los ~20 campos de comprador/reserva de la tabla `parcelas` en `schema.ts`
- Generar y correr segunda migración

### 5. `PUT /api/crm/parcelas/[id]/route.ts`
Lógica nueva para campos de reserva (COMERCIAL_FIELDS):
```
Si hay datos de comprador en el body:
  - Buscar reserva activa para este parcelaId
  - Si existe: marcarla `cancelada`, crear nueva reserva activa
  - Si no existe: crear reserva activa nueva
  (actualizar parcelas.estado = 'reservado' como ya hace hoy)
Si no hay datos de comprador:
  - Solo actualizar parcelas (pricing, nota, etc.)
```

### 6. `GET /api/crm/parcelas/[id]/route.ts`
Hacer LEFT JOIN con `reservas WHERE estado = 'activa'` y retornar **la misma forma plana** que hoy:
```ts
const result = { ...parcela, ...reservaActiva }  // mismo shape que el frontend espera
```

### 7. `GET /api/crm/parcelas/route.ts` (lista)
Hacer LEFT JOIN con reserva activa para que el filtro por `nombreComprador` siga funcionando.

### 8. `POST /api/crm/parcelas/[id]/boleto/route.ts`
Cambiar la query de `db.select().from(parcelas)` para incluir LEFT JOIN con reserva activa. Los campos de template se leen igual, solo cambia la fuente.

---

## Comportamiento "drop and replace"

Cuando un lote `reservado` recibe datos de un nuevo comprador:
1. La reserva activa existente se marca `cancelada` (historial preservado)
2. Se crea una nueva reserva `activa`
3. `parcelas.estado` se mantiene `reservado`

Para simplificar: solo se crea una nueva reserva si `nombreComprador` del body **difiere** del actual. Correcciones menores (typo en un campo) solo hacen UPDATE de la reserva activa existente.

---

## Verificación

1. Crear/editar un lote con datos de comprador → verificar que se crea registro en `reservas`
2. Cambiar el comprador de un lote ya reservado → verificar que la reserva anterior queda `cancelada` y hay una nueva `activa`
3. Subir imagen de reserva con OCR → extraer datos → guardar → verificar que los datos van a `reservas`
4. Generar boleto para un lote reservado → verificar que el .docx se descarga con los datos correctos
5. `pnpm run lint && pnpm run typecheck` sin errores

---

## Archivos críticos

| Archivo | Cambio |
|---|---|
| `src/lib/schema.ts` | + tabla `reservas`, + enum, - campos de `parcelas` |
| `src/app/api/crm/parcelas/[id]/route.ts` | PUT escribe a reservas, GET hace join |
| `src/app/api/crm/parcelas/route.ts` | lista hace left join |
| `src/app/api/crm/parcelas/[id]/boleto/route.ts` | lee de reserva activa |
| Migración SQL generada | + tabla reservas, data migration, - columnas parcelas |
/