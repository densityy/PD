import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';

interface DashboardPreviewProps {
  onBack: () => void;
}

export default function DashboardPreview({ onBack }: DashboardPreviewProps) {
  return (
    <div className="min-h-screen bg-[#0d1e3d] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Tilbake til nettsiden
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/logo_web.png" alt="Pocket Dentist" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">Pocketdentist</span>
            <span className="text-[#14c8d4] font-bold text-sm">.no</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#14c8d4]/15 text-[#14c8d4] px-3 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles size={12} />
          Forhåndsvisning — Kommer snart
        </div>
      </div>

      {/* Label */}
      <div className="text-center pt-10 pb-6 px-6">
        <p className="text-[#14c8d4] text-xs font-semibold uppercase tracking-widest mb-2">Klinikk-dashboard</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2 tracking-tight">
          Slik vil det se ut for din klinikk
        </h1>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Et komplett verktøy for å motta og håndtere pasientforespørsler fra Pia. Registrer deg på ventelisten for tidlig tilgang.
        </p>
      </div>

      {/* Browser mockup */}
      <div className="flex-1 px-4 lg:px-12 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex items-center gap-2 flex-1 justify-center">
                <div className="bg-white/10 rounded-md px-4 py-1 text-xs text-white/50 max-w-xs w-full text-center flex items-center justify-center gap-1.5">
                  <span className="text-white/30">🔒</span>
                  pocketdentist.no/dashboard
                </div>
              </div>
              <div className="flex items-center gap-1 text-white/30">
                <ExternalLink size={12} />
              </div>
            </div>

            {/* Dashboard screenshot */}
            <img
              src="/images/example_final.png"
              alt="Pocket Dentist klinikk-dashboard forhåndsvisning"
              className="w-full h-auto block"
            />
          </div>

          {/* Waitlist CTA below */}
          <div className="mt-10 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 max-w-xl mx-auto text-center">
            <h3 className="text-white font-bold text-lg mb-2">Interessert i tidlig tilgang?</h3>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              Vi lanserer dashboardet for klinikker i 2026. Legg igjen e-posten din og vi kontakter deg først.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Takk! Vi tar kontakt når dashboardet er klart.');
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                placeholder="klinikk@eksempel.no"
                className="flex-1 text-sm bg-white/10 rounded-xl px-4 py-3 border border-white/15 outline-none focus:border-[#14c8d4] transition-colors text-white placeholder-white/30"
              />
              <button
                type="submit"
                className="bg-[#14c8d4] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#0fb3be] transition-colors whitespace-nowrap"
              >
                Meld meg på
              </button>
            </form>
            <p className="text-white/25 text-xs mt-4">Ingen spam. Kun én e-post når vi er klare.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
