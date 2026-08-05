import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  Home,
  MessageCircle,
  Settings,
  Users,
} from 'lucide-react';

type Page =
  | 'dashboard'
  | 'booking'
  | 'patients'
  | 'ai-assistant'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: {
  id: Page;
  label: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'dashboard',
    label: 'Oversikt',
    icon: Home,
  },
  {
    id: 'booking',
    label: 'Booking',
    icon: CalendarDays,
  },
  {
    id: 'patients',
    label: 'Pasienter',
    icon: Users,
  },
  {
    id: 'ai-assistant',
    label: 'AI-assistent',
    icon: Bot,
  },
  {
    id: 'reports',
    label: 'Rapporter',
    icon: BarChart3,
  },
  {
    id: 'settings',
    label: 'Innstillinger',
    icon: Settings,
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col bg-gradient-to-b from-[#073861] to-[#052b4e] text-white shadow-2xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <img
          src="/logo_web.png"
          alt="Pocket Dentist"
          className="h-16 w-16 flex-shrink-0 object-contain"
        />

        <div className="min-w-0">
          <p className="truncate text-base font-black tracking-tight">
            Pocketdentist
            <span className="text-[#44d9e2]">.no</span>
          </p>

          <p className="mt-0.5 text-xs font-medium text-white/55">
            AI-drevet assistent
          </p>
        </div>
      </div>

      {/* Clinic selector */}
      <div className="px-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
            <span className="text-sm font-black">ST</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              Sentrum Tannklinikk
            </p>

            <p className="mt-0.5 truncate text-xs text-white/50">
              Dr. Nora Berg
            </p>
          </div>

          <ChevronDown
            size={17}
            className="flex-shrink-0 text-white/55"
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-7 flex-1 overflow-y-auto px-3">
        <ul className="space-y-2">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className={`group flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#10a9c1] to-[#0b91ae] text-white shadow-lg shadow-cyan-950/30'
                      : 'text-white/75 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon
                    size={21}
                    strokeWidth={2}
                    className={
                      isActive
                        ? 'text-white'
                        : 'text-white/70 group-hover:text-white'
                    }
                  />

                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Patient dialog placeholder */}
        <button
          type="button"
          className="group mt-2 flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-sm font-bold text-white/75 transition hover:bg-white/8 hover:text-white"
        >
          <MessageCircle
            size={21}
            strokeWidth={2}
            className="text-white/70 group-hover:text-white"
          />

          <span>Pasientdialog</span>
        </button>
      </nav>

      {/* User profile */}
      <div className="border-t border-white/15 px-4 py-5">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/8"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#50d9df] to-[#08768d]">
            <span className="text-sm font-black text-white">NB</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              Nora Berg
            </p>

            <p className="mt-0.5 truncate text-xs text-white/50">
              Administrator
            </p>
          </div>

          <ChevronDown
            size={16}
            className="flex-shrink-0 text-white/50"
          />
        </button>
      </div>
    </aside>
  );
}