import { useEffect, useState } from "react";

import LandingPage from "@/components/LandingPage";
import LegalPages, { type LegalPageName } from "@/components/LegalPages";

function getLegalPage(): LegalPageName | null {
  const route = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return ["personvern", "vilkar", "informasjonskapsler"].includes(route)
    ? (route as LegalPageName)
    : null;
}

export default function App() {
  const [legalPage, setLegalPage] = useState<LegalPageName | null>(getLegalPage);

  useEffect(() => {
    const handleHashChange = () => {
      setLegalPage(getLegalPage());
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (legalPage) {
    return <LegalPages page={legalPage} />;
  }

  return <LandingPage />;
}
