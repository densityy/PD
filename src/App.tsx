import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import LandingPage from "@/components/LandingPage";
import DashboardPreview from "@/components/DashboardPreview";
import ClinicFinder from "@/pages/ClinicFinder";

type Page =
  | "dashboard"
  | "booking"
  | "patients"
  | "ai-assistant"
  | "reports"
  | "settings";

type View =
  | "landing"
  | "app"
  | "preview"
  | "clinics";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [page, setPage] = useState<Page>("dashboard");

  if (view === "landing") {
    return (
      <>
        <LandingPage onOpenPreview={() => setView("app")} />

        <button
          onClick={() => setView("app")}
          className="fixed bottom-6 left-6 z-50 rounded-xl bg-[#14c8d4] px-5 py-3 font-bold text-white shadow-lg"
        >
          Open Dashboard
        </button>

        <button
          onClick={() => setView("clinics")}
          className="fixed top-24 right-6 z-40 rounded-xl bg-[#10233f] px-5 py-3 font-bold text-white shadow-lg"
        >
          Finn klinikk
        </button>
      </>
    );
  }

  if (view === "clinics") {
    return (
      <ClinicFinder
        onBack={() => setView("landing")}
      />
    );
  }

  if (view === "preview") {
    return (
      <DashboardPreview
        onBack={() => setView("landing")}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f3f7fb]">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
      />

      <div className="min-w-0 flex-1">
        {page === "dashboard" && <Dashboard />}

        {page !== "dashboard" && (
          <div className="flex min-h-screen flex-col items-center justify-center">
            <p className="text-xl font-bold text-[#10233f]">
              Denne siden kommer snart
            </p>

            <button
              onClick={() => setView("landing")}
              className="mt-3 text-sm text-[#14c8d4] hover:underline"
            >
              ← Tilbake til nettsiden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
