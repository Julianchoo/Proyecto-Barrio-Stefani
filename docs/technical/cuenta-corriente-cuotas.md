# Cuenta corriente y cuotas

Este documento describe como funciona la gestion de cuentas corrientes de cuotas en el CRM: cuando se crea una cuenta, como se calculan los vencimientos, como se aplica CAC, como se actualizan estados y que pantallas/API intervienen.

## Alcance funcional

La cuenta corriente aplica a reservas vendidas/realizadas que no son de contado. En el sistema, la cuenta corriente se materializa como:

- un registro en `contratos`, asociado a una `reserva`;
- varias filas en `cuotas`, asociadas al contrato;
- pagos en `pagos`, asociados a contrato y cuota;
- indices CAC mensuales en `indices_cac`, usados para contratos `pesos_cac`.

Las pantallas principales son:

- `/crm/cuotas`: resumen por cliente/lote, carga de CAC mensual, filtros y exportacion XLS.
- `/crm/cuotas/[reservaId]`: detalle de cuenta corriente, creacion de cuenta, tabla de cuotas, pagos y mensaje de comunicacion.

La logica central esta en `src/lib/cuenta-corriente.ts`.

## Creacion de cuenta corriente

La cuenta corriente se crea con `createContratoForReserva(reservaId, input, userEmail)`.

Condiciones obligatorias:

- La reserva debe existir.
- La reserva debe estar en estado `realizada`.
- No debe existir ya un contrato para esa reserva.
- Deben existir cantidad de cuotas, cuota mensual, saldo inicial y fecha de inicio.
- Para modalidad `pesos_cac`, debe existir tipo de cambio BNA valido y CAC base cargado.

Datos de entrada relevantes:

- `modalidad`: `usd_fijo`, `pesos_cac` o `requiere_revision`.
- `fechaInicio`: si no se informa, usa `reserva.fechaFirma` y luego `reserva.fechaReserva`.
- `cantidadCuotas`: si no se informa, usa `reserva.cantidadCuotas`.
- `cuotaBase`: si no se informa, usa `reserva.cuotaMensual`.
- `saldoInicial`: si no se informa, usa `reserva.saldoNum`.
- `tipoCambioBna`: requerido para `pesos_cac`.
- `periodoBaseCac`: requerido en la practica para `pesos_cac`; si no se informa, toma el mes de `fechaInicio`.

Regla actual de vencimientos:

- Todas las cuentas nuevas vencen el dia 10.
- La primera cuota vence el dia 10 del mes siguiente a la fecha de inicio.
- Las cuotas siguientes vencen el dia 10 de cada mes posterior.

Ejemplos:

- Firma/inicio `2026-06-06` -> cuota 1 vence `2026-07-10`.
- Firma/inicio `2026-12-20` -> cuota 1 vence `2027-01-10`.

## Modalidades

### USD fijo

- `contratos.monedaBase = usd`.
- `cuotas.importeBase` queda en USD.
- `cuotas.importeAjustado` se setea igual al importe base.
- No usa CAC.
- Las cuotas se crean inicialmente como `pendiente` y luego se recomputan.

### Pesos + CAC

- `contratos.monedaBase = ars`.
- El valor base en USD se convierte a pesos usando `tipoCambioBna` al crear la cuenta.
- Se guarda:
  - `contratos.periodoBaseCac`: periodo CAC base elegido al crear la cuenta.
  - `contratos.indiceBaseCac`: valor CAC base de ese periodo.
  - `cuotas.periodoCac`: periodo CAC aplicable a cada cuota.
  - `cuotas.indiceCac`: valor CAC usado para calcular o proyectar esa cuota.

Regla CAC por cuota:

- El periodo CAC aplicable es dos meses calendario antes del mes de vencimiento.
- No son 60 dias; es periodo mensual.

Ejemplos:

- Vencimiento `2026-08-10` -> periodo CAC cuota `2026-06`.
- Vencimiento `2026-04-10` -> periodo CAC cuota `2026-02`.
- Vencimiento `2026-01-15` -> periodo CAC cuota `2025-11`.

Formula de ajuste real:

```txt
importe_ajustado = importe_base * indice_cac_cuota / indice_base_cac
```

Si falta el CAC aplicable:

- Si la cuota aun no vencio y hay un ultimo CAC conocido, se usa ese valor para proyectar.
- Si la cuota ya vencio, no se proyecta: queda pendiente de indice para evitar fijar un monto inventado.

### Requiere revision

- Es una modalidad de control/pendiente.
- No deberia ser el estado final operativo para una cuenta corriente normal.
- Se usa para indicar que falta definir si corresponde `usd_fijo` o `pesos_cac`.

## Recalculo de cuotas

El recalculo lo hace `recomputeContratoCuotas(contratoId)`.

Se ejecuta despues de:

- Crear una cuenta corriente.
- Registrar un pago.
- Crear, editar o borrar un indice CAC.
- Recalcular todas las cuentas `pesos_cac` desde la carga de CAC.

Para cada cuota:

1. Lee pagos activos asociados a la cuota.
2. Calcula el importe ajustado segun modalidad.
3. Calcula saldo: `importe_ajustado - pagos_activos`.
4. Define estado operativo.
5. Actualiza `periodoCac`, `indiceCac`, `importeAjustado`, `saldo`, `estado` y `updatedAt`.

Los pagos con estado distinto de `activo` no descuentan saldo.

## Estados de cuotas

Estados finales/tecnicos:

- `pagada`: saldo menor o igual a 0.
- `cancelada`: estado tecnico/manual. El recomputo la conserva y no la recalcula.

Estados operativos:

