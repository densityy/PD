import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import PiaChat from "@/components/PiaChat";
import Hero from "@/sections/Hero";

interface LandingPageProps {
  onOpenPreview: () => void;
}

const openPia = () => window.dispatchEvent(new Event("open-pia-chat"));

export default function LandingPage({ onOpenPreview }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7fbff] text-[#10233f]">
      <nav
        className={`fixed inset-x-0 top-0 z-40 transition-all ${
          scrolled
            ? "border-b border-[#dceaf5] bg-white/90 shadow-sm backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#d8e7f3]">
              <img
                src="/logo_web.png"
                alt="Pocket Dentist"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-[17px] font-extrabold leading-tight">
                Pocket Dentist
              </p>
              <p className="text-[11px] font-medium text-[#668198]">
                Riktig tannlege, enklere
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#how"
              className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]"
            >
              Slik fungerer det
            </a>
            <a
              href="#clinics"
              className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]"
            >
              For klinikker
            </a>
            <a
              href="#trust"
              className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]"
            >
              Trygghet
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[#526c85] hover:bg-white"
            >
              <LayoutDashboard size={17} />
              Klinikkdemo
            </button>
            <button
              type="button"
              onClick={openPia}
              className="inline-flex items-center gap-2 rounded-full bg-[#1689d4] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1689d4]/20 hover:bg-[#0878c2]"
            >
              Snakk med Pia
              <ArrowRight size={17} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenu((value) => !value)}
            className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#dceaf5] md:hidden"
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenu && (
          <div className="border-t border-[#dceaf5] bg-white px-5 py-5 md:hidden">
            <div className="space-y-2">
              <a
                href="#how"
                onClick={() => setMobileMenu(false)}
                className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]"
              >
                Slik fungerer det
              </a>
              <a
                href="#clinics"
                onClick={() => setMobileMenu(false)}
                className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]"
              >
                For klinikker
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenu(false);
                  openPia();
                }}
                className="mt-2 w-full rounded-xl bg-[#1689d4] px-4 py-3 font-bold text-white"
              >
                Snakk med Pia
              </button>
            </div>
          </div>
        )}
      </nav>

      <main>
        <Hero />

        <section
          id="how"
          className="relative overflow-hidden bg-white px-6 py-24 sm:py-28"
        >
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
                Enkelt og stressfritt
              </span>

              <h2 className="mt-6 text-5xl font-black tracking-tight text-[#0d1e3d]">
                Slik fungerer det
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                Fra første melding til kontakt med riktig tannklinikk på bare
                noen få minutter.
              </p>
            </div>

            <div className="mt-16 grid gap-7 md:grid-cols-3">
              {[
                {
                  number: "01",
                  icon: MessageCircle,
                  title: "Beskriv problemet",
                  text: "Fortell Pia hva du trenger hjelp med. Hun stiller noen få enkle spørsmål.",
                },
                {
                  number: "02",
                  icon: Stethoscope,
                  title: "Pia finner riktig klinikk",
                  text: "AI matcher deg med en passende tannklinikk basert på behov og lokasjon.",
                },
                {
                  number: "03",
                  icon: Building2,
                  title: "Send forespørselen",
                  text: "Klinikken mottar informasjonen og tar kontakt med deg så raskt som mulig.",
                },
              ].map((item) => (
                <div key={item.number} className="relative">
                  <div className="rounded-3xl border border-[#dfeaf3] bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf9ff]">
                        <item.icon size={28} className="text-[#1689d4]" />
                      </div>

                      <span className="text-sm font-black tracking-widest text-slate-300">
                        {item.number}
                      </span>
                    </div>

                    <h3 className="mt-7 text-xl font-black text-[#10233f]">
                      {item.title}
                    </h3>

                    <p className="mt-4 leading-7 text-[#647d91]">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-14 text-center">
              <button
                onClick={openPia}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1689d4] px-7 py-4 font-bold text-white shadow-xl shadow-cyan-500/20 hover:bg-[#0878c2]"
              >
                Snakk med Pia
                <ArrowRight size={18} />
              </button>

              <p className="mt-4 text-sm text-slate-500">
                Gratis • Tar omtrent 2 minutter
              </p>
            </div>
          </div>
        </section>

        <section
          id="clinics"
          className="relative overflow-hidden bg-[#f3f9fd] px-5 py-24 sm:py-28 lg:px-8"
        >
          <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/60 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#bfe4f5] bg-white px-4 py-2 text-sm font-bold text-[#1689d4] shadow-sm">
                <Building2 size={16} />
                For tannklinikker
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-[-0.04em] text-[#10233f] sm:text-5xl">
                Hele klinikken samlet på ett sted
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#607a91]">
                Administrer pasientdialog, booking, meldinger og oppfølging fra
                én brukervennlig klinikkportal.
              </p>

              <button
                type="button"
                onClick={onOpenPreview}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#1689d4] px-7 py-4 font-extrabold text-white shadow-xl shadow-[#1689d4]/20 transition hover:-translate-y-0.5 hover:bg-[#0878c2]"
              >
                <LayoutDashboard size={19} />
                Se klinikkdemo
                <ArrowRight size={19} />
              </button>
            </div>

            <div className="mt-14 rounded-[36px] border border-[#d6e8f3] bg-white p-3 shadow-[0_35px_100px_rgba(30,106,155,0.18)] sm:p-5">
              <div className="overflow-hidden rounded-[27px] border border-[#deebf3] bg-white">
                <div className="flex items-center gap-2 border-b border-[#e2edf4] bg-white px-5 py-4">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />

                  <div className="ml-4 flex-1 rounded-full bg-[#f3f7fa] px-4 py-2 text-center text-xs font-medium text-[#9aabba]">
                    pocketdentist.no/klinikk
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="group relative block w-full overflow-hidden bg-[#f8fbfd] text-left"
                  aria-label="Åpne klinikkdemo"
                >
                  <img
                    src="/images/example_final.png"
                    alt="Forhåndsvisning av Pocket Dentist klinikkdashboard"
                    className="block h-auto w-full transition duration-500 group-hover:scale-[1.01]"
                  />

                  <div className="absolute inset-0 flex items-center justify-center bg-[#10233f]/0 transition duration-300 group-hover:bg-[#10233f]/10">
                    <span className="translate-y-3 rounded-2xl bg-white px-6 py-3 font-extrabold text-[#10233f] opacity-0 shadow-xl transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      Åpne interaktiv demo
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: MessageCircle,
                  title: "Pasientdialog",
                  text: "Svar på meldinger og følg opp pasienter fra samme sted.",
                },
                {
                  icon: Stethoscope,
                  title: "AI-assistent",
                  text: "Pia hjelper klinikken med oppfølging og administrative oppgaver.",
                },
                {
                  icon: LayoutDashboard,
                  title: "Booking og oversikt",
                  text: "Se avtaler, nye pasienter og viktige oppgaver med én gang.",
                },
                {
                  icon: ShieldCheck,
                  title: "Trygg håndtering",
                  text: "Strukturert og samtykkebasert håndtering av pasienthenvendelser.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-[#dceaf3] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8ff] text-[#1689d4]">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-5 font-black text-[#10233f]">{title}</h3>

                  <p className="mt-2 text-sm leading-6 text-[#71889b]">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-5xl px-5 lg:px-8">
            <div className="rounded-[34px] bg-[#1689d4] px-8 py-12 text-center text-white shadow-2xl shadow-[#1689d4]/20">
              <h2 className="text-4xl font-black tracking-[-0.03em]">
                Trenger du en tannlege?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/80">
                Start med Pia og send en forespørsel på noen få minutter.
              </p>
              <button
                type="button"
                onClick={openPia}
                className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-extrabold text-[#126fae]"
              >
                Start samtalen
                <ArrowRight size={19} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dceaf4] bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between lg:px-8">
          <p className="font-extrabold">Pocket Dentist</p>
          <p className="text-sm text-[#8297aa]">
            © 2026 Pocket Dentist. Alle rettigheter forbeholdt.
          </p>
          <a
            href="mailto:hei@pocketdentist.no"
            className="text-sm font-semibold text-[#688097]"
          >
            Kontakt
          </a>
        </div>
      </footer>

      <PiaChat />
    </div>
  );
}
