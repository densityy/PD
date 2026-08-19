import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import type { Pia3DState } from "@/components/Pia3D";

interface Pia2DProps {
    state?: Pia3DState;
    className?: string;
    speechText?: string;
}

interface AvatarLayer {
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface AvatarManifest {
    width: number;
    height: number;
    layers: Record<string, AvatarLayer>;
}

type PortraitStyle = CSSProperties & {
    "--pia-look-x": string;
    "--pia-look-y": string;
};

const VISEMES = [
    "Mouth Viseme - MBP",
    "Mouth Viseme - Transition",
    "Mouth Viseme - A",
    "Mouth Viseme - E",
    "Mouth Viseme - OU",
    "Mouth Viseme - FV",
] as const;

const BODY = ["Body - Lower", "Uniform - Torso", "Neck", "Tooth Badge"];
const LEFT_ARM = ["Arm L - Upper and Forearm", "Hand L - Fingers"];
const RIGHT_ARM = ["Arm R - Upper and Forearm", "Hand R - Fingers"];
const FACE = ["Face Base", "Brow L", "Brow R"];
const EYES = ["Eye L", "Eye R"];
const HAIR = ["Hair - Front", "Hair - Loose Strand L", "Hair - Loose Strand R"];

function characterToViseme(character: string) {
    const value = character.toLocaleLowerCase("nb-NO");
    if (/[mbp]/.test(value)) return 0;
    if (/[fv]/.test(value)) return 5;
    if (/[ouå]/.test(value)) return 4;
    if (/[aæ]/.test(value)) return 2;
    if (/[eiyø]/.test(value)) return 3;
    if (/\s|[.,!?;:]/.test(value)) return 0;
    return 1;
}

function Layer({
    manifest,
    name,
    className = "",
    visible = true,
}: {
    manifest: AvatarManifest;
    name: string;
    className?: string;
    visible?: boolean;
}) {
    const layer = manifest.layers[name];
    if (!layer) return null;

    return (
        <img
            src={layer.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`pia-layer ${className}`}
            style={{
                left: `${layer.x / manifest.width * 100}%`,
                top: `${layer.y / manifest.height * 100}%`,
                width: `${layer.width / manifest.width * 100}%`,
                height: `${layer.height / manifest.height * 100}%`,
                opacity: visible ? 1 : 0,
            }}
        />
    );
}

export default function Pia2D({
    state = "idle",
    className = "",
    speechText = "",
}: Pia2DProps) {
    const [manifest, setManifest] = useState<AvatarManifest | null>(null);
    const [blinking, setBlinking] = useState(false);
    const [viseme, setViseme] = useState(0);
    const portraitRef = useRef<HTMLDivElement>(null);

    const speechSequence = useMemo(() => {
        const characters = Array.from(speechText.trim());
        return characters.length > 0
            ? characters.map(characterToViseme)
            : [1, 2, 1, 3, 0, 4, 1, 5];
    }, [speechText]);

    useEffect(() => {
        let active = true;
        void fetch("/pia-avatar/manifest.json")
            .then((response) => {
                if (!response.ok) throw new Error(`Avatar manifest failed: ${response.status}`);
                return response.json() as Promise<AvatarManifest>;
            })
            .then((value) => {
                if (active) setManifest(value);
            })
            .catch((error: unknown) => {
                console.error("Pia avatar failed to load", error);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timer = 0;
        const scheduleBlink = () => {
            timer = window.setTimeout(() => {
                if (cancelled) return;
                setBlinking(true);
                window.setTimeout(() => {
                    if (!cancelled) {
                        setBlinking(false);
                        scheduleBlink();
                    }
                }, 135);
            }, 2600 + Math.random() * 2800);
        };
        scheduleBlink();
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (state !== "speaking") {
            setViseme(0);
            return;
        }

        let index = 0;
        setViseme(speechSequence[0] ?? 1);
        const timer = window.setInterval(() => {
            index = (index + 1) % speechSequence.length;
            setViseme(speechSequence[index] ?? 1);
        }, 92);
        return () => window.clearInterval(timer);
    }, [speechSequence, state]);

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 1.35;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.8;
        portraitRef.current?.style.setProperty("--pia-look-x", x.toFixed(3));
        portraitRef.current?.style.setProperty("--pia-look-y", y.toFixed(3));
    };

    const resetLook = () => {
        portraitRef.current?.style.setProperty("--pia-look-x", "0");
        portraitRef.current?.style.setProperty("--pia-look-y", "0");
    };

    const portraitStyle: PortraitStyle = {
        "--pia-look-x": "0",
        "--pia-look-y": "0",
    };

    return (
        <div
            ref={portraitRef}
            className={`pia-portrait relative h-full w-full overflow-hidden ${className}`}
            data-state={state}
            style={portraitStyle}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetLook}
        >
            <div className="pia-ambient" aria-hidden="true" />
            {manifest ? (
                <div className="pia-stage" role="img" aria-label="Pia, Pocket Dentist sin digitale tannlegeresepsjonist">
                    <div className="pia-body">
                        {BODY.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                    </div>
                    <div className="pia-arm pia-arm-left">
                        {LEFT_ARM.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                    </div>
                    <div className="pia-arm pia-arm-right">
                        {RIGHT_ARM.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                    </div>
                    <div className="pia-head">
                        {FACE.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                        <div className={`pia-eye-group ${blinking ? "is-blinking" : ""}`}>
                            {EYES.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                        </div>
                        <div className="pia-mouth-group">
                            {VISEMES.map((name, index) => (
                                <Layer key={name} manifest={manifest} name={name} className="pia-viseme" visible={index === viseme} />
                            ))}
                        </div>
                        <div className="pia-hair-front">
                            {HAIR.map((name) => <Layer key={name} manifest={manifest} name={name} />)}
                        </div>
                    </div>
                </div>
            ) : (
                <img className="pia-fallback" src="/pia-2d/pia-neutral.png" alt="Pia, Pocket Dentist sin digitale tannlegeresepsjonist" />
            )}

            <style>{`
                .pia-portrait {
                    touch-action: pan-y;
                    isolation: isolate;
                    background: radial-gradient(circle at 50% 36%, rgba(255,255,255,.96) 0 18%, rgba(213,241,255,.9) 46%, rgba(165,218,248,.88) 100%);
                }
                .pia-ambient { position:absolute; inset:0; background: radial-gradient(circle at 50% 35%, rgba(255,255,255,.72), transparent 35%), linear-gradient(115deg, transparent 35%, rgba(255,255,255,.24) 50%, transparent 65%); animation: pia-glow 7s ease-in-out infinite; }
                .pia-stage { position:absolute; left:50%; bottom:0; width:auto; height:96%; aspect-ratio:941/1672; transform:translateX(-50%) scale(1.02); transform-origin:50% 88%; animation:pia-breathe 4.8s ease-in-out infinite; will-change:transform; }
                .pia-layer { position:absolute; display:block; max-width:none; user-select:none; pointer-events:none; transition:opacity 58ms linear; }
                .pia-fallback { width:100%; height:100%; object-fit:cover; object-position:center; }
                .pia-body, .pia-arm, .pia-head, .pia-eye-group, .pia-mouth-group, .pia-hair-front { position:absolute; inset:0; transform-origin:50% 50%; will-change:transform; }
                .pia-head { transform-origin:50% 36%; transform:translate(calc(var(--pia-look-x) * .35%), calc(var(--pia-look-y) * .22%)) rotate(calc(var(--pia-look-x) * .18deg)); transition:transform 420ms cubic-bezier(.2,.8,.2,1); }
                .pia-eye-group { transform-origin:50% 21.5%; transform:translate(calc(var(--pia-look-x) * .12%), calc(var(--pia-look-y) * .08%)) scaleY(1); transition:transform 90ms ease; }
                .pia-eye-group.is-blinking { transform:translate(calc(var(--pia-look-x) * .12%), calc(var(--pia-look-y) * .08%)) scaleY(.08); }
                .pia-hair-front { transform-origin:50% 24%; animation:pia-hair 3.7s ease-in-out infinite; }
                .pia-arm-left { transform-origin:25% 51%; animation:pia-arm-left 5.6s ease-in-out infinite; }
                .pia-arm-right { transform-origin:75% 51%; animation:pia-arm-right 5.1s ease-in-out infinite; }
                .pia-viseme { transition:opacity 62ms ease-out; }
                .pia-portrait[data-state="speaking"] .pia-stage { animation:pia-speaking 2.1s ease-in-out infinite; }
                .pia-portrait[data-state="speaking"] .pia-hair-front { animation-duration:2.5s; }
                .pia-portrait[data-state="listening"] .pia-head { animation:pia-listen 3.4s ease-in-out infinite; }
                .pia-portrait[data-state="thinking"] .pia-head { animation:pia-think 3.8s ease-in-out infinite; }
                .pia-portrait[data-state="paused"] .pia-stage, .pia-portrait[data-state="error"] .pia-stage { animation-play-state:paused; }
                @keyframes pia-glow { 0%,100%{opacity:.72} 50%{opacity:1} }
                @keyframes pia-breathe { 0%,100%{transform:translateX(-50%) scale(1.02)} 50%{transform:translateX(-50%) translateY(-.35%) scale(1.029)} }
                @keyframes pia-speaking { 0%,100%{transform:translateX(-50%) scale(1.02) rotate(0)} 35%{transform:translateX(-50%) translateY(-.35%) scale(1.029) rotate(-.12deg)} 72%{transform:translateX(-50%) translateY(-.12%) scale(1.024) rotate(.1deg)} }
                @keyframes pia-hair { 0%,100%{transform:rotate(-.15deg) translateX(-.08%)} 50%{transform:rotate(.28deg) translateX(.12%)} }
                @keyframes pia-arm-left { 0%,100%{transform:rotate(.12deg)} 50%{transform:rotate(-.38deg) translateY(-.08%)} }
                @keyframes pia-arm-right { 0%,100%{transform:rotate(-.1deg)} 50%{transform:rotate(.34deg) translateY(-.06%)} }
                @keyframes pia-listen { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-.45deg) translateY(-.15%)} }
                @keyframes pia-think { 0%,100%{transform:rotate(0)} 50%{transform:rotate(.5deg) translate(.2%,-.12%)} }
                @media (max-width:640px) { .pia-stage { height:94%; } }
                @media (prefers-reduced-motion:reduce) { .pia-stage,.pia-head,.pia-hair-front,.pia-arm { animation:none!important; } .pia-layer,.pia-head { transition:none!important; } }
            `}</style>
        </div>
    );
}
