import { useMemo, useState } from "react";
import {
    ArrowLeft,
    Building2,
    Clock3,
    MapPin,
    Navigation,
    Search,
    ShieldCheck,
    Star,
} from "lucide-react";

type ClinicType = "public" | "private";

interface Clinic {
    id: number;
    name: string;
    type: ClinicType;
    address: string;
    distance: number;
    rating: number;
    reviews: number;
    openUntil: string;
    priceFrom: number | null;
}

interface ClinicFinderProps {
    onBack: () => void;
}

const demoClinics: Clinic[] = [
    {
        id: 1,
        name: "Jessheim Tannklinikk",
        type: "public",
        address: "Jessheim sentrum",
        distance: 0.8,
        rating: 4.5,
        reviews: 42,
        openUntil: "15:30",
        priceFrom: null,
    },
    {
        id: 2,
        name: "Sentrum Tannhelse",
        type: "private",
        address: "Storgata, Jessheim",
        distance: 1.2,
        rating: 4.8,
        reviews: 126,
        openUntil: "18:00",
        priceFrom: 890,
    },
    {
        id: 3,
        name: "Nordby Tannlegesenter",
        type: "private",
        address: "Jessheim",
        distance: 2.4,
        rating: 4.7,
        reviews: 84,
        openUntil: "17:00",
        priceFrom: 790,
    },
];

