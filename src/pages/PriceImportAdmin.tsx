import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";

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
    const [adminKey, setAdminKey] = useState("");

    const [imports, setImports] = useState<
        PriceImport[]
    >([]);

    const [
        editedCandidates,
        setEditedCandidates,
    ] = useState<
        Record<string, EditableCandidate[]>
    >({});

    const [loading, setLoading] = useState(false);

    const [
        authenticated,
        setAuthenticated,
    ] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function loadImports() {
        if (!adminKey.trim()) {
            setError("Skriv inn adminnøkkelen.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                "https://vdfmhhpopcnkszaxkvwf.supabase.co/functions/v1/list-clinic-price-imports",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",

                        "x-admin-key": adminKey.trim(),
                    },
                },
            );

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    setError("Feil adminnøkkel.");
                } else {
                    setError(
                        result?.error ??
                            "Kunne ikke hente prisimporter.",
                    );
                }

                setAuthenticated(false);
                return;
            }

            const loadedImports = Array.isArray(result?.imports)
                ? (result.imports as PriceImport[])
                : [];

            setImports(loadedImports);
            setAuthenticated(true);

            const candidateState: Record<
                string,
                EditableCandidate[]
            > = {};

            for (const priceImport of loadedImports) {
                candidateState[priceImport.id] = priceImport.candidates.map(
                    (candidate) => ({
                        ...candidate,
                        selected: true,
                    }),
                );
            }

            setEditedCandidates(
                candidateState,
            );
        } catch (error) {
            console.error(
                "Could not load price imports:",
                error,
            );

            setError(
                "Kunne ikke hente prisimporter.",
            );

            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }

    function toggleCandidate(
        importId: string,
        index: number,
    ) {
        setEditedCandidates((current) => ({
            ...current,

            [importId]: current[importId].map(
                (
                    candidate,
                    candidateIndex,
                ) => candidateIndex === index
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
                (
                    candidate,
                    candidateIndex,
                ) => candidateIndex === index
                    ? {
                        ...candidate,
                        [field]: value === "" ? null : Number(
                            value,
                        ),
                    }
                    : candidate,
            ),
        }));
    }

    async function approveImport(
        importId: string,
    ) {
        const candidates = editedCandidates[importId] ?? [];

        const selectedCandidates = candidates
            .filter(
                (candidate) => candidate.selected,
            )
            .map((candidate) => ({
                treatmentCode: candidate.treatmentCode,

                priceFrom: candidate.priceFrom,

                priceTo: candidate.priceTo,
            }));

        if (
            selectedCandidates.length === 0
        ) {
            setError(
                "Velg minst én pris som skal publiseres.",
            );
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                "https://vdfmhhpopcnkszaxkvwf.supabase.co/functions/v1/approve-clinic-price-import",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",

                        "x-admin-key": adminKey.trim(),
                    },

                    body: JSON.stringify({
                        importId,
                        candidates: selectedCandidates,
                    }),
                },
            );

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error(
                        "Feil adminnøkkel.",
                    );
                }

                throw new Error(
                    result?.error ??
                        "Kunne ikke godkjenne prisene.",
                );
            }

            setSuccess(
                `${
                    result.publishedCount ?? selectedCandidates.length
                } priser ble publisert for ${
                    result.clinicName ?? "klinikken"
                }.`,
            );

            await loadImports();
        } catch (error) {
            console.error(
                "Approve price import failed:",
                error,
            );

            setError(
                error instanceof Error
                    ? error.message
                    : "Kunne ikke godkjenne prisene.",
            );
        } finally {
            setLoading(false);
        }
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#f4f8fb] p-6 sm:p-8">
                <div className="mx-auto max-w-md rounded-3xl border border-[#dfe8ee] bg-white p-7 shadow-sm">
                    <p className="text-sm font-bold uppercase tracking-wider text-[#14aab5]">
                        Pocket Dentist Admin
                    </p>

                    <h1 className="mt-1 text-3xl font-black text-[#10233f]">
                        Prisadmin
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-[#6f8496]">
                        Skriv inn adminnøkkelen for å se ventende prisimporter.
                    </p>

                    <input
                        type="password"
                        value={adminKey}
                        onChange={(
                            event,
                        ) => setAdminKey(
                            event.target
                                .value,
                        )}
                        onKeyDown={(
                            event,
                        ) => {
                            if (
                                event.key ===
                                    "Enter"
                            ) {
                                void loadImports();
                            }
                        }}
                        placeholder="Adminnøkkel"
                        className="mt-6 h-12 w-full rounded-2xl border border-[#dce7ed] px-4 text-sm font-semibold text-[#10233f] outline-none focus:ring-2 focus:ring-[#14b8c4]/20"
                    />

                    {error && (
                        <p className="mt-3 text-sm font-semibold text-red-500">
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => void loadImports()}
                        disabled={loading}
                        className="mt-4 h-12 w-full rounded-2xl bg-[#14c8d4] px-5 text-sm font-black text-white disabled:opacity-60"
                    >
                        {loading ? "Laster..." : "Åpne prisadmin"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f8fb] p-5 sm:p-8">
            <div className="mx-auto max-w-6xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
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

                    <button
                        type="button"
                        onClick={() => void loadImports()}
                        disabled={loading}
                        className="rounded-xl border border-[#dce7ed] bg-white px-4 py-2 text-sm font-bold text-[#536e83] disabled:opacity-60"
                    >
                        Oppdater
                    </button>
                </div>

                {error && (
                    <p className="mt-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-600">
                        {error}
                    </p>
                )}

                {success && (
                    <p className="mt-5 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">
                        {success}
                    </p>
                )}

                <div className="mt-8 space-y-8">
                    {imports.length ===
                            0 && (
                        <div className="rounded-3xl border border-[#dfe8ee] bg-white p-8">
                            <p className="font-bold text-[#10233f]">
                                Ingen ventende prisimporter.
                            </p>
                        </div>
                    )}

                    {imports.map(
                        (priceImport) => {
                            const candidates = editedCandidates[
                                priceImport
                                    .id
                            ] ?? [];

                            const selectedCount = candidates.filter(
                                (
                                    candidate,
                                ) => candidate.selected,
                            ).length;

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
                                                    {selectedCount} av{" "}
                                                    {candidates.length} valgt
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
                                                                    priceImport
                                                                        .id,
                                                                    index,
                                                                )}
                                                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                                                                candidate
                                                                        .selected
                                                                    ? "border-[#14c8d4] bg-[#14c8d4] text-white"
                                                                    : "border-[#cbd8df] bg-white"
                                                            }`}
                                                        >
                                                            {candidate
                                                                .selected && (
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
                                            disabled
                                            title="Avvis-funksjonen kobles til neste."
                                            className="rounded-xl border border-[#dce7ed] px-5 py-3 text-sm font-bold text-[#647d90] opacity-50"
                                        >
                                            Avvis import
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void approveImport(
                                                priceImport.id,
                                            )}
                                            disabled={loading ||
                                                selectedCount ===
                                                    0}
                                            className="rounded-xl bg-[#14c8d4] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#14c8d4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {loading
                                                ? "Publiserer..."
                                                : "Godkjenn valgte"}
                                        </button>
                                    </div>
                                </article>
                            );
                        },
                    )}
                </div>
            </div>
        </div>
    );
}
