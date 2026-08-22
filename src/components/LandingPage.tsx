import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import PiaChat from "@/components/PiaChat";
import ClinicFinder from "@/pages/ClinicFinder";

const openPiaChat = () => {
  window.dispatchEvent(new Event("open-pia-chat"));
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToFinder = () => {
    setMobileMenuOpen(false);
    document.getElementById("finder")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f7fbff] text-[#10233f]">
      <nav
        className={`fixed inset-x-0 top-0 z-40 border-b transition ${
          scrolled
            ? "border-[#dceaf5] bg-white/95 shadow-sm backdrop-blur-xl"
            : "border-transparent bg-white/85 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Pocket Dentist">
            <img
              src="/logo_web.png"
              alt=""
              className="h-11 w-11 rounded-2xl object-cover shadow-sm ring-1 ring-[#d8e7f3]"
            />
            <div>
              <p className="text-[17px] font-extrabold leading-tight">Pocket Dentist</p>
              <p className="text-[11px] font-medium text-[#668198]">Riktig tannlege, enklere</p>
            </div>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#pia" className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]">
              Om Pia
            </a>
            <button
              type="button"
              onClick={scrollToFinder}
              className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]"
            >
              Finn klinikk
            </button>
            <a href="#trust" className="text-sm font-semibold text-[#526c85] hover:text-[#10233f]">
              Trygghet
            </a>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={openPiaChat}
              className="inline-flex items-center gap-2 rounded-full bg-[#1689d4] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1689d4]/20"
            >
              Chat med Pia <ArrowRight size={17} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Lukk meny" : "Åpne meny"}
            className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#dceaf5] md:hidden"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="space-y-2 border-t border-[#dceaf5] bg-white px-5 py-4 md:hidden">
            <a href="#pia" onClick={() => setMobileMenuOpen(false)} className="block rounded-xl px-3 py-2 font-semibold text-[#526c85]">
              Om Pia
            </a>
            <button type="button" onClick={scrollToFinder} className="block w-full rounded-xl px-3 py-2 text-left font-semibold text-[#526c85]">
              Finn klinikk
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openPiaChat();
              }}
              className="w-full rounded-xl bg-[#1689d4] px-4 py-3 font-bold text-white"
            >
              Chat med Pia
            </button>
          </div>
        )}
      </nav>

      <main id="top" className="pt-[72px]">
        <section className="relative overflow-hidden px-5 py-16 sm:py-24 lg:px-8">
          <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-cyan-100/70 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#bee8f1] bg-white px-4 py-2 text-sm font-bold text-[#118a9a] shadow-sm">
                <Sparkles size={16} /> Gratis hjelp til å finne tannklinikk
              </span>
              <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-[-0.055em] text-[#0d1e3d] sm:text-6xl lg:text-7xl">
                Finn riktig tannlege.
                <span className="block text-[#14b8c4]">Sammenlign priser.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#607a91]">
                Søk selv etter klinikker i byen din, eller få hjelp av Pia – vår AI-resepsjonist som finner relevante klinikker og tilgjengelige priser.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={scrollToFinder}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10233f] px-7 py-4 font-extrabold text-white shadow-xl shadow-[#10233f]/15 transition hover:bg-[#183457]"
                >
                  <Search size={19} /> Finn klinikk
                </button>
                <button
                  type="button"
                  onClick={openPiaChat}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1689d4] px-7 py-4 font-extrabold text-white shadow-xl shadow-[#1689d4]/20 transition hover:bg-[#0878c2]"
                >
                  <MessageCircle size={19} /> Chat med Pia
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#607a91]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#14b8c4]" /> Gratis å bruke</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#14b8c4]" /> Priser fra offentlige kilder</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#14b8c4]" /> Du velger klinikken</span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[520px]">
              <div className="relative overflow-hidden rounded-[40px] border border-white/80 bg-gradient-to-b from-[#dff5ff] to-[#bfe8fa] p-5 shadow-[0_35px_100px_rgba(30,106,155,0.2)] sm:p-8">
                <div className="absolute inset-x-12 top-10 h-52 rounded-full bg-white/70 blur-3xl" />
                <img
                  src="/pia-2d/pia-neutral.png"
                  alt="Pia, Pocket Dentist sin AI-resepsjonist"
                  className="relative mx-auto block max-h-[580px] w-full rounded-[28px] object-cover object-top"
                />
                <div className="relative -mt-14 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xl backdrop-blur">
                  <p className="font-black text-[#10233f]">Hei, jeg er Pia</p>
                  <p className="mt-1 text-sm leading-6 text-[#607a91]">
                    Fortell meg hva du trenger og hvor du er, så hjelper jeg deg med å sammenligne klinikker og priser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pia" className="bg-white px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf9fb] px-4 py-2 text-sm font-bold text-[#1096a1]">
                <MessageCircle size={16} /> Din digitale tannlegeresepsjonist
              </span>
              <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Hva kan Pia hjelpe med?</h2>
              <p className="mt-5 text-lg leading-8 text-[#607a91]">
                Pia er en AI-resepsjonist for tannhelse. Hun hjelper deg å finne en passende klinikk – ikke med å stille diagnose.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                { icon: MessageCircle, title: "Forstår behovet ditt", text: "Fortell kort hva du trenger hjelp med. Pia stiller enkle oppfølgingsspørsmål." },
                { icon: MapPin, title: "Finner klinikker", text: "Pia søker i området du velger og viser relevante klinikker med kontaktinformasjon." },
                { icon: Search, title: "Sammenligner priser", text: "Når klinikkene publiserer priser, viser Pocket Dentist dem for behandlingen du søker etter." },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-[28px] border border-[#dceaf3] bg-[#f8fbfd] p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f8fb] text-[#1096a1]"><Icon size={23} /></div>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6b8295]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="finder" className="scroll-mt-20 border-y border-[#deebf3] bg-[#f4f8fb]">
          <ClinicFinder embedded />
        </section>

        <section id="trust" className="bg-white px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[34px] bg-[#10233f] px-7 py-12 text-center text-white shadow-2xl sm:px-10">
            <ShieldCheck size={34} className="mx-auto text-[#66dce4]" />
            <h2 className="mt-5 text-3xl font-black sm:text-4xl">Trygg hjelp til å finne klinikk</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/75">
              Pocket Dentist bruker posisjon bare når du godkjenner det. Du kan alltid skrive inn by eller postnummer manuelt og velger selv hvilken klinikk du kontakter.
            </p>
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[#8297aa]">
            Pocket Dentist gir generell informasjon og hjelp til å finne tannklinikker. Tjenesten stiller ikke diagnose og erstatter ikke tannlege, legevakt eller akutt helsehjelp.
          </p>
        </section>
      </main>

      <footer className="border-t border-[#dceaf4] bg-white py-9">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 text-sm text-[#8297aa] sm:grid-cols-3 lg:px-8">
          <div>
            <p className="font-extrabold text-[#10233f]">Pocket Dentist</p>
            <p className="mt-1 text-xs">HANSEN GROUP AS · Org.nr. 938 162 379</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-center">
            <a href="#/personvern" className="font-semibold hover:text-[#10233f]">Personvern</a>
            <a href="#/vilkar" className="font-semibold hover:text-[#10233f]">Vilkår</a>
            <a href="#/informasjonskapsler" className="font-semibold hover:text-[#10233f]">Informasjonskapsler</a>
          </div>
          <div className="sm:text-right">
            <a href="mailto:hei@pocketdentist.no" className="font-semibold hover:text-[#10233f]">hei@pocketdentist.no</a>
            <p className="mt-1 text-xs">© 2026 Pocket Dentist</p>
          </div>
        </div>
      </footer>

      <PiaChat />
    </div>
  );
}
