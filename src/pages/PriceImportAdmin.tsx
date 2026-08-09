import { useMemo, useState } from "react";
import {
    AlertTriangle,
    Check,
    ExternalLink,
    RefreshCw,
    ShieldCheck,
    Sparkles,
} from "lucide-react";

const SUPABASE_FUNCTIONS_URL =
    "https://vdfmhhpopcnkszaxkvwf.supabase.co/functions/v1";

const TREATMENTS = [
    { code: "examination", name: "Undersøkelse" },
    { code: "emergency_consultation", name: "Akuttkonsultasjon" },
    { code: "root_canal", name: "Rotfylling" },
    { code: "crown", name: "Krone" },
    { code: "teeth_whitening", name: "Tannbleking" },
    { code: "filling", name: "Fylling" },
    { code: "dental_cleaning", name: "Tannrens" },
    { code: "tooth_extraction", name: "Tanntrekking" },
    { code: "wisdom_tooth", name: "Visdomstann" },
    { code: "implant", name: "Implantat" },
] as const;

const ALLOWED_TREATMENT_CODES = new Set<string>(
    TREATMENTS.map((treatment) => treatment.code),
);

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

interface CandidateSafety {
    safe: boolean;
    reasons: string[];
}

function normalizeDigits(value: string) {
    return value.replace(/[^0-9]/g, "");
}

function sourceContainsPrice(sourceText: string, price: number) {
    const sourceDigits = normalizeDigits(sourceText);
    const priceDigits = String(Math.round(price));

    return sourceDigits.includes(priceDigits);
}

function getCandidateSafety(candidate: PriceCandidate): CandidateSafety {
    const reasons: string[] = [];
    const sourceText = candidate.sourceText.trim();
    const sourceLower = sourceText.toLowerCase();

    if (!ALLOWED_TREATMENT_CODES.has(candidate.treatmentCode)) {
        reasons.push("Ukjent behandlingskode");
    }

    if (!sourceText) {
        reasons.push("Mangler kildetekst");
    }

    if (candidate.priceFrom === null && candidate.priceTo === null) {
        reasons.push("Mangler pris");
    }

    for (
        const [label, price] of [
            ["fra-pris", candidate.priceFrom],
            ["til-pris", candidate.priceTo],
        ] as const
    ) {
        if (price === null) {
            continue;
        }

        if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price)) {
            reasons.push(`${label} er ugyldig`);
            continue;
        }

        if (sourceText && !sourceContainsPrice(sourceText, price)) {
            reasons.push(`${label} finnes ikke tydelig i kildeteksten`);
        }
    }

    if (
        candidate.priceFrom !== null &&
        candidate.priceTo !== null &&
        candidate.priceTo < candidate.priceFrom
    ) {
        reasons.push("Til-pris er lavere enn fra-pris");
    }

    // Conservative treatment-specific guards for cases the extractor is
    // explicitly instructed not to publish without human review.
    if (
        candidate.treatmentCode === "crown" &&
        /implantat\s*krone|implantatkrone/.test(sourceLower)
    ) {
        reasons.push("Kan være implantatkrone, ikke vanlig krone");
    }

    if (
        candidate.treatmentCode === "filling" &&
        /midlertidig|tempor[aæ]r/.test(sourceLower)
    ) {
        reasons.push("Kan være midlertidig fylling");
    }

    if (
        ["examination", "dental_cleaning", "teeth_whitening"].includes(
            candidate.treatmentCode,
        ) &&
        /pakke|package|inkl\.?|inkludert|\+/.test(sourceLower)
    ) {
        reasons.push("Kan være pakkepris");
    }

    return {
        safe: reasons.length === 0,
        reasons,
    };
}

