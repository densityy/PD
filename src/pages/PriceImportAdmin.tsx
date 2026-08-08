import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PriceCandidate {
    treatmentCode: string;
    treatmentName: string;
    priceFrom: number | null;
    priceTo: number | null;
    sourceText: string;
}

interface EditableCandidate extends PriceCandidate {
    selected: boolean;
}

interface PriceImport {
    id: string;
    google_place_id: string;
    clinic_name: string;
    source_url: string;
    candidates: PriceCandidate[];
    status: string;
    created_at: string;
}

export default function PriceImportAdmin() {
    const [imports, setImports] = useState<PriceImport[]>([]);
    const [editedCandidates, setEditedCandidates] = useState<
        Record<string, EditableCandidate[]>
    >({});

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        void loadImports();
    }, []);

    async function loadImports() {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
            .from("clinic_price_imports")
            .select(`
                id,
                google_place_id,
                clinic_name,
                source_url,
                candidates,
                status,
                created_at
            `)
            .eq("status", "pending")
            .order("created_at", {
                ascending: false,
            });

        if (error) {
            console.error(
                "Could not load price imports:",
                error,
            );

            setError("Kunne ikke hente prisimporter.");
            setLoading(false);
            return;
        }

        const loadedImports = (data ?? []) as PriceImport[];

        setImports(loadedImports);

        const candidateState: Record<
            string,
            EditableCandidate[]
        > = {};

        for (const priceImport of loadedImports) {
            candidateState[priceImport.id] = priceImport.candidates.map((
                candidate,
            ) => ({
                ...candidate,
                selected: true,
            }));
        }

        setEditedCandidates(candidateState);
        setLoading(false);
    }

    function toggleCandidate(
        importId: string,
        index: number,
    ) {
        setEditedCandidates((current) => ({
            ...current,

            [importId]: current[importId].map(
                (candidate, candidateIndex) =>
                    candidateIndex === index
                        ? {
                            ...candidate,
                            selected: !candidate.selected,
                        }
                        : candidate,
            ),
        }));
    }

    function updatePrice(
        importId: string,
        index: number,
        field: "priceFrom" | "priceTo",
        value: string,
    ) {
        setEditedCandidates((current) => ({
            ...current,

            [importId]: current[importId].map(
                (candidate, candidateIndex) =>
                    candidateIndex === index
                        ? {
                            ...candidate,
                            [field]: value === "" ? null : Number(value),
                        }
                        : candidate,
            ),
        }));
    }

    if (loading) {
        return (
            <div className="p-8">
                Laster prisimporter...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f8fb] p-5 sm:p-8">
            <div className="mx-auto max-w-6xl">
                <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-[#14aab5]">
                        Pocket Dentist Admin
                    </p>

                    <h1 className="mt-1 text-3xl font-black text-[#10233f]">
                        Prisimporter
                    </h1>

                    <p className="mt-2 text-[#6f8496]">
                        Kontroller AI-ekstraherte priser før de publiseres.
                    </p>
                </div>

                {error && (
                    <p className="mt-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-600">
                        {error}
                    </p>
                )}

                <div className="mt-8 space-y-8">
                    {imports.length === 0 && (
                        <div className="rounded-3xl border border-[#dfe8ee] bg-white p-8">
                            <p className="font-bold text-[#10233f]">
                                Ingen ventende prisimporter.
                            </p>
                        </div>
                    )}

                    {imports.map((priceImport) => {
                        const candidates = editedCandidates[
                            priceImport.id
                        ] ?? [];

                        return (
                            <article
                                key={priceImport.id}
                                className="overflow-hidden rounded-3xl border border-[#dfe8ee] bg-white shadow-sm"
                            >
                                <div className="border-b border-[#e8eff3] p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-black text-[#10233f]">
                                                {priceImport.clinic_name}
                                            </h2>

                                            <p className="mt-1 text-sm text-[#7a8fa1]">
                                                {candidates.filter(
                                                    (
                                                        candidate,
                                                    ) => candidate.selected,
                                                ).length} av {candidates.length}
                                                {" "}
                                                valgt
                                            </p>
                                        </div>

                                        <a
                                            href={priceImport.source_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl border border-[#dce7ed] px-4 py-2 text-sm font-bold text-[#536e83] transition hover:bg-[#f5f9fb]"
                                        >
                                            <ExternalLink
                                                size={15}
                                            />
                                            Åpne priskilde
                                        </a>
                                    </div>
                                </div>

                                <div className="space-y-3 p-6">
                                    {candidates.map(
                                        (
                                            candidate,
                                            index,
                                        ) => (
                                            <div
                                                key={`${candidate.treatmentCode}-${index}`}
                                                className={`rounded-2xl border p-4 transition ${
                                                    candidate.selected
                                                        ? "border-[#bfe9ec] bg-[#f7fcfc]"
                                                        : "border-[#e3e9ed] bg-[#f7f8f9] opacity-60"
                                                }`}
                                            >
                                                <div className="flex gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleCandidate(
                                                                priceImport.id,
                                                                index,
                                                            )}
                                                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                                                            candidate.selected
                                                                ? "border-[#14c8d4] bg-[#14c8d4] text-white"
                                                                : "border-[#cbd8df] bg-white"
                                                        }`}
                                                    >
                                                        {candidate.selected && (
                                                            <Check
                                                                size={15}
                                                            />
                                                        )}
                                                    </button>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-black text-[#10233f]">
                                                                    {candidate
                                                                        .treatmentName}
                                                                </p>

                                                                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                                                                    {candidate
                                                                        .treatmentCode}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    value={candidate
                                                                        .priceFrom ??
                                                                        ""}
                                                                    onChange={(
                                                                        event,
                                                                    ) => updatePrice(
                                                                        priceImport
                                                                            .id,
                                                                        index,
                                                                        "priceFrom",
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )}
                                                                    className="h-10 w-28 rounded-xl border border-[#dce7ed] bg-white px-3 text-sm font-bold text-[#10233f] outline-none focus:ring-2 focus:ring-[#14b8c4]/20"
                                                                    placeholder="Fra"
                                                                />

                                                                <span className="text-[#8ca0af]">
                                                                    –
                                                                </span>

                                                                <input
                                                                    type="number"
                                                                    value={candidate
                                                                        .priceTo ??
                                                                        ""}
                                                                    onChange={(
                                                                        event,
                                                                    ) => updatePrice(
                                                                        priceImport
                                                                            .id,
                                                                        index,
                                                                        "priceTo",
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )}
                                                                    className="h-10 w-28 rounded-xl border border-[#dce7ed] bg-white px-3 text-sm font-bold text-[#10233f] outline-none focus:ring-2 focus:ring-[#14b8c4]/20"
                                                                    placeholder="Til"
                                                                />

                                                                <span className="font-bold text-[#536e83]">
                                                                    kr
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <p className="mt-3 text-sm leading-6 text-[#6f8496]">
                                                            {candidate
                                                                .sourceText}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 border-t border-[#e8eff3] bg-[#fbfcfd] p-5">
                                    <button
                                        type="button"
                                        className="rounded-xl border border-[#dce7ed] px-5 py-3 text-sm font-bold text-[#647d90]"
                                    >
                                        Avvis import
                                    </button>

                                    <button
                                        type="button"
                                        className="rounded-xl bg-[#14c8d4] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#14c8d4]/20"
                                    >
                                        Godkjenn valgte
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
