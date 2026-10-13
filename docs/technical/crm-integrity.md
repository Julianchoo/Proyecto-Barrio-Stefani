# Integridad de reservas y cuentas corrientes

Las escrituras de lotes/reservas, edición y eliminación de leads, creación de contratos,
pagos, cuotas, CAC y TC manual usan `crmTransaction`. El bloqueo transaccional de
PostgreSQL serializa estas operaciones entre procesos. Pago y recálculo se confirman
juntos; una falla revierte ambos. No hay migraciones ni backfill.

- Un lead con reservas no se elimina. Con una reserva realizada, solo un administrador
  puede editarlo. Las reservas nuevas copian los datos del comprador y al formalizarlas
  conservan una copia independiente del lead. Las históricas sin copia mantienen la
  lectura del lead; no se completan automáticamente.
- Con contrato, no se modifican las condiciones económicas desde el lote. Generar
  documentos no escribe en la reserva. El boleto rechaza condiciones distintas de
  las guardadas.
- Un importe de cuota no puede quedar por debajo de los pagos activos; el rechazo
  revierte también el recálculo. No se cambia el período CAC de una cuota con pagos.
- La validación adicional de importes, fecha y cantidad de cuotas solo se aplica al
  crear contratos. Una cuenta existente no se regenera ni se valida retroactivamente.
- El TC manual es exclusivo de administradores. Antes de cambiar conversiones de
  pagos o bases de contratos sin pagos, devuelve el impacto y exige confirmación.
  La confirmación corresponde al valor y registros afectados; si cambia el impacto,
  debe confirmarse otra vez. Solo recalcula pagos alcanzados por esa cotización.
  La actualización automática agrega el TC de hoy sin reescribir valores históricos.

## Verificación local

`node scripts/check-payment-edit.mjs` verifica edición de pagos sin acceso a DB/storage.

`pnpm exec tsx src/lib/crm-integrity.spec.ts` necesita una base **descartable**
`barrio_crm_test` en PostgreSQL local, puerto 55437, usuario postgres, con el esquema
del proyecto. El test fija esa conexión antes de importar el backend y verifica el
nombre de la base. **Borra sus fixtures con TRUNCATE**: no usar una base con datos reales.
Prueba concurrencia, rollback, permisos, comprador histórico, documentos sin escrituras,
validación de contratos nuevos y confirmación de TC. Autenticación y storage se sustituyen
en las pruebas; las transacciones y consultas se ejecutan en PostgreSQL real.

El bloqueo es global para estas operaciones: una escritura lenta puede demorar otra.
Si la concurrencia crece, separar bloqueos requiere mantener un orden común y repetir
las pruebas de operaciones cruzadas. Los comprobantes públicos no cambian en este trabajo.
