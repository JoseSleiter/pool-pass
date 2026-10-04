/**
 * Spanish dictionary: the source of truth. `Dictionary = typeof es`, so every
 * key added here must also be added to en.ts (the compiler enforces it).
 *
 * Rules:
 * - Values are plain strings. The dictionary crosses the server→client
 *   boundary as a prop, so it cannot hold functions.
 * - Variables are written as `{name}` and filled with `interpolate()`.
 * - Never translated, so they do not live here: the club name, the address,
 *   the WhatsApp/Instagram handles (landing-content.ts), bank names
 *   (banks.ts), prices and amounts.
 */
export const es = {
  meta: {
    description:
      'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR. Sin colas, sin efectivo.',
    ogDescription:
      'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR.',
    ogLocale: 'es_VE',
  },
  header: {
    home: 'Inicio',
    howItWorks: 'Cómo funciona',
    prices: 'Precios',
    book: 'Reservar',
    language: 'Idioma',
  },
  content: {
    tagline: 'Tu día de piscina, a un clic',
    subtitle: 'Reserva online, paga con Pago Móvil y entra con tu QR. Sin colas, sin efectivo.',
    steps: {
      chooseDate: 'Elige fecha',
      payC2p: 'Paga C2P',
      getQr: 'Recibe tu QR',
      walkIn: 'Entra directo',
    },
    amenities: {
      pool: 'Piscina para adultos y niños',
      lifeguards: 'Salvavidas certificados',
      food: 'Comida y bebidas',
      parking: 'Estacionamiento gratis',
      shade: 'Toldos y tumbonas',
      showers: 'Duchas y vestuarios',
    },
    // TODO: horario real — este es inventado y sale en el footer de cada página.
    // TODO: horario real — inventado; sale en el footer de cada página (también en en.ts).
    hours: 'Mar–Dom · 9:00 am – 6:00 pm',
  },
  hero: {
    titleLine1: 'Reserva tu pase.',
    titleLine2: 'Disfruta el agua.',
    body:
      'Elige tu fecha, registra a tus acompañantes y recibe tu pase digital en minutos. Pago seguro con Pago Móvil y acceso fácil desde tu celular.',
    adultsFrom: 'Adultos desde',
    kids: 'Niños',
    poolOpen: 'Piscina abierta',
    soldOutToday: 'Agotado hoy',
  },
  features: {
    headingLine1: 'Todo lo que necesitas',
    headingLine2: 'para entrar y disfrutar',
    items: {
      booking: {
        title: 'Reserva en minutos',
        body: 'Escoge el día, agrega a tu grupo y conoce el total al instante.',
      },
      payment: {
        title: 'Pago Móvil seguro',
        body: 'Paga en bolívares con la tasa BCV del día y recibe confirmación.',
      },
      email: {
        title: 'Tu pase llega por email',
        body: 'Presenta tu voucher digital junto con tu identificación al llegar.',
      },
    },
  },
  howItWorks: {
    heading: 'Así funciona tu reserva',
    steps: {
      date: 'Elige la fecha',
      group: 'Registra tu grupo',
      pay: 'Paga con C2P',
      voucher: 'Recibe tu voucher',
    },
  },
  finalCta: {
    heading: 'Listo para disfrutar la piscina',
    body:
      'Tu pase digital queda asociado a tu reserva y llega directamente a tu correo. Solo presenta tu voucher y tu identificación en el acceso.',
    cta: 'Reservar mi pase',
  },
  footer: {
    tagline: 'Reservas digitales · Pago Móvil C2P · Voucher por email',
  },
  booking: {
    title: 'Reserva tu pase',
    titleDone: 'Tu pase está listo',
    subtitle: 'Completa estos datos para ver tu total',
    subtitleDone: 'Guarda este comprobante para el acceso',
    securePayment: 'Pago seguro',
    slotsToday: '{count} cupos disponibles hoy',
    noSlotsToday: 'Sin cupos hoy',
    noSlotsTodayPickAnother: 'Sin cupos hoy — elige otra fecha',
    visitDate: 'Fecha de visita',
    people: 'Personas',
    chooseAttendees: 'Elige asistentes',
    estimatedTotal: 'Total estimado',
    rateLine: 'Bs. {ves} · tasa {rate}',
    continue: 'Continuar',
    done: 'Listo',
    whenTitle: '¿Cuándo vienes?',
    onlyAvailableDays: 'Solo mostramos días con cupo disponible',
    whoTitle: '¿Quiénes van?',
    adults: 'Adultos',
    children: 'Niños',
    perPerson: '{price} por persona',
    totalUpdates: 'El total se actualiza automáticamente',
    decrease: 'Disminuir {label}',
    increase: 'Aumentar {label}',
  },
  pay: {
    title: 'Datos para confirmar tu reserva',
    intro: 'Usaremos estos datos para validar tu identidad y procesar el Pago Móvil.',
    honeypot: 'No llenar este campo',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    idLabel: 'Cédula / RIF',
    idType: 'Tipo de documento',
    idNumber: 'Número de documento',
    phone: 'Teléfono',
    bank: 'Banco',
    bankPlaceholder: 'Selecciona tu banco',
    otp: 'Clave de Pago (C2P)',
    otpHint: 'Genera la clave C2P desde la app de tu banco antes de pagar.',
    submit: 'Confirmar y pagar',
    submitting: 'Procesando…',
  },
  pending: {
    title: 'Pago en verificación',
    // Same sentence the server returns for payment_pending (src/lib/booking/process.ts).
    message: 'Tu pago está siendo verificado. Te contactaremos con la confirmación.',
    doNotRetry: 'Te contactaremos con la confirmación. No intentes pagar de nuevo.',
  },
  done: {
    confirmed: '¡Reserva confirmada! 🎉',
    sentTo: 'Tu pase digital fue enviado a',
    showAtEntrance: 'Muéstralo en la entrada junto con tu identificación.',
    dayPass: 'Pase del día',
    qrAlt: 'Código QR de tu pase',
    name: 'Nombre:',
    document: 'Documento:',
    date: 'Fecha:',
    attendees: 'Asistentes:',
    paid: 'Pagado:',
    whatsapp: '¿Dudas? Escríbenos por WhatsApp',
  },
  errors: {
    noAttendees: 'Agrega al menos un asistente para continuar.',
    capacity: 'Ya no hay cupo suficiente para esa fecha. Quedan {remaining} puestos. Elige otra fecha.',
    paymentDeclined: 'Pago rechazado: {message}. Genera una nueva clave C2P e intenta de nuevo.',
    // rateLimited / rateUnavailable mirror the server's messages word for word.
    rateLimited: 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.',
    rateUnavailable: 'No pudimos obtener la tasa BCV. Intenta de nuevo más tarde.',
    invalidData: 'Datos inválidos',
  },
  // Keys that mirror a custom message in src/lib/schemas.ts must match it word
  // for word (validation.test.ts checks it), so Spanish users see no change.
  validation: {
    invalidDate: 'Fecha inválida',
    required: 'Requerido',
    tooLong: 'Demasiado largo',
    invalidEmail: 'Correo inválido',
    invalidIdType: 'Tipo de documento inválido',
    idDigits: 'Solo dígitos (5–10)',
    invalidPhone: 'Teléfono venezolano inválido (04XX...)',
    bankRequired: 'Banco requerido',
    pinRequired: 'Clave requerida',
    noAttendees: 'Debe incluir al menos una persona',
    invalid: 'Dato inválido',
  },
  party: {
    adultOne: '{count} adulto',
    adultOther: '{count} adultos',
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
};
