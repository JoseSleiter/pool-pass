import Link from 'next/link';
import { CalendarCheck, ShieldCheck, Mail, Ticket, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: CalendarCheck,
    title: 'Reserva en minutos',
    body: 'Escoge el día, agrega a tu grupo y conoce el total al instante.',
  },
  {
    icon: ShieldCheck,
    title: 'Pago Móvil seguro',
    body: 'Paga en bolívares con la tasa BCV del día y recibe confirmación.',
  },
  {
    icon: Mail,
    title: 'Tu pase llega por email',
    body: 'Presenta tu voucher digital junto con tu identificación al llegar.',
  },
];

const steps = [
  { n: '01', label: 'Elige la fecha' },
  { n: '02', label: 'Registra tu grupo' },
  { n: '03', label: 'Paga con C2P' },
  { n: '04', label: 'Recibe tu voucher' },
];

export function Features() {
  return (
    <section id="como-funciona" className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-xl text-center font-heading text-4xl font-semibold leading-tight text-navy">
          Todo lo que necesitas
          <br />
          para entrar y disfrutar
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-7 shadow-sm"
            >
              <f.icon className="h-7 w-7 text-teal" strokeWidth={1.75} />
              <h3 className="mt-5 text-lg font-bold text-navy">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-heading text-4xl font-semibold text-white">
          Así funciona tu reserva
        </h2>
        <div className="mt-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <p className="font-heading text-4xl font-semibold text-teal">{s.n}</p>
              <p className="mt-3 text-sm font-semibold text-white">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section
      id="precios"
      className="px-6 py-20 text-white"
      style={{ background: 'linear-gradient(160deg, #075e82 0%, #0c8f94 100%)' }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Ticket className="h-9 w-9 text-teal-soft" strokeWidth={1.75} />
        <h2 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl">
          Listo para disfrutar la piscina
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">
          Tu pase digital queda asociado a tu reserva y llega directamente a tu
          correo. Solo presenta tu voucher y tu identificación en el acceso.
        </p>
        <Link
          href="/reservar"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-navy-deep/30 transition-transform hover:scale-[1.02]"
        >
          Reservar mi pase
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