- `vencida`: fecha de vencimiento menor a hoy, saldo pendiente mayor a 0 y sin pagos activos.
- `parcial_vencida`: fecha de vencimiento menor a hoy, tiene pagos activos y saldo pendiente mayor a 0.
- `calculada`: no vencida y con importe real calculado.
- `proyectada`: no vencida, sin CAC real aplicable, ajustada con ultimo CAC conocido.
- `pendiente_indice`: falta CAC aplicable y no corresponde proyectar; tipicamente cuota vencida de `pesos_cac` sin CAC real.

Nota: en la UI puede verse como “Falta CAC” para `pendiente_indice`.

## Pagos

Los pagos se registran desde el detalle `/crm/cuotas/[reservaId]` sobre una cuota puntual.

Endpoint:

- `POST /api/crm/cuotas/[id]/pagos`

Campos:

- `fechaPago`: `YYYY-MM-DD`.
- `monto`: numero positivo.
- `moneda`: `usd` o `ars`.
- `medio`: opcional.
- `observacion`: opcional.

Restricciones:

- Solo admin puede registrar pagos.
- No se puede pagar una cuota `cancelada`.
- No se puede pagar una cuota `pendiente_indice`, porque falta cargar el CAC aplicable a una cuota vencida.

Despues de insertar el pago, se recalcula el contrato completo.

## CAC mensual

La carga de CAC se administra desde `/crm/cuotas`, seccion “Indice CAC mensual”.

Endpoint:

- `GET /api/crm/indices-cac`: lista indices cargados.
- `POST /api/crm/indices-cac`: crea o actualiza un periodo.
- `DELETE /api/crm/indices-cac`: borra un periodo.

Formato de periodo:

```txt
YYYY-MM
```

Reglas:

- `valor` debe ser positivo.
- Si se carga un periodo existente, se actualiza.
- Al crear, actualizar o borrar CAC se ejecuta `recomputeAllPesosCacCuotas()`.
- Ese recomputo afecta todas las cuentas `pesos_cac`.

## Resumen de cuentas corrientes

El resumen se arma con `getCuentasCorrientesSummaries()`.

Incluye:

- Cuentas ya creadas (`contratos`) de reservas `realizada`.
- Reservas `realizada` no contado sin contrato, marcadas como `cuentaEstado = pendiente`.

Campos destacados:

- `totalVencido`: suma de saldos de cuotas activas vencidas.
- `saldoPendiente`: suma de saldos de cuotas no finales.
- `cuotasVencidas`: cantidad de cuotas activas vencidas.
- `cuotasProyectadas`: cantidad de cuotas proyectadas.
- `proximoVencimiento`: proxima cuota no vencida.
- `proximaCuotaMonto`: importe ajustado si existe, si no importe base.
- `mensajeCuotas`: texto listo para copiar/comunicar.

Estado visible en `/crm/cuotas`:

- Si no existe cuenta: “Pendiente creacion”.
- Si hay cuotas vencidas: “X Vencida(s)”.
- Si no hay vencidas: “Al dia”.

La exportacion XLS del resumen incluye todas las columnas aunque el usuario oculte columnas en pantalla.

## Detalle de cuenta corriente

El detalle se obtiene con `getCuentaCorrienteDetailByReserva(reservaId)`.

Solo devuelve cuenta si:

- existe contrato para la reserva;
- la reserva esta `realizada`.

La pantalla muestra:

- Datos generales de la cuenta.
- Tabla de cuotas.
- CAC base y periodo base.
- CAC de cuota y periodo CAC de cuota.
- Base, ajustado, saldo y estado.
- Acciones de pago cuando corresponde.
- Mensaje de cuenta corriente para copiar.

Para cuotas `pesos_cac`:

- `Periodo CAC base`: viene del contrato.
- `CAC base`: valor guardado en el contrato.
- `Periodo CAC cuota`: siempre representa el periodo esperado dos meses antes del vencimiento.
- `CAC cuota`: valor real o proyectado usado para el ajuste.

## Mensaje de comunicacion

El mensaje se genera con `buildMensajeCuentaCorriente(summary)`.

Si hay saldo vencido:

- Informa lote.
- Informa saldo vencido.
- Informa saldo total pendiente.
- Pide aviso cuando se realice el pago.

Si no hay saldo vencido:

- Informa lote.
- Informa proxima cuota y vencimiento si existe.
- Informa saldo total pendiente.

Si la cuenta no esta creada, el resumen deja `mensajeCuotas` vacio.

## Relacion con reservas y lotes vendidos

La cuenta corriente se crea sobre reservas realizadas. En el flujo actual, una reserva realizada corresponde a un lote vendido.

Ademas, los lotes vendidos o reservas realizadas quedan bloqueados por defecto para edicion. El admin puede desbloquear edicion desde el detalle del lote con una confirmacion explicita. La API exige esa confirmacion para editar datos de lote/reserva ya vendido.

Ese bloqueo protege datos comerciales ya usados para boleto, cuenta corriente y reportes.

## Casos operativos para probar

- Crear cuenta `usd_fijo`: cuotas vencen dia 10 desde el mes siguiente y ajustado iguala base.
- Crear cuenta `pesos_cac` sin CAC base cargado: debe fallar con falta CAC base.
- Crear cuenta `pesos_cac` con base cargada: cada cuota debe tener `periodoCac = mes(vencimiento) - 2`.
- Cargar CAC aplicable a cuota futura: cuota queda `calculada`.
- Faltar CAC aplicable en cuota futura, con ultimo CAC conocido: cuota queda `proyectada`.
- Faltar CAC aplicable en cuota vencida: cuota queda `pendiente_indice` y no permite pago.
- Registrar pago parcial en cuota vencida: queda `parcial_vencida` si mantiene saldo.
- Registrar pagos que cubren saldo: queda `pagada`.
- Borrar o editar CAC: debe recalcular todas las cuentas `pesos_cac`.
