import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type LegalPageName = "personvern" | "vilkar" | "informasjonskapsler";

const company = {
  name: "HANSEN GROUP AS",
  organisationNumber: "938 162 379",
  address: "Kvelvahaugen 1, 9440 Evenskjer, Norge",
  email: "hei@pocketdentist.no",
};

function PageShell({
  title,
  updated = "22. august 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f8fb] px-5 py-10 text-[#18314d] sm:py-16">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#dce8ef] bg-white p-6 shadow-sm sm:p-10">
        <a
          href="#/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#078e99] hover:underline"
        >
          <ArrowLeft size={16} /> Til Pocket Dentist
        </a>
        <h1 className="mt-7 text-3xl font-black text-[#0d1e3d] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#6f8798]">Sist oppdatert: {updated}</p>
        <div className="prose prose-slate mt-8 max-w-none space-y-7 leading-7">
          {children}
        </div>
        <div className="mt-10 border-t border-[#dce8ef] pt-6">
          <ControllerDetails />
        </div>
      </article>
    </main>
  );
}

function ControllerDetails() {
  return (
    <div className="text-xs leading-5 text-[#6f8798]">
      <p className="font-bold text-[#18314d]">Virksomhetsopplysninger</p>
      <p>{company.name}</p>
      <p>Org.nr.: {company.organisationNumber}</p>
      <p>{company.address}</p>
      <p>
        E-post: <a href={`mailto:${company.email}`}>{company.email}</a>
      </p>
    </div>
  );
}

function PrivacyPage() {
  return (
    <PageShell title="Personvernerklæring">
      <section>
        <h2 className="text-xl font-bold">Hva Pocket Dentist gjør</h2>
        <p>
          Pocket Dentist hjelper voksne brukere med å finne norske tannklinikker,
          sammenligne publiserte priser og gå videre til klinikkens egne
          kontaktkanaler. Pia er en KI-assistent. Tjenesten stiller ikke diagnose
          og sender ikke henvisninger eller kontaktopplysninger til klinikker.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold">Opplysninger og formål</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Chattekst og opplysninger om tannhelse brukes for å svare, foreslå
            relevante søk og finne klinikker. Behandlingsgrunnlaget er ditt
            uttrykkelige samtykke.
          </li>
          <li>
            Posisjon brukes bare etter at du trykker «Bruk posisjonen min», og
            bare for det aktuelle klinikksøket. Du kan alltid skrive inn sted.
          </li>
          <li>
            Tekniske sikkerhetslogger kan behandles for å sikre og feilsøke
            tjenesten basert på vår berettigede interesse i sikker drift.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold">Mottakere og leverandører</h2>
        <p>
          Opplysninger kan behandles av Supabase (database og serverfunksjoner),
          OpenAI (KI-svar), Hostinger (nettside) og Google (klinikk-/kartdata),
          men ikke klinikkene som vises i søkeresultatet. Du kontakter selv en
          klinikk via dens egne kanaler. Databehandleravtaler,
          lagringsregioner og eventuelle overføringer utenfor EØS skal være
          dokumentert før produksjonslansering.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold">Lagringstid</h2>
        <p>
          Pocket Dentist samler ikke inn navn eller telefonnummer i den offentlige
          Pia-chatten og oppretter ikke pasienthenvisninger. Posisjonen lagres ikke
          i nettleseren. Chatten nullstilles lokalt når du trekker tilbake
          samtykket eller laster siden på nytt. Leverandørenes tekniske logger og
          lagringstider skal dokumenteres før produksjonslansering.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold">Dine rettigheter</h2>
        <p>
          Du kan trekke tilbake samtykke og be om innsyn, retting, sletting,
          begrensning eller dataportabilitet. Kontakt {company.email}. Du kan også
          klage til Datatilsynet på datatilsynet.no.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold">Aldersgrense og akutt hjelp</h2>
        <p>
          Chatten er for personer som er 18 år eller eldre. Ved alvorlige eller
          akutte symptomer må du kontakte tannlege, legevakt 116 117 eller 113.
        </p>
      </section>
    </PageShell>
  );
}

function TermsPage() {
  return (
    <PageShell title="Vilkår for bruk">
      <section>
        <h2 className="text-xl font-bold">Tjenestens rolle</h2>
        <p>
          Pocket Dentist er en søke- og formidlingstjeneste for voksne. Pia er en
          KI-assistent og gir generell informasjon, ikke diagnose, behandling eller
          medisinsk garanti. Du velger selv klinikk og inngår eventuell avtale
          direkte med klinikken.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold">Priser og klinikkopplysninger</h2>
        <p>
          Priser kan være hentet fra klinikkens nettside, prisliste eller annen
          oppgitt kilde. De er veiledende og kan være endret. Kontroller alltid
          pris, tillegg, refusjon og vilkår med klinikken før behandling. Merking
          som privat/offentlig eller NAV-garanti må også bekreftes med klinikken.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold">Google-data</h2>
        <p>
          Enkelte klinikkopplysninger leveres av Google. Bruk av disse dataene er
          også underlagt Googles vilkår og personvernregler.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold">Kontakt og ansvar</h2>
        <p>
          Meld feil til {company.email}. Tjenesten skal ikke brukes i en
          nødsituasjon. Vi kan endre eller midlertidig stanse tjenesten ved
          vedlikehold, sikkerhetshendelser eller feil i tredjepartstjenester.
        </p>
      </section>
    </PageShell>
  );
}

function CookiesPage() {
  return (
    <PageShell title="Informasjonskapsler og lokal lagring">
      <section>
        <h2 className="text-xl font-bold">Dagens løsning</h2>
        <p>
          Pocket Dentist bruker per i dag ikke Google Analytics, Meta Pixel eller
          annen markedsføringssporing. Nødvendig teknisk lagring kan brukes for å
          levere og sikre tjenesten. Posisjonssamtykke eller koordinater lagres ikke
          permanent i nettleseren.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold">Fremtidig analyse</h2>
        <p>
          Ikke-nødvendig analyse eller markedsføring vil ikke aktiveres før du har
          fått et valg med like tydelige «Godta» og «Avslå»-alternativer. Samtykke
          skal være frivillig, spesifikt, granulært og enkelt å trekke tilbake.
          Markedsføringspiksler skal ikke plasseres i chatten eller andre deler som
          kan avsløre tannhelseopplysninger.
        </p>
      </section>
    </PageShell>
  );
}

export default function LegalPages({ page }: { page: LegalPageName }) {
  if (page === "vilkar") return <TermsPage />;
  if (page === "informasjonskapsler") return <CookiesPage />;
  return <PrivacyPage />;
}
