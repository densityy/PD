import {
  MessageCircle,
  MapPin,
  Send,
  ArrowRight,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Fortell Pia hva du trenger',
    description:
      'Beskriv problemet eller behandlingen du ser etter. Pia stiller noen enkle spørsmål.',
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Finn riktig klinikk',
    description:
      'Pia finner en relevant tannklinikk i nærheten basert på behovet og plasseringen din.',
  },
  {
    number: '03',
    icon: Send,
    title: 'Send forespørselen',
    description:
      'Opplysningene sendes trygt til klinikken, som kontakter deg for videre oppfølging.',
  },
];

interface HowItWorksProps {
  onOpenChat?: () => void;
}

export default function HowItWorks({ onOpenChat }: HowItWorksProps) {
  return (
    <section
      id="slik-fungerer-det"
      className="relative overflow-hidden bg-white px-6 py-24 sm:py-28"
    >
      <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-100/50 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
            Enkelt og stressfritt
          </span>

          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-[#0d1e3d] sm:text-5xl">
            Slik fungerer det
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Fra første melding til kontakt med en relevant tannklinikk på bare
            noen få minutter.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, description }, index) => (
            <div key={number} className="relative">
              <article className="group h-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-[#13b8c5]">
                    <Icon size={27} strokeWidth={2} />
                  </div>

                  <span className="text-sm font-bold tracking-widest text-slate-300">
                    {number}
                  </span>
                </div>

                <h3 className="mt-7 text-xl font-bold text-[#0d1e3d]">
                  {title}
                </h3>

                <p className="mt-4 leading-7 text-slate-600">
                  {description}
                </p>
              </article>

              {index < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-cyan-500 shadow-sm md:flex">
                  <ArrowRight size={18} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-3 rounded-2xl bg-[#13b8c5] px-7 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-[#0fa7b3]"
          >
            Snakk med Pia
            <ArrowRight size={19} />
          </button>

          <p className="mt-4 text-sm text-slate-500">
            Gratis å bruke · Tar omtrent 2 minutter
          </p>
        </div>
      </div>
    </section>
  )};