import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import LandingPage from '@/components/LandingPage';
import DashboardPreview from '@/components/DashboardPreview';

type Page = 'dashboard' | 'booking' | 'patients' | 'ai-assistant' | 'reports' | 'settings';
type View = 'landing' | 'app' | 'preview';

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [page, setPage] = useState<Page>('dashboard');

 if (view === 'landing') {
  return (
    <>
      <LandingPage onOpenPreview={() => setView('app')} />

      <button
        onClick={() => setView('app')}
        className="fixed bottom-6 left-6 z-50 rounded-xl bg-[#14c8d4] px-5 py-3 font-bold text-white shadow-lg"
      >
        Open Dashboard
      </button>
    </>
  );
}

  if (view === 'preview') {
    return <DashboardPreview onBack={() => setView('landing')} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="ml-56">
        {page === 'dashboard' && <Dashboard />}
        {page !== 'dashboard' && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <p className="text-gray-400 text-lg">Denne siden kommer snart</p>
              <button
                onClick={() => setView('landing')}
                className="text-[#14c8d4] text-sm mt-3 hover:underline"
              >
                ← Tilbake til nettsiden
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
