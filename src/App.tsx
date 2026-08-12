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

  /*
   * --------------------------------------------------
   * PUBLIC LANDING PAGE
   * --------------------------------------------------
   */
  if (view === "landing") {
    return (
      <LandingPage
        onOpenClinics={() => setView("clinics")}
        onOpenClinicPlatform={() => {
          setPage("dashboard");
          setView("app");
        }}
      />
    );
  }

  /*
   * --------------------------------------------------
   * PATIENT CLINIC FINDER
   * --------------------------------------------------
   */
  if (view === "clinics") {
    return (
      <ClinicFinder
        onBack={() => setView("landing")}
      />
    );
  }

  /*
   * --------------------------------------------------
   * OPTIONAL DASHBOARD PREVIEW
   * --------------------------------------------------
   */
  if (view === "preview") {
    return (
      <DashboardPreview
        onBack={() => setView("landing")}
      />
    );
  }

  /*
   * --------------------------------------------------
   * CLINIC PLATFORM
   * --------------------------------------------------
   */
  return (
    <div className="flex min-h-screen bg-[#f4f8fb]">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
      />

      <div className="min-w-0 flex-1">
        {page === "dashboard" && <Dashboard />}

        {page !== "dashboard" && (
          <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
            <p className="text-xl font-bold text-[#10233f]">
              Denne siden kommer snart
            </p>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#71889b]">
              Vi jobber med denne delen av klinikkplattformen.
            </p>

            <button
              type="button"
              onClick={() =>
                setView(
                  "landing",
                )}
              className="mt-5 rounded-xl border border-[#d8e8f2] bg-white px-5 py-2.5 text-sm font-bold text-[#1689d4] shadow-sm transition hover:bg-[#f3f9fd]"
            >
              ← Tilbake til Pocket Dentist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
