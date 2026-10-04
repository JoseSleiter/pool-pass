import type { Dictionary } from './types';

/**
 * English dictionary. Typed as `Dictionary`, so a missing, extra or misspelled
 * key (at any depth) is a compile error. Keep `{placeholders}` identical to es.ts.
 * "Pago Móvil", "C2P", "BCV" and "Bs." are proper names of the payment rail
 * and stay untranslated on purpose.
 */
export const en: Dictionary = {
  meta: {
    description:
      'Book your pool pass online, pay with Pago Móvil and get in with your QR code. No lines, no cash.',
    ogDescription: 'Book your pool pass online, pay with Pago Móvil and get in with your QR code.',
    ogLocale: 'en_US',
  },
  header: {
    home: 'Home',
    howItWorks: 'How it works',
    prices: 'Prices',
    book: 'Book',
    language: 'Language',
  },
  content: {
    tagline: 'Your pool day, one click away',
    subtitle: 'Book online, pay with Pago Móvil and get in with your QR. No lines, no cash.',
    steps: {
      chooseDate: 'Pick a date',
      payC2p: 'Pay with C2P',
      getQr: 'Get your QR',
      walkIn: 'Walk right in',
    },
    amenities: {
      pool: 'Pools for adults and kids',
      lifeguards: 'Certified lifeguards',
      food: 'Food and drinks',
      parking: 'Free parking',
      shade: 'Shade and loungers',
      showers: 'Showers and changing rooms',
    },
    hours: 'Tue–Sun · 9:00 am – 6:00 pm',
  },
  hero: {
    titleLine1: 'Book your pass.',
    titleLine2: 'Enjoy the water.',
    body:
      'Pick your date, add the people coming with you and get your digital pass in minutes. Secure payment with Pago Móvil and easy entry from your phone.',
    adultsFrom: 'Adults from',
    kids: 'Kids',
    poolOpen: 'Pool open',
    soldOutToday: 'Sold out today',
  },
  features: {
    headingLine1: 'Everything you need',
    headingLine2: 'to get in and have fun',
    items: {
      booking: {
        title: 'Book in minutes',
        body: 'Pick the day, add your group and see your total right away.',
      },
      payment: {
        title: 'Secure Pago Móvil',
        body: "Pay in bolívares at the day's BCV rate and get a confirmation.",
      },
      email: {
        title: 'Your pass arrives by email',
        body: 'Show your digital voucher along with your ID when you arrive.',
      },
    },
  },
  howItWorks: {
    heading: 'How your booking works',
    steps: {
      date: 'Pick the date',
      group: 'Register your group',
      pay: 'Pay with C2P',
      voucher: 'Get your voucher',
    },
  },
  finalCta: {
    heading: 'Ready to enjoy the pool',
    body:
      'Your digital pass is tied to your booking and lands straight in your inbox. Just show your voucher and your ID at the entrance.',
    cta: 'Book my pass',
  },
  footer: {
    tagline: 'Online booking · Pago Móvil C2P · Voucher by email',
  },
  booking: {
    title: 'Book your pass',
    titleDone: 'Your pass is ready',
    subtitle: 'Fill in these details to see your total',
    subtitleDone: 'Keep this receipt to get in',
    securePayment: 'Secure payment',
    slotsToday: 'Spots left today: {count}',
    noSlotsToday: 'No spots left today',
    noSlotsTodayPickAnother: 'No spots left today — pick another date',
    visitDate: 'Visit date',
    people: 'Guests',
    chooseAttendees: 'Add guests',
    estimatedTotal: 'Estimated total',
    rateLine: 'Bs. {ves} · rate {rate}',
    continue: 'Continue',
    done: 'Done',
    whenTitle: 'When are you coming?',
    onlyAvailableDays: 'We only show days with spots available',
    whoTitle: "Who's coming?",
    adults: 'Adults',
    children: 'Kids',
    perPerson: '{price} per person',
    totalUpdates: 'Your total updates automatically',
    decrease: 'Decrease {label}',
    increase: 'Increase {label}',
  },
  pay: {
    title: 'Details to confirm your booking',
    intro: "We'll use these details to verify your identity and process the Pago Móvil payment.",
    honeypot: 'Leave this field empty',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    idLabel: 'ID / RIF',
    idType: 'Document type',
    idNumber: 'Document number',
    phone: 'Phone',
    bank: 'Bank',
    bankPlaceholder: 'Select your bank',
    otp: 'C2P payment key',
    otpHint: "Generate your C2P key in your bank's app before paying.",
    submit: 'Confirm and pay',
    submitting: 'Processing…',
  },
  pending: {
    title: 'Payment being verified',
    message: "Your payment is being verified. We'll reach out with the confirmation.",
    doNotRetry: "We'll reach out with the confirmation. Please don't try to pay again.",
  },
  done: {
    confirmed: 'Booking confirmed! 🎉',
    sentTo: 'Your digital pass was sent to',
    showAtEntrance: 'Show it at the entrance along with your ID.',
    dayPass: 'Day pass',
    qrAlt: 'QR code for your pass',
    name: 'Name:',
    document: 'ID:',
    date: 'Date:',
    attendees: 'Guests:',
    paid: 'Paid:',
    whatsapp: 'Questions? Message us on WhatsApp',
  },
  errors: {
    noAttendees: 'Add at least one guest to continue.',
    capacity:
      "There's no longer enough room on that date (spots left: {remaining}). Please pick another date.",
    paymentDeclined: 'Payment declined: {message}. Generate a new C2P key and try again.',
    rateLimited: 'Too many attempts in a row. Wait a moment and try again.',
    rateUnavailable: "We couldn't get the BCV exchange rate. Please try again later.",
    invalidData: 'Invalid details',
  },
  validation: {
    invalidDate: 'Invalid date',
    required: 'Required',
    tooLong: 'Too long',
    invalidEmail: 'Invalid email',
    invalidIdType: 'Invalid document type',
    idDigits: 'Digits only (5–10)',
    invalidPhone: 'Invalid Venezuelan phone number (04XX...)',
    bankRequired: 'Please choose a bank',
    pinRequired: 'Key required',
    noAttendees: 'Include at least one person',
    invalid: 'Invalid value',
  },
  party: {
    adultOne: '{count} adult',
    adultOther: '{count} adults',
    childOne: '{count} child',
    childOther: '{count} children',
  },
  amenities: {
    heading: "What you'll find at the club",
    body: 'Pool, shade, food and everything you need to stay all day.',
    scheduleHeading: 'Opening hours',
    rulesHeading: 'Pool rules',
    rules: {},
  },
};
