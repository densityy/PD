import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import type { Pia3DState } from "@/components/Pia3D";

interface Pia2DProps {
    state?: Pia3DState;
    className?: string;
}

const FRAME_URLS = {
    neutral: "/pia-2d/pia-neutral.png",
    speaking: "/pia-2d/pia-speaking.png",
    thinking: "/pia-2d/pia-thinking.png",
    blink: "/pia-2d/pia-blink.png",
} as const;

type PortraitStyle = CSSProperties & {
    "--pia-look-x": string;
    "--pia-look-y": string;
};

export default function Pia2D({ state = "idle", className = "" }: Pia2DProps) {
    const [blinking, setBlinking] = useState(false);
    const [speechOpen, setSpeechOpen] = useState(false);
    const blinkTimerRef = useRef<number | null>(null);
    const blinkEndTimerRef = useRef<number | null>(null);
    const portraitRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        Object.values(FRAME_URLS).forEach((src) => {
            const image = new Image();
            image.src = src;
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        const scheduleBlink = () => {
            blinkTimerRef.current = window.setTimeout(() => {
                if (cancelled) return;
                setBlinking(true);
                blinkEndTimerRef.current = window.setTimeout(() => {
                    if (!cancelled) {
                        setBlinking(false);
                        scheduleBlink();
                    }
                }, 145);
            }, 2800 + Math.random() * 2600);
        };
        scheduleBlink();

        return () => {
            cancelled = true;
            if (blinkTimerRef.current !== null) window.clearTimeout(blinkTimerRef.current);
            if (blinkEndTimerRef.current !== null) window.clearTimeout(blinkEndTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (state !== "speaking") {
            setSpeechOpen(false);
            return;
        }

        let timer = 0;
        const changeMouth = () => {
            setSpeechOpen((open) => !open);
            timer = window.setTimeout(changeMouth, 105 + Math.random() * 155);
        };
        timer = window.setTimeout(changeMouth, 120);
        return () => window.clearTimeout(timer);
    }, [state]);

    const setLookTarget = (x: number, y: number) => {
        portraitRef.current?.style.setProperty("--pia-look-x", `${x.toFixed(3)}%`);
        portraitRef.current?.style.setProperty("--pia-look-y", `${y.toFixed(3)}%`);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setLookTarget(
            ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.75,
            ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.45,
        );
    };

    const portraitStyle: PortraitStyle = { "--pia-look-x": "0%", "--pia-look-y": "0%" };

    return (
        <div
            ref={portraitRef}
            className={`pia-portrait relative h-full w-full overflow-hidden ${className}`}
            data-state={state}
            style={portraitStyle}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setLookTarget(0, 0)}
        >
            <div className="pia-motion absolute inset-0">
                <img src={FRAME_URLS.neutral} alt="Pia, Pocket Dentist sin digitale tannlegeresepsjonist" draggable={false} className="pia-frame pia-base" />
                <img src={FRAME_URLS.thinking} alt="" aria-hidden="true" draggable={false} className="pia-frame pia-thinking" />
                <img src={FRAME_URLS.blink} alt="" aria-hidden="true" draggable={false} className={`pia-frame pia-eyes ${blinking ? "is-visible" : ""}`} />
                <img src={FRAME_URLS.speaking} alt="" aria-hidden="true" draggable={false} className={`pia-frame pia-mouth ${speechOpen ? "is-visible" : ""}`} />
            </div>

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_45%,rgba(30,137,212,0.08)_100%)]" />

            <style>{`
                .pia-portrait { touch-action: pan-y; }
                .pia-motion {
                    transform-origin: 50% 72%;
                    animation: pia-breathe 5.2s ease-in-out infinite;
                    will-change: transform;
                }
                .pia-frame {
                    position: absolute; inset: -1.5%; width: 103%; height: 103%;
                    object-fit: cover;
                    object-position: calc(50% + var(--pia-look-x)) calc(50% + var(--pia-look-y));
                    user-select: none;
                    transition: object-position 480ms cubic-bezier(.2,.8,.2,1), opacity 90ms ease;
                }
                .pia-thinking { opacity: 0; transition: opacity 420ms ease; }
                .pia-portrait[data-state="thinking"] .pia-thinking { opacity: 1; }
                .pia-eyes { clip-path: inset(30% 25% 51% 25%); opacity: 0; }
                .pia-mouth { clip-path: inset(48% 38% 39% 38%); opacity: 0; }
                .pia-eyes.is-visible, .pia-mouth.is-visible { opacity: 1; }
                .pia-portrait[data-state="listening"] .pia-motion { animation: pia-listen 3.8s ease-in-out infinite; }
                .pia-portrait[data-state="thinking"] .pia-motion { animation: pia-think 4.4s ease-in-out infinite; }
                .pia-portrait[data-state="speaking"] .pia-motion { animation: pia-speak 2.6s ease-in-out infinite; }
                .pia-portrait:not([data-state="speaking"]) .pia-mouth { opacity: 0; }
                .pia-portrait[data-state="paused"] .pia-motion,
                .pia-portrait[data-state="error"] .pia-motion { animation-play-state: paused; }

                @keyframes pia-breathe {
                    0%, 100% { transform: scale(1.002) translateY(0); }
                    50% { transform: scale(1.009) translateY(-0.35%); }
                }
                @keyframes pia-listen {
                    0%, 100% { transform: scale(1.004) rotate(0deg); }
                    50% { transform: scale(1.012) rotate(-0.35deg) translateY(-0.3%); }
                }
                @keyframes pia-think {
                    0%, 100% { transform: scale(1.004) rotate(0deg); }
                    50% { transform: scale(1.01) rotate(0.4deg) translateY(-0.25%); }
                }
                @keyframes pia-speak {
                    0%, 100% { transform: scale(1.005) translateY(0); }
                    35% { transform: scale(1.011) rotate(-0.18deg) translateY(-0.35%); }
                    70% { transform: scale(1.008) rotate(0.14deg) translateY(-0.15%); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .pia-motion { animation: none !important; }
                    .pia-frame { transition: none; }
                }
            `}</style>
        </div>
    );
}