export default function ClinicFinder({
    onBack,
}: ClinicFinderProps) {
    const [location, setLocation] = useState("Jessheim");

    const [clinicType, setClinicType] = useState<
        "all" | ClinicType
    >("all");

    const [coordinates, setCoordinates] = useState<
        {
            latitude: number;
            longitude: number;
        } | null
    >(null);

    const [locationError, setLocationError] = useState("");

    const filteredClinics = useMemo(() => {
        if (clinicType === "all") {
            return demoClinics;
        }

        return demoClinics.filter(
            (clinic) => clinic.type === clinicType,
        );
    }, [clinicType]);

    function useCurrentLocation() {
        setLocationError("");

        if (!navigator.geolocation) {
            setLocationError(
                "Nettleseren støtter ikke posisjon.",
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = position.coords.latitude;

                const longitude = position.coords.longitude;

                setCoordinates({
                    latitude,
                    longitude,
                });

                setLocation("Din posisjon");
            },
            () => {
                setLocationError(
                    "Kunne ikke hente posisjonen. Sjekk at du har gitt nettleseren tilgang.",
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            },
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f8fb]">
            {/* Header */}
            <header className="border-b border-[#e2ebf1] bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-2 text-sm font-bold text-[#60788c]"
                    >
                        <ArrowLeft size={18} />
                        Tilbake
                    </button>

                    <div className="flex items-center gap-3">
                        <img
                            src="/logo_web.png"
                            alt="Pocket Dentist"
                            className="h-9 object-contain"
                        />
                    </div>

                    <div className="hidden text-xs font-bold text-[#7d91a3] sm:flex sm:items-center sm:gap-2">
                        <ShieldCheck
                            size={16}
                            className="text-[#14b8c4]"
                        />

                        Trygg klinikksammenligning
                    </div>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="border-b border-[#e2ebf1] bg-white">
                    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf9fb] px-3 py-1.5 text-xs font-black text-[#1096a1]">
                                <MapPin size={14} />
                                Finn tannlege nær deg
                            </div>

                            <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-[#10233f] sm:text-5xl">
                                Finn riktig tannklinikk
                                <span className="text-[#14b8c4]">
                                    {" "}
                                    i nærheten
                                </span>
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-[#6f8496]">
                                Sammenlign offentlige og private tannklinikker
                                basert på beliggenhet, vurderinger, priser og
                                behandlingstilbud.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="mt-8 flex max-w-4xl flex-col gap-3 rounded-[24px] border border-[#dfe8ee] bg-white p-3 shadow-xl shadow-[#10233f]/5 sm:flex-row">
                            <div className="relative flex-1">
                                <MapPin
                                    size={19}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#14b8c4]"
                                />

                                <input
                                    type="text"
                                    value={location}
                                    onChange={(event) =>
                                        setLocation(event.target.value)}
                                    placeholder="By, område eller postnummer"
                                    className="h-14 w-full rounded-2xl bg-[#f7fafc] pl-12 pr-4 text-sm font-semibold text-[#10233f] outline-none placeholder:text-[#9aabb9] focus:ring-2 focus:ring-[#14b8c4]/20"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={useCurrentLocation}
                                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#dce7ed] px-5 text-sm font-bold text-[#536e83] transition hover:bg-[#f5f9fb]"
                            >
                                <Navigation size={17} />
                                Bruk min posisjon
                            </button>

                            <button
                                type="button"
                                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#14c8d4] px-7 text-sm font-black text-white shadow-lg shadow-[#14c8d4]/20 transition hover:bg-[#0fb3be]"
                            >
                                <Search size={17} />
                                Søk
                            </button>
                        </div>

                        {locationError && (
                            <p className="mt-3 text-sm font-semibold text-red-500">
                                {locationError}
                            </p>
                        )}

                        {coordinates && (
                            <p className="mt-3 text-xs text-[#7d91a3]">
                                Posisjon funnet:{" "}
                                {coordinates.latitude.toFixed(4)},{" "}
                                {coordinates.longitude.toFixed(4)}
                            </p>
                        )}
                    </div>
                </section>

                {/* Results */}
                <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
                        {/* Filters */}
                        <aside>
                            <div className="rounded-[26px] border border-[#dfe8ee] bg-white p-5 shadow-sm">
                                <h2 className="text-base font-black text-[#10233f]">
                                    Filtrer klinikker
                                </h2>

                                <p className="mt-1 text-xs leading-5 text-[#8a9cad]">
                                    Velg hvilken type tannhelsetjeneste du
                                    ønsker å se.
                                </p>

                                <div className="mt-6 space-y-2">
                                    {[
                                        {
                                            value: "all",
                                            label: "Alle klinikker",
                                        },
                                        {
                                            value: "public",
                                            label: "Offentlige",
                                        },
                                        {
                                            value: "private",
                                            label: "Private",
                                        },
                                    ].map((filter) => {
                                        const active =
                                            clinicType === filter.value;

                                        return (
                                            <button
                                                key={filter.value}
                                                type="button"
                                                onClick={() =>
                                                    setClinicType(
                                                        filter.value as
                                                            | "all"
                                                            | ClinicType,
                                                    )}
                                                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                                                    active
                                                        ? "bg-[#eaf9fb] text-[#1096a1]"
                                                        : "text-[#647c8f] hover:bg-[#f6f9fb]"
                                                }`}
                                            >
                                                <span>{filter.label}</span>

                                                {active && (
                                                    <span className="h-2 w-2 rounded-full bg-[#14c8d4]" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 border-t border-[#edf1f4] pt-6">
                                    <p className="text-xs font-bold uppercase tracking-wide text-[#91a2b2]">
                                        Flere filtre kommer
                                    </p>

                                    <div className="mt-3 space-y-3 text-sm text-[#718698]">
                                        <p>Behandling</p>
                                        <p>Pris</p>
                                        <p>Vurdering</p>
                                        <p>Åpent nå</p>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Clinic list */}
                        <div>
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#14a6b2]">
                                        {location || "Ditt område"}
                                    </p>

                                    <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#10233f]">
                                        Klinikker i nærheten
                                    </h2>

                                    <p className="mt-1 text-sm text-[#8194a4]">
                                        {filteredClinics.length}{" "}
                                        klinikker funnet
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="text-sm font-bold text-[#597185]"
                                >
                                    Sorter: Nærmest
                                </button>
                            </div>

                            <div className="space-y-4">
                                {filteredClinics.map((clinic) => (
                                    <article
                                        key={clinic.id}
                                        className="group rounded-[26px] border border-[#dfe8ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#10233f]/5 sm:p-6"
                                    >
                                        <div className="flex flex-col gap-5 sm:flex-row">
                                            <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e9f8fa] to-[#eef3f8] text-[#14a6b2] sm:h-auto sm:w-36">
                                                <Building2 size={34} />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                                                    clinic
                                                                            .type ===
                                                                            "public"
                                                                        ? "bg-blue-50 text-blue-600"
                                                                        : "bg-[#eaf9fb] text-[#1096a1]"
                                                                }`}
                                                            >
                                                                {clinic.type ===
                                                                        "public"
                                                                    ? "Offentlig"
                                                                    : "Privat"}
                                                            </span>

                                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                                <Clock3
                                                                    size={13}
                                                                />
                                                                Åpent til{" "}
                                                                {clinic
                                                                    .openUntil}
                                                            </span>
                                                        </div>

                                                        <h3 className="mt-3 text-xl font-black tracking-[-0.025em] text-[#10233f]">
                                                            {clinic.name}
                                                        </h3>

                                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#758a9c]">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <MapPin
                                                                    size={15}
                                                                />
                                                                {clinic.address}
                                                            </span>

                                                            <span className="font-bold text-[#526b80]">
                                                                {clinic
                                                                    .distance}
                                                                {" "}
                                                                km unna
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 rounded-xl bg-[#fff9eb] px-3 py-2">
                                                        <Star
                                                            size={16}
                                                            className="fill-[#f2b84b] text-[#f2b84b]"
                                                        />

                                                        <span className="text-sm font-black text-[#10233f]">
                                                            {clinic.rating}
                                                        </span>

                                                        <span className="text-xs text-[#8c9ba8]">
                                                            ({clinic.reviews})
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-5 flex flex-col gap-4 border-t border-[#edf1f4] pt-5 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold text-[#91a2b2]">
                                                            {clinic.priceFrom
                                                                ? "Pris fra"
                                                                : "Pris"}
                                                        </p>

                                                        <p className="mt-1 font-black text-[#10233f]">
                                                            {clinic.priceFrom
                                                                ? `${clinic.priceFrom} kr`
                                                                : "Se offentlige satser"}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="rounded-2xl bg-[#10233f] px-5 py-3 text-sm font-black text-white transition group-hover:bg-[#14b8c4]"
                                                    >
                                                        Se klinikk
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <p className="mt-6 text-xs leading-5 text-[#95a4b1]">
                                Klinikkene som vises nå er eksempeldata brukt
                                mens vi bygger søkeopplevelsen. Ingen priser,
                                anmeldelser eller åpningstider på denne siden
                                skal regnes som ekte data ennå.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