function getMissingTreatments(candidates: PriceCandidate[]) {
    const presentCodes = new Set(
        candidates
            .filter(
                (candidate) =>
                    candidate.priceFrom !== null || candidate.priceTo !== null,
            )
            .map((candidate) => candidate.treatmentCode),
    );

    return TREATMENTS.filter(
        (treatment) => !presentCodes.has(treatment.code),
    );
}

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Ukjent tidspunkt";
    }

    return new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function PriceImportAdmin() {
    const [adminKey, setAdminKey] = useState("");
    const [imports, setImports] = useState<PriceImport[]>([]);
    const [editedCandidates, setEditedCandidates] = useState<
        Record<string, EditableCandidate[]>
    >({});
    const [loadingImportId, setLoadingImportId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const summary = useMemo(() => {
        let safeImports = 0;
        let safeRows = 0;
        let reviewRows = 0;
        const coveredCodes = new Set<string>();

        for (const priceImport of imports) {
            const candidates = editedCandidates[priceImport.id] ?? [];
            const safety = candidates.map(getCandidateSafety);

            if (candidates.length > 0 && safety.every((item) => item.safe)) {
                safeImports += 1;
            }

            safety.forEach((item, index) => {
                if (item.safe) {
                    safeRows += 1;
                } else {
                    reviewRows += 1;
                }

                const candidate = candidates[index];
                if (
                    candidate &&
                    (candidate.priceFrom !== null || candidate.priceTo !== null)
                ) {
                    coveredCodes.add(candidate.treatmentCode);
                }
            });
        }

        return {
            safeImports,
            safeRows,
            reviewRows,
            coverage: coveredCodes.size,
        };
    }, [editedCandidates, imports]);

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
                `${SUPABASE_FUNCTIONS_URL}/list-clinic-price-imports`,
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
                    setError(result?.error ?? "Kunne ikke hente prisimporter.");
                }

                setAuthenticated(false);
                return;
            }

            const loadedImports = Array.isArray(result?.imports)
                ? (result.imports as PriceImport[])
                : [];

            setImports(loadedImports);
            setAuthenticated(true);

            const candidateState: Record<string, EditableCandidate[]> = {};

            for (const priceImport of loadedImports) {
                candidateState[priceImport.id] = priceImport.candidates.map(
                    (candidate) => ({
                        ...candidate,
                        selected: true,
                    }),
                );
            }

            setEditedCandidates(candidateState);
        } catch (caughtError) {
            console.error("Could not load price imports:", caughtError);
            setError("Kunne ikke hente prisimporter.");
            setAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }

    function toggleCandidate(importId: string, index: number) {
        setEditedCandidates((current) => ({
            ...current,
            [importId]: (current[importId] ?? []).map(
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
            [importId]: (current[importId] ?? []).map(
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

    function selectSafeCandidates(importId: string) {
        setEditedCandidates((current) => ({
            ...current,
            [importId]: (current[importId] ?? []).map((candidate) => ({
                ...candidate,
                selected: getCandidateSafety(candidate).safe,
            })),
        }));
    }

    function selectAllCandidates(importId: string) {
        setEditedCandidates((current) => ({
            ...current,
            [importId]: (current[importId] ?? []).map((candidate) => ({
                ...candidate,
                selected: true,
            })),
        }));
    }

    async function approveImport(
        importId: string,
        options?: { safeOnly?: boolean },
    ) {
        const candidates = editedCandidates[importId] ?? [];
        const sourceCandidates = options?.safeOnly
            ? candidates.filter((candidate) =>
                getCandidateSafety(candidate).safe
            )
            : candidates.filter((candidate) => candidate.selected);

        if (options?.safeOnly) {
            const allSafe = candidates.length > 0 &&
                candidates.every((candidate) =>
                    getCandidateSafety(candidate).safe
                );

            if (!allSafe) {
                setError(
                    "Auto-godkjenning stoppet: hele importen må være trygg. Blandede importer må gjennomgås manuelt slik at ingen kandidater forsvinner når importen lukkes.",
                );
                return;
            }
        }

        const selectedCandidates = sourceCandidates.map((candidate) => ({
            treatmentCode: candidate.treatmentCode,
            priceFrom: candidate.priceFrom,
            priceTo: candidate.priceTo,
        }));

        if (selectedCandidates.length === 0) {
            setError("Velg minst én pris som skal publiseres.");
            return;
        }

        setLoadingImportId(importId);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                `${SUPABASE_FUNCTIONS_URL}/approve-clinic-price-import`,
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
                    throw new Error("Feil adminnøkkel.");
                }

                throw new Error(
                    result?.error ?? "Kunne ikke godkjenne prisene.",
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
        } catch (caughtError) {
            console.error("Approve price import failed:", caughtError);
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Kunne ikke godkjenne prisene.",
            );
        } finally {
            setLoadingImportId(null);
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
                        onChange={(event) => setAdminKey(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
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
                            Dekk behandlinger, auto-godkjenn bare sikre importer
                            og gjennomgå resten manuelt.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void loadImports()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#dce7ed] bg-white px-4 py-2 text-sm font-bold text-[#536e83] disabled:opacity-60"
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? "animate-spin" : ""}
                        />
                        Oppdater
                    </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-[#dfe8ee] bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                            Ventende importer
                        </p>
                        <p className="mt-1 text-2xl font-black text-[#10233f]">
                            {imports.length}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[#dfe8ee] bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                            Klar for auto
                        </p>
                        <p className="mt-1 text-2xl font-black text-emerald-700">
                            {summary.safeImports}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[#dfe8ee] bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                            Krever kontroll
                        </p>
                        <p className="mt-1 text-2xl font-black text-amber-700">
                            {summary.reviewRows}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[#dfe8ee] bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                            Behandlingsdekning
                        </p>
                        <p className="mt-1 text-2xl font-black text-[#10233f]">
                            {summary.coverage}/{TREATMENTS.length}
                        </p>
                    </div>
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
                    {imports.length === 0 && (
                        <div className="rounded-3xl border border-[#dfe8ee] bg-white p-8">
                            <p className="font-bold text-[#10233f]">
                                Ingen ventende prisimporter.
                            </p>
                        </div>
                    )}

                    {imports.map((priceImport) => {
                        const candidates = editedCandidates[priceImport.id] ??
                            [];
                        const selectedCount = candidates.filter(
                            (candidate) => candidate.selected,
                        ).length;
                        const safetyByIndex = candidates.map(
                            getCandidateSafety,
                        );
                        const safeCount = safetyByIndex.filter(
                            (safety) => safety.safe,
                        ).length;
                        const allSafe = candidates.length > 0 &&
                            safetyByIndex.every((safety) => safety.safe);
                        const missingTreatments = getMissingTreatments(
                            candidates,
                        );
                        const isPublishing = loadingImportId === priceImport.id;

                        return (
                            <article
                                key={priceImport.id}
                                className="overflow-hidden rounded-3xl border border-[#dfe8ee] bg-white shadow-sm"
                            >
                                <div className="border-b border-[#e8eff3] p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-xl font-black text-[#10233f]">
                                                    {priceImport.clinic_name}
                                                </h2>
                                                {allSafe
                                                    ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                                            <ShieldCheck
                                                                size={13}
                                                            />
                                                            Klar for auto
                                                        </span>
                                                    )
                                                    : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                                                            <AlertTriangle
                                                                size={13}
                                                            />
                                                            Manuell kontroll
                                                        </span>
                                                    )}
                                            </div>

                                            <p className="mt-1 text-sm text-[#7a8fa1]">
                                                {selectedCount} av{" "}
                                                {candidates.length} valgt ·{" "}
                                                {safeCount} sikre · Importert
                                                {" "}
                                                {formatDate(
                                                    priceImport.created_at,
                                                )}
                                            </p>
                                        </div>

                                        <a
                                            href={priceImport.source_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl border border-[#dce7ed] px-4 py-2 text-sm font-bold text-[#536e83] transition hover:bg-[#f5f9fb]"
                                        >
                                            <ExternalLink size={15} />
                                            Åpne priskilde
                                        </a>
                                    </div>

                                    <div className="mt-5 rounded-2xl bg-[#f6f9fb] p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-[#10233f]">
                                                    Manglende behandlinger
                                                </p>
                                                <p className="mt-1 text-xs text-[#7a8fa1]">
                                                    Viser hvilke behandlinger
                                                    denne importen ikke dekker.
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#536e83]">
                                                {TREATMENTS.length -
                                                    missingTreatments
                                                        .length}/{TREATMENTS
                                                    .length} dekket
                                            </span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {missingTreatments.length === 0
                                                ? (
                                                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                                        Full dekning
                                                    </span>
                                                )
                                                : (
                                                    missingTreatments.map((
                                                        treatment,
                                                    ) => (
                                                        <span
                                                            key={treatment.code}
                                                            className="rounded-full border border-[#dfe8ee] bg-white px-3 py-1.5 text-xs font-bold text-[#647d90]"
                                                            title={treatment
                                                                .code}
                                                        >
                                                            {treatment.name}
                                                        </span>
                                                    ))
                                                )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 p-6">
                                    {candidates.map((candidate, index) => {
                                        const safety = safetyByIndex[index];

                                        return (
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
                                                        aria-label={candidate
                                                                .selected
                                                            ? "Fjern pris"
                                                            : "Velg pris"}
                                                    >
                                                        {candidate.selected && (
                                                            <Check size={15} />
                                                        )}
                                                    </button>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="font-black text-[#10233f]">
                                                                        {candidate
                                                                            .treatmentName}
                                                                    </p>
                                                                    {safety.safe
                                                                        ? (
                                                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                                                                                Sikker
                                                                            </span>
                                                                        )
                                                                        : (
                                                                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
                                                                                Kontroller
                                                                            </span>
                                                                        )}
                                                                </div>
                                                                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#8ca0af]">
                                                                    {candidate
                                                                        .treatmentCode}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
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
                                                                    min="0"
                                                                    step="1"
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
                                                                .sourceText ||
                                                                "Ingen kildetekst."}
                                                        </p>

                                                        {!safety.safe && (
                                                            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                                                {safety.reasons
                                                                    .join(
                                                                        " · ",
                                                                    )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8eff3] bg-[#fbfcfd] p-5">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                selectSafeCandidates(
                                                    priceImport.id,
                                                )}
                                            disabled={isPublishing}
                                            className="rounded-xl border border-[#dce7ed] bg-white px-4 py-2.5 text-sm font-bold text-[#536e83] disabled:opacity-60"
                                        >
                                            Velg bare sikre
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                selectAllCandidates(
                                                    priceImport.id,
                                                )}
                                            disabled={isPublishing}
                                            className="rounded-xl border border-[#dce7ed] bg-white px-4 py-2.5 text-sm font-bold text-[#536e83] disabled:opacity-60"
                                        >
                                            Velg alle
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void approveImport(
                                                    priceImport.id,
                                                    {
                                                        safeOnly: true,
                                                    },
                                                )}
                                            disabled={!allSafe || isPublishing}
                                            title={allSafe
                                                ? "Alle kandidatene har bestått de konservative sikkerhetssjekkene."
                                                : "Auto-godkjenning krever at alle kandidatene i importen er sikre."}
                                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Sparkles size={16} />
                                            Auto-godkjenn sikre
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void approveImport(
                                                    priceImport.id,
                                                )}
                                            disabled={isPublishing ||
                                                selectedCount === 0}
                                            className="rounded-xl bg-[#14c8d4] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#14c8d4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isPublishing
                                                ? "Publiserer..."
                                                : "Godkjenn valgte"}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
