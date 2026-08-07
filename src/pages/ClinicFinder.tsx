import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { addPricesToClinics } from "@/services/priceService";
import type { Clinic } from "@/types/pia";

import {
    ArrowLeft,
    Building2,
    MapPin,
    Navigation,
    Search,
    ShieldCheck,
    Star,
} from "lucide-react";

interface ClinicFinderProps {
    onBack: () => void;
}

export default function ClinicFinder({
    onBack,
}: ClinicFinderProps) {
    const [location, setLocation] = useState("Jessheim");

    const [coordinates, setCoordinates] = useState<
        {
            latitude: number;
            longitude: number;
        } | null
    >(null);

    const [locationError, setLocationError] = useState("");
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loadingClinics, setLoadingClinics] = useState(false);
    const [clinicError, setClinicError] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    const [selectedTreatment, setSelectedTreatment] = useState("root_canal");

    function useCurrentLocation() {
        setLocationError("");
        setClinicError("");

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

    async function searchClinics() {
        if (!coordinates && !location.trim()) {
            setClinicError(
                "Skriv inn et sted eller bruk posisjonen din.",
            );
            return;
        }

        setClinicError("");
        setLoadingClinics(true);
        setHasSearched(true);

        try {
            const body = coordinates
                ? {
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                }
                : {
                    location: location.trim(),
                };

            const { data, error } = await supabase.functions.invoke(
                "search-clinics",
                {
                    body,
                },
            );

            if (error) {
                console.error(
                    "Clinic search error:",
                    error,
                );

                setClinicError(
                    "Kunne ikke hente klinikker.",
                );

                return;
            }

            console.log(
                "Clinic search result:",
                data,
            );

            const results = Array.isArray(data?.clinics)
                ? (data.clinics as Clinic[])
                : [];

            const resultsWithPrices = await addPricesToClinics(
                results,
                selectedTreatment,
            );

            console.log(
                "Clinics with prices:",
                resultsWithPrices,
            );

            setClinics(resultsWithPrices);
        } catch (error) {
            console.error(
                "Clinic search failed:",
                error,
            );

            setClinicError(
                "Noe gikk galt under klinikksøket.",
            );
        } finally {
            setLoadingClinics(false);
        }
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
                                Finn tannklinikker basert på beliggenhet og
                                vurderinger. Informasjon om priser, behandlinger
                                og offentlige tilbud legges til etter hvert som
                                informasjonen verifiseres.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="mt-8 max-w-4xl rounded-[24px] border border-[#dfe8ee] bg-white p-3 shadow-xl shadow-[#10233f]/5">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <div className="relative flex-1">
                                    <MapPin
                                        size={19}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#14b8c4]"
                                    />

                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(event) => {
                                            setLocation(
                                                event.target.value,
                                            );
                                            setCoordinates(null);
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key ===
                                                    "Enter"
                                            ) {
                                                void searchClinics();
                                            }
                                        }}
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
                                    onClick={searchClinics}
                                    disabled={loadingClinics}
                                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#14c8d4] px-7 text-sm font-black text-white shadow-lg shadow-[#14c8d4]/20 transition hover:bg-[#0fb3be] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Search size={17} />

                                    {loadingClinics ? "Søker..." : "Søk"}
                                </button>
                            </div>

                            <div className="mt-3">
                                <label
                                    htmlFor="treatment"
                                    className="mb-2 block text-sm font-bold text-[#536e83]"
                                >
                                    Behandling
                                </label>

                                <select
                                    id="treatment"
                                    value={selectedTreatment}
                                    onChange={async (event) => {
                                        const newTreatment = event.target.value;

                                        setSelectedTreatment(newTreatment);

                                        if (clinics.length === 0) {
                                            return;
                                        }

                                        setLoadingClinics(true);

                                        try {
                                            const clinicsWithNewPrices =
                                                await addPricesToClinics(
                                                    clinics,
                                                    newTreatment,
                                                );

                                            setClinics(clinicsWithNewPrices);
                                        } catch (error) {
                                            console.error(
                                                "Treatment price update failed:",
                                                error,
                                            );
                                        } finally {
                                            setLoadingClinics(false);
                                        }
                                    }}
                                    className="h-12 w-full rounded-2xl border border-[#dce7ed] bg-white px-4 text-sm font-semibold text-[#10233f] outline-none focus:ring-2 focus:ring-[#14b8c4]/20"
                                >
                                    <option value="checkup">
                                        Undersøkelse
                                    </option>

                                    <option value="emergency">
                                        Akutt konsultasjon
                                    </option>

                                    <option value="root_canal">
                                        Rotfylling
                                    </option>

                                    <option value="cosmetic">
                                        Tannbleking
                                    </option>
                                    <option value="crown">
                                        Tannkrone
                                    </option>
                                </select>
                            </div>
                        </div>

                        {locationError && (
                            <p className="mt-3 text-sm font-semibold text-red-500">
                                {locationError}
                            </p>
                        )}

                        {clinicError && (
                            <p className="mt-3 text-sm font-semibold text-red-500">
                                {clinicError}
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
                <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
                    {hasSearched &&
                        !loadingClinics &&
                        clinics.length === 0 &&
                        !clinicError && (
                        <div className="rounded-3xl border border-[#dfe8ee] bg-white p-8 text-center">
                            <Building2
                                size={32}
                                className="mx-auto text-[#9aabb9]"
                            />

                            <p className="mt-3 font-bold text-[#10233f]">
                                Ingen klinikker funnet
                            </p>
                        </div>
                    )}

                    {clinics.length > 0 && (
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {clinics.map((clinic) => (
                                <article
                                    key={clinic.id}
                                    className="rounded-[24px] border border-[#dfe8ee] bg-white p-6 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-black text-[#10233f]">
                                                {clinic.name}
                                            </h2>

                                            <div className="mt-2 flex items-start gap-2 text-sm text-[#72889a]">
                                                <MapPin
                                                    size={16}
                                                    className="mt-0.5 shrink-0 text-[#14b8c4]"
                                                />

                                                <span>
                                                    {clinic.address}
                                                </span>
                                            </div>
                                        </div>

                                        {clinic.isVerified && (
                                            <div
                                                title="Verifisert"
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf9fb]"
                                            >
                                                <ShieldCheck
                                                    size={18}
                                                    className="text-[#14b8c4]"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {clinic.rating !== null && (
                                        <div className="mt-4 flex items-center gap-2 text-sm">
                                            <Star
                                                size={16}
                                                className="fill-current text-amber-400"
                                            />

                                            <span className="font-black text-[#10233f]">
                                                {clinic.rating}
                                            </span>

                                            <span className="text-[#8ba0af]">
                                                (
                                                {clinic.reviewCount}
                                                )
                                            </span>
                                        </div>
                                    )}

                                    {clinic.prices &&
                                        clinic.prices.length >
                                            0 &&
                                        (
                                            <div className="mt-5 rounded-2xl bg-[#f4f8fb] p-4">
                                                {clinic.prices.map(
                                                    (
                                                        price,
                                                        index,
                                                    ) => (
                                                        <div
                                                            key={`${clinic.id}-${price.treatment}-${index}`}
                                                        >
                                                            <p className="text-xs font-bold uppercase tracking-wide text-[#7b91a3]">
                                                                {price
                                                                    .treatment}
                                                            </p>

                                                            <p className="mt-1 text-lg font-black text-[#10233f]">
                                                                {price
                                                                                .priceFrom !==
                                                                            undefined &&
                                                                        price
                                                                                .priceTo !==
                                                                            undefined &&
                                                                        price
                                                                                .priceFrom !==
                                                                            price
                                                                                .priceTo
                                                                    ? `${
                                                                        price
                                                                            .priceFrom
                                                                            .toLocaleString(
                                                                                "nb-NO",
                                                                            )
                                                                    }–${
                                                                        price
                                                                            .priceTo
                                                                            .toLocaleString(
                                                                                "nb-NO",
                                                                            )
                                                                    } kr`
                                                                    : `${
                                                                        (
                                                                            price
                                                                                .priceFrom ??
                                                                                price
                                                                                    .priceTo
                                                                        )?.toLocaleString(
                                                                            "nb-NO",
                                                                        )
                                                                    } kr`}
                                                            </p>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}

                                    {clinic.googleMapsUrl && (
                                        <a
                                            href={clinic.googleMapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-[#dce7ed] px-4 py-3 text-sm font-black text-[#536e83] transition hover:bg-[#f5f9fb]"
                                        >
                                            Se i Google Maps
                                        </a>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
