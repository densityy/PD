import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";

import PiaChat from "@/components/PiaChat";
import PiaCall from "@/components/PiaCall";
import Hero from "@/sections/Hero";

interface LandingPageProps {
  onOpenClinics: () => void;
  onOpenClinicPlatform: () => void;
}

const openPia = () =>
  window.dispatchEvent(
    new Event("open-pia-chat"),
  );

export default function LandingPage({
  onOpenClinics,
  onOpenClinicPlatform,
}: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);

  const [
    mobileMenu,
    setMobileMenu,
  ] = useState(false);

  const [
    piaCallOpen,
    setPiaCallOpen,
  ] = useState(() => (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("pia-call-preview")
  ));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);

    window.addEventListener(
      "scroll",
      handleScroll,
    );

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll,
      );
  }, []);

  const closeMobileMenu = () => setMobileMenu(false);

  return (
    <div className="min-h-screen bg-[#f7fbff] text-[#10233f]">
      {/* NAVIGATION */}
      <nav
        className={`fixed inset-x-0 top-0 z-40 transition-all ${
          scrolled
            ? "border-b border-[#dceaf5] bg-white/95 shadow-sm backdrop-blur-xl"
            : "bg-white/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a
            href="#"
            className="flex items-center gap-3"
            aria-label="Pocket Dentist"
          >
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
              className="text-sm font-semibold text-[#526c85] transition hover:text-[#10233f]"
            >
              Slik fungerer det
            </a>

            <a
              href="#clinics"
              className="text-sm font-semibold text-[#526c85] transition hover:text-[#10233f]"
            >
              For klinikker
            </a>

            <a
              href="#trust"
              className="text-sm font-semibold text-[#526c85] transition hover:text-[#10233f]"
            >
              Trygghet
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={onOpenClinics}
              className="inline-flex items-center gap-2 rounded-full bg-[#10233f] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#10233f]/15 transition hover:bg-[#183457]"
            >
              <Building2 size={17} />
              Finn klinikker
            </button>

            <button
              type="button"
              onClick={() => setPiaCallOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#b9dff4] bg-white px-5 py-2.5 text-sm font-bold text-[#1689d4] shadow-sm transition hover:bg-[#edf9ff]"
            >
              <Phone size={17} />
              Ring Pia
            </button>

            <button
              type="button"
              onClick={openPia}
              className="inline-flex items-center gap-2 rounded-full bg-[#1689d4] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1689d4]/20 transition hover:bg-[#0878c2]"
            >
              Snakk med Pia
              <ArrowRight size={17} />
            </button>
          </div>

          <button
            type="button"
            aria-label={mobileMenu ? "Lukk meny" : "Åpne meny"}
            onClick={() =>
              setMobileMenu(
                (value) => !value,
              )}
            className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#dceaf5] md:hidden"
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenu && (
          <div className="border-t border-[#dceaf5] bg-white px-5 py-5 shadow-lg md:hidden">
            <div className="space-y-2">
              <a
                href="#how"
                onClick={closeMobileMenu}
                className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]"
              >
                Slik fungerer det
              </a>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  onOpenClinics();
                }}
                className="block w-full rounded-xl px-3 py-2 text-left font-semibold text-[#526c85]"
              >
                Finn klinikker
              </button>

              <a
                href="#clinics"
                onClick={closeMobileMenu}
                className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]"
              >
                For klinikker
              </a>

              <a
                href="#trust"
                onClick={closeMobileMenu}
                className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]"
              >
                Trygghet
              </a>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  openPia();
                }}
                className="mt-3 w-full rounded-xl bg-[#1689d4] px-4 py-3 font-bold text-white"
              >
                Snakk med Pia
              </button>

              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  setPiaCallOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b9dff4] bg-white px-4 py-3 font-bold text-[#1689d4]"
              >
                <Phone size={17} />
                Ring Pia
              </button>
            </div>
          </div>
        )}
      </nav>

      <main>
        <Hero />

        {/* HOW IT WORKS */}
        <section
          id="how"
          className="relative overflow-hidden bg-white px-6 py-24 sm:py-28"
        >
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">
                Enkelt og oversiktlig
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-tight text-[#0d1e3d] sm:text-5xl">
                Slik fungerer det
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                Fra første spørsmål til relevante tannklinikker på få minutter.
              </p>
            </div>

            <div className="mt-16 grid gap-7 md:grid-cols-3">
              {[
                {
                  number: "01",
                  icon: MessageCircle,
                  title: "Fortell hva du trenger",
                  text:
                    "Beskriv kort hva du trenger hjelp med. Pia holder samtalen enkel og stiller bare relevante spørsmål.",
                },
                {
                  number: "02",
                  icon: Stethoscope,
                  title: "Bekreft posisjonen din",
                  text:
                    "Når du vil finne en klinikk, velger du posisjon eller skriver inn stedet selv.",
                },
                {
                  number: "03",
                  icon: Building2,
                  title: "Se relevante klinikker",
                  text:
                    "Pocket Dentist viser klinikker i området og tilgjengelig prisinformasjon når den finnes.",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="rounded-3xl border border-[#dfeaf3] bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf9ff]">
                      <item.icon
                        size={28}
                        className="text-[#1689d4]"
                      />
                    </div>

                    <span className="text-sm font-black tracking-widest text-slate-300">
                      {item.number}
                    </span>
                  </div>

                  <h3 className="mt-7 text-xl font-black text-[#10233f]">
                    {item.title}
                  </h3>

                  <p className="mt-4 leading-7 text-[#647d91]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openPia}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1689d4] px-7 py-4 font-bold text-white shadow-xl shadow-cyan-500/20 transition hover:bg-[#0878c2]"
              >
                Snakk med Pia
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                onClick={onOpenClinics}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#b9dff4] bg-white px-7 py-4 font-bold text-[#1689d4] shadow-sm transition hover:bg-[#edf9ff]"
              >
                <Building2 size={18} />
                Finn klinikker
              </button>

              <button
                type="button"
                onClick={() => setPiaCallOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#dce8ef] bg-white px-7 py-4 font-bold text-[#536e83] shadow-sm transition hover:bg-[#f7fafc]"
              >
                <Phone size={18} />
                Ring Pia
              </button>
            </div>
          </div>
        </section>

        {/* FOR CLINICS */}
        <section
          id="clinics"
          className="relative overflow-hidden bg-[#f3f9fd] px-5 py-24 sm:py-28 lg:px-8"
        >
          <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/60 blur-3xl" />

          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#bfe4f5] bg-white px-4 py-2 text-sm font-bold text-[#1689d4] shadow-sm">
                <Building2 size={16} />
                For tannklinikker
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-[-0.04em] text-[#10233f] sm:text-5xl">
                Pocket Dentist for klinikker
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#607a91]">
                Se hvordan Pocket Dentist samler pasienthenvendelser, oppfølging
                og klinikkoversikt i én løsning.
              </p>
            </div>

            <div className="mt-14 overflow-hidden rounded-[34px] border border-[#d6e8f3] bg-white shadow-[0_35px_100px_rgba(30,106,155,0.16)]">
              <div className="border-b border-[#e2edf4] bg-white px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-[#10233f]">
                      Klinikkplattform
                    </p>

                    <p className="mt-1 text-sm text-[#71889b]">
                      Slik ser Pocket Dentist ut for en tannklinikk.
                    </p>
                  </div>

                  <span className="rounded-full bg-[#edf9ff] px-3 py-1.5 text-xs font-bold text-[#1689d4]">
                    Produktvisning
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenClinicPlatform}
                className="group relative block w-full overflow-hidden bg-[#f8fbfd] text-left"
              >
                <img
                  src="/images/example_final.png"
                  alt="Pocket Dentist klinikkplattform"
                  className="block h-auto w-full transition duration-500 group-hover:scale-[1.01]"
                />

                <div className="absolute inset-0 flex items-center justify-center bg-[#10233f]/0 transition duration-300 group-hover:bg-[#10233f]/10">
                  <span className="translate-y-3 rounded-2xl bg-white px-6 py-3 font-extrabold text-[#10233f] opacity-0 shadow-xl transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    Åpne klinikkplattformen
                  </span>
                </div>
              </button>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: MessageCircle,
                  title: "Pasienthenvendelser",
                  text:
                    "Samle nye pasienthenvendelser og følg dem opp fra én oversikt.",
                },
                {
                  icon: Sparkles,
                  title: "Pia som inngang",
                  text:
                    "Pia hjelper pasienten frem til et konkret klinikkvalg og relevant neste steg.",
                },
                {
                  icon: ShieldCheck,
                  title: "Bygget for klinikkflyt",
                  text:
                    "En tydelig klinikkopplevelse med fokus på oversikt, oppfølging og kontroll.",
                },
              ].map(
                ({
                  icon: Icon,
                  title,
                  text,
                }) => (
                  <div
                    key={title}
                    className="rounded-[24px] border border-[#dceaf3] bg-white p-7 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8ff] text-[#1689d4]">
                      <Icon size={23} />
                    </div>

                    <h3 className="mt-5 font-black text-[#10233f]">
                      {title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#71889b]">
                      {text}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onOpenClinicPlatform}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1689d4] px-7 py-4 font-extrabold text-white shadow-xl shadow-[#1689d4]/20 transition hover:bg-[#0878c2]"
              >
                Se Pocket Dentist for klinikker
                <ArrowRight size={18} />
              </button>

              <a
                href="mailto:hei@pocketdentist.no"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#b9dff4] bg-white px-6 py-3.5 font-bold text-[#1689d4] shadow-sm transition hover:bg-[#edf9ff]"
              >
                Kontakt oss
              </a>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section
          id="trust"
          className="bg-white px-5 py-24"
        >
          <div className="mx-auto max-w-5xl">
            <div className="rounded-[34px] bg-[#1689d4] px-7 py-12 text-center text-white shadow-2xl shadow-[#1689d4]/20 sm:px-10">
              <ShieldCheck
                size={32}
                className="mx-auto text-white/90"
              />

              <h2 className="mt-5 text-4xl font-black tracking-[-0.03em]">
                Trenger du en tannlege?
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/85">
                Start med Pia. Du beholder kontrollen over posisjon og
                klinikkvalg hele veien.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openPia}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-extrabold text-[#126fae]"
                >
                  Start samtalen
                  <ArrowRight size={19} />
                </button>

                <button
                  type="button"
                  onClick={onOpenClinics}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-7 py-4 text-base font-extrabold text-white transition hover:bg-white/20"
                >
                  <Building2 size={19} />
                  Finn klinikker
                </button>
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[#8297aa]">
              Pocket Dentist gir generell veiledning og hjelp til å finne
              tannklinikker. Tjenesten stiller ikke diagnose og erstatter ikke
              tannlege, legevakt eller akutt helsehjelp. Ved alvorlige eller
              akutte symptomer må du kontakte relevant helsetjeneste.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dceaf4] bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-extrabold">
              Pocket Dentist
            </p>

            <p className="mt-1 text-xs text-[#8297aa]">
              Riktig tannlege, enklere
            </p>
          </div>

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

      <PiaCall
        open={piaCallOpen}
        onClose={() => setPiaCallOpen(false)}
      />
    </div>
  );
}
