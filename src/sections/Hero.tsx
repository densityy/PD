import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

const openPia = () => window.dispatchEvent(new Event('open-pia-chat'));

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pb-24 pt-32 lg:pb-32 lg:pt-40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(20,184,212,0.10),transparent_27%),radial-gradient(circle_at_82%_22%,rgba(56,189,248,0.11),transparent_24%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8edf3] bg-[#f7fcfd] px-4 py-2 text-xs font-bold text-[#1596a5]">
            <Sparkles size={14} />
            Din digitale tannhelsesekretær
          </div>

          <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.045em] text-[#0d1e3d] sm:text-6xl lg:text-[72px]">
            Riktig tannlege.
            <span className="block text-[#14b8c4]">Uten stress.</span>
          </h1>

          <p className="mt-7 max-w-lg text-lg leading-8 text-[#65778d]">
            Pia hjelper deg med å beskrive behovet ditt, finne en relevant klinikk
            i nærheten og sende forespørselen videre på bare noen få minutter.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openPia}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14b8c4] px-7 py-4 text-base font-extrabold text-white shadow-[0_14px_30px_rgba(20,184,196,0.24)] transition hover:-translate-y-0.5 hover:bg-[#109eaa]"
            >
              Snakk med Pia
              <ArrowRight size={19} />
            </button>

            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-2xl border border-[#dfe8ef] bg-white px-7 py-4 text-base font-bold text-[#243b55] transition hover:border-[#c7d6e0]"
            >
              Slik fungerer det
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-[#74879a]">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#21a67a]" />
              Gratis å bruke
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#21a67a]" />
              Tar ca. 2 minutter
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#21a67a]" />
              Samtykke før innsending
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -left-10 top-16 h-40 w-40 rounded-full bg-[#a7edf1]/30 blur-3xl" />
          <div className="absolute -right-8 bottom-10 h-44 w-44 rounded-full bg-[#b7e7ff]/35 blur-3xl" />

          <div className="relative rounded-[32px] border border-[#e8eef3] bg-white p-3 shadow-[0_34px_90px_rgba(31,62,92,0.14)]">
            <div className="flex items-center gap-2 border-b border-[#edf1f4] px-3 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff807c]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffc35c]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#57cf8d]" />
              <div className="ml-3 flex-1 rounded-lg bg-[#f6f8fa] px-4 py-2 text-center text-[11px] text-[#9aa8b4]">
                pocketdentist.no
              </div>
            </div>

            <div className="grid min-h-[470px] overflow-hidden rounded-[24px] bg-[#f8fbfd] md:grid-cols-[190px_1fr]">
              <aside className="hidden border-r border-[#e8eef3] bg-white p-5 md:block">
                <div className="mb-8 flex items-center gap-2">
                  <div className="h-9 w-9 overflow-hidden rounded-xl ring-1 ring-[#d9e7ee]">
                    <img
                      src="/logo_web.png"
                      alt="Pocket Dentist"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-extrabold text-[#0d1e3d]">
                    PocketDentist
                  </span>
                </div>

                <div className="space-y-2">
                  {['Oversikt', 'Henvendelser', 'Pasienter', 'Innstillinger'].map(
                    (item, index) => (
                      <div
                        key={item}
                        className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${
                          index === 0
                            ? 'bg-[#eafafb] text-[#1596a5]'
                            : 'text-[#7d8d9d]'
                        }`}
                      >
                        {item}
                      </div>
                    ),
                  )}
                </div>
              </aside>

              <div className="p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#91a0ad]">
                      God kveld
                    </p>
                    <h3 className="mt-1 text-xl font-black text-[#0d1e3d]">
                      Velkommen tilbake
                    </h3>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#1596a5] shadow-sm ring-1 ring-[#e5edf2]">
                    + Ny henvendelse
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Nye i dag', '12'],
                    ['Kontaktet', '8'],
                    ['Bestilt time', '5'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-[#e6edf2] bg-white p-4"
                    >
                      <p className="text-[11px] font-semibold text-[#8b9aa7]">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-[#0d1e3d]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#e6edf2] bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-extrabold text-[#0d1e3d]">
                      Siste henvendelser
                    </p>
                    <span className="text-xs font-semibold text-[#1596a5]">
                      Se alle
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      ['Sara N.', 'Tannpine', 'Oslo'],
                      ['Jonas H.', 'Kontroll', 'Bergen'],
                      ['Mina A.', 'Akutt', 'Oslo'],
                    ].map(([name, reason, place]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-xl bg-[#f8fbfd] px-3 py-3"
                      >
                        <div>
                          <p className="text-xs font-extrabold text-[#243b55]">
                            {name}
                          </p>
                          <p className="mt-1 text-[11px] text-[#8a98a5]">
                            {reason}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6d8194]">
                          <MapPin size={12} />
                          {place}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-7 left-6 hidden rounded-2xl border border-[#e3ebf0] bg-white p-4 shadow-xl sm:block">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf3]">
                <CheckCircle2 size={20} className="text-[#20a975]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#90a0ad]">
                  Forespørsel sendt
                </p>
                <p className="text-sm font-extrabold text-[#17324d]">
                  Tannklinikken Sentrum
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openPia}
            className="absolute -right-4 top-16 hidden rounded-2xl border border-[#e3ebf0] bg-white p-4 text-left shadow-xl transition hover:-translate-y-0.5 sm:block"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f9fa]">
                <MessageCircle size={19} className="text-[#14b8c4]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#90a0ad]">
                  Pia er online
                </p>
                <p className="text-sm font-extrabold text-[#17324d]">
                  Start samtale
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}