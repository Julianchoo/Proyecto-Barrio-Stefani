// Traduce errores de validación (zod) a un mensaje legible: "Revisá: Email (formato inválido), Teléfono (obligatorio)".
// Sin dependencias de servidor: lo usan tanto las rutas API como los formularios.

export const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  name: "Nombre",
  telefono: "Teléfono",
  email: "Email",
  password: "Contraseña",
  confirmPassword: "Repetir contraseña",
  role: "Rol",
  mensaje: "Mensaje",
  notas: "Notas",
  nota: "Nota",
  estado: "Estado",
  asignadoA: "Comercial asignado",
  reservadoPor: "Comercial",
  leadId: "Lead",
  dniCuit: "DNI/CUIT",
  domicilio: "Domicilio",
  nacionalidad: "Nacionalidad",
  fechaNacimiento: "Fecha de nacimiento",
  estadoCivil: "Estado civil",
  cuitComprador: "CUIT del comprador",
  nombreComprador: "Nombre del comprador",
  dniComprador: "DNI del comprador",
  emailComprador: "Email del comprador",
  domicilioComprador: "Domicilio del comprador",
  nombreCoComprador: "Nombre del co-comprador",
  dniCoComprador: "DNI del co-comprador",
  nacionalidadCoComprador: "Nacionalidad del co-comprador",
  fechaNacimientoCoComprador: "Fecha de nacimiento del co-comprador",
  domicilioCoComprador: "Domicilio del co-comprador",
  cuitCoComprador: "CUIT del co-comprador",
  estadoCivilCoComprador: "Estado civil del co-comprador",
  porcentajeCoComprador: "Porcentaje del co-comprador",
  nombreApoderado: "Nombre del apoderado",
  dniApoderado: "DNI del apoderado",
  nombreCorredor: "Nombre del corredor",
  emailCorredor: "Email del corredor",
  dniCorredor: "DNI del corredor",
  honorariosNum: "Honorarios",
  formaPago: "Forma de pago",
  tipoPago: "Tipo de pago",
  modalidadContrato: "Modalidad (USD fijo / Pesos + CAC)",
  modalidad: "Modalidad (USD fijo / Pesos + CAC)",
  fechaReserva: "Fecha de reserva",
  fechaVencimiento: "Fecha de vencimiento",
  fechaFirma: "Fecha de firma",
  observaciones: "Observaciones",
  observacion: "Observación",
  precioTotalNum: "Precio total",
  reservaNum: "Monto de reserva",
  anticipoNum: "Anticipo",
  anticipo: "Anticipo",
  saldoNum: "Saldo",
  cantidadCuotas: "Cantidad de cuotas",
  cuotaMensual: "Cuota mensual",
  numeroCuotaEntrega: "Cuota de entrega",
  plazo: "Plazo",
  tipoCambioBna: "Tipo de cambio BNA vendedor",
  monedaBoleto: "Moneda del boleto",
  dia: "Día",
  mes: "Mes",
  anio: "Año",
  manzana: "Manzana",
  parcela: "Parcela",
  lote: "Lote",
  precioBase: "Precio base",
  precioEtapa1: "Precio etapa 1",
  superficieM2: "Superficie",
  fecha: "Fecha",
  valor: "Valor",
  periodo: "Período",
  fuente: "Fuente",
  fechaPago: "Fecha de pago",
  monto: "Monto",
  moneda: "Moneda",
  medio: "Medio de pago",
  importeBase: "Importe",
  fechaInicio: "Fecha de inicio",
  fechaPrimerVencimiento: "Primer vencimiento",
  cuotaBase: "Cuota base",
  saldoInicial: "Saldo inicial",
  diaVencimiento: "Día de vencimiento",
  periodoBaseCac: "Período base CAC",
  calleInmueble: "Calle del inmueble",
  limites: "Límites",
  tituloPlano: "Título / plano",
  medidas: "Medidas",
};

type Issue = {
  code: string;
  path: readonly PropertyKey[];
  message: string;
  minimum?: unknown;
  maximum?: unknown;
  inclusive?: boolean;
  format?: string;
  origin?: string;
};

function problem(issue: Issue): string {
  switch (issue.code) {
    case "invalid_type":
      // zod v4 no incluye el input en el issue; el mensaje por defecto termina en "received undefined".
      return /received (undefined|null)$/.test(issue.message) ? "obligatorio" : "valor inválido";
    case "too_small":
      if (issue.origin === "string") return Number(issue.minimum) <= 1 ? "obligatorio" : `mínimo ${issue.minimum} caracteres`;
      if (Number(issue.minimum) === 0) return issue.inclusive ? "no puede ser negativo" : "debe ser mayor a 0";
      return `mínimo ${issue.minimum}`;
    case "too_big":
      return issue.origin === "string" ? `máximo ${issue.maximum} caracteres` : `máximo ${issue.maximum}`;
    case "invalid_format":
      if (issue.format === "email") return "email inválido";
      return "formato inválido";
    case "invalid_value":
      return "opción inválida";
    default:
      return issue.message;
  }
}

export function validationMessage(issues: readonly Issue[]): string {
  const parts = issues.map((issue) => {
    const key = issue.path[issue.path.length - 1];
    const label = typeof key === "string" ? (FIELD_LABELS[key] ?? key) : null;
    return label ? `${label} (${problem(issue)})` : issue.message;
  });
  return `Revisá: ${Array.from(new Set(parts)).join(", ")}`;
}
