import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Bot,
  BarChart3,
  Settings,
  ChevronRight,
  //tooth was here
} from "lucide-react";

type Page =
  | "dashboard"
  | "booking"
  | "patients"
  | "ai-assistant"
  | "reports"
  | "settings";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Oversikt", icon: LayoutDashboard },
  { id: "booking", label: "Pasientbooking", icon: CalendarDays },
  { id: "patients", label: "Pasienter", icon: Users },
  { id: "ai-assistant", label: "AI-assistent", icon: Bot },
  { id: "reports", label: "Rapporter", icon: BarChart3 },
  { id: "settings", label: "Innstillinger", icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-[#0d1e3d] flex flex-col z-20 shadow-2xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
          <img
            src="/logo_web.png"
            alt="Pocket Dentist"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="min-w-0">
          <span className="text-white font-bold text-sm leading-tight block truncate">
            PocketDentist
          </span>

          <span className="text-[#14c8d4] text-xs font-medium">.no</span>
        </div>
      </div>

      {/* Clinic label */}
      <div className="px-5 py-3 border-b border-white/10">
        <p className="text-white/40 text-xs uppercase tracking-wider font-medium">
          Klinikk
        </p>
        <p className="text-white/80 text-sm font-medium mt-0.5 truncate">
          AI Tannlegesentrum
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                    isActive
                      ? "bg-[#14c8d4] text-white shadow-lg shadow-[#14c8d4]/25"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      isActive
                        ? "text-white"
                        : "text-white/50 group-hover:text-white/80"
                    }
                  />
                  <span className="flex-1 text-left">{label}</span>
                  {isActive && (
                    <ChevronRight size={14} className="text-white/60" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User profile */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#14c8d4] to-[#0a9ba6] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">NB</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">Nora Berg</p>
            <p className="text-white/40 text-xs truncate">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
