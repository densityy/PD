import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type Pia3DState =
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "paused"
    | "error";

interface Pia3DProps {
    state?: Pia3DState;
    className?: string;
}

interface PiaModelProps {
    state: Pia3DState;
}

const MODEL_URL = "/models/Pia.glb";

const NORMALIZED_FULL_HEIGHT = 4;
const PORTRAIT_MODEL_Y = -0.78;

/*
 * Tripo animation mapping confirmed visually:
 *
 * 0 = looking around
 * 1 = waiting
 * 2 = idle
 * 3 = hand gesture
 * 4 = hand on waist / looking up and sideways
 */
const CLIP_WAITING = 1;
const CLIP_IDLE = 2;
const CLIP_HAND_GESTURE = 3;
const CLIP_THINKING = 4;

function LoadingPia() {
    return (
        <Html center>
            <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[#10233f] shadow-lg">
                Laster Pia…
            </div>
        </Html>
    );
}

function PiaModel({
    state,
}: PiaModelProps) {
    const gltf = useGLTF(
        MODEL_URL,
    );

    /*
     * Clone the cached GLTF scene so each Pia mount gets
     * its own skinned skeleton and animation state.
     */
    const scene = useMemo(
        () => clone(gltf.scene),
        [gltf.scene],
    );

    const mixerRef = useRef<THREE.AnimationMixer | null>(
        null,
    );

    const actionsRef = useRef<THREE.AnimationAction[]>(
        [],
    );

    const activeActionRef = useRef<THREE.AnimationAction | null>(
        null,
    );

    const currentStateRef = useRef<Pia3DState>(
        state,
    );

    const speakingTimerRef = useRef<number | null>(
        null,
    );

    const gestureRunningRef = useRef(false);

    const normalization = useMemo(() => {
        scene.updateWorldMatrix(
            true,
            true,
        );

        const box = new THREE.Box3().setFromObject(
            scene,
        );

        const size = new THREE.Vector3();

        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

        const height = Math.max(
            size.y,
            0.001,
        );

        return {
            scale: NORMALIZED_FULL_HEIGHT /
                height,
            center,
        };
    }, [scene]);

    const clearSpeakingTimer = () => {
        if (
            speakingTimerRef.current !==
                null
        ) {
            window.clearTimeout(
                speakingTimerRef.current,
            );

            speakingTimerRef.current = null;
        }
    };

    const crossfadeTo = (
        action:
            | THREE.AnimationAction
            | undefined,
        fadeSeconds = 0.35,
        reset = true,
    ) => {
        if (!action) {
            return;
        }

        const current = activeActionRef.current;

        if (
            current === action &&
            action.isRunning()
        ) {
            return;
        }

        if (
            current &&
            current !== action
        ) {
            current.fadeOut(
                fadeSeconds,
            );
        }

        action.enabled = true;
        action.setEffectiveWeight(1);
        action.setEffectiveTimeScale(1);

        if (reset) {
            action.reset();
        }

        action
            .fadeIn(
                fadeSeconds,
            )
            .play();

        activeActionRef.current = action;
    };

    const playLoop = (
        clipIndex: number,
        fadeSeconds = 0.35,
        timeScale = 1,
    ) => {
        const action = actionsRef.current[
            clipIndex
        ];

        if (!action) {
            return;
        }

        action.setLoop(
            THREE.LoopRepeat,
            Infinity,
        );

        action.clampWhenFinished = false;

        action.setEffectiveTimeScale(
            timeScale,
        );

        crossfadeTo(
            action,
            fadeSeconds,
            true,
        );

        action.setEffectiveTimeScale(
            timeScale,
        );
    };

    const playSpeakingBase = () => {
        /*
         * Speaking uses the clean idle animation as a base.
         * Authored hand gestures are inserted occasionally
         * rather than looping constantly.
         */
        playLoop(
            CLIP_IDLE,
            0.3,
            1.02,
        );
    };

    const playSpeakingGesture = () => {
        if (
            currentStateRef.current !==
                "speaking" ||
            gestureRunningRef.current
        ) {
            return;
        }

        const gesture = actionsRef.current[
            CLIP_HAND_GESTURE
        ];

        if (!gesture) {
            return;
        }

        gestureRunningRef.current = true;

        gesture.setLoop(
            THREE.LoopOnce,
            1,
        );

        gesture.clampWhenFinished = true;

        gesture.setEffectiveTimeScale(
            0.95,
        );

        crossfadeTo(
            gesture,
            0.25,
            true,
        );
    };

    const scheduleSpeakingGesture = () => {
        clearSpeakingTimer();

        if (
            currentStateRef.current !==
                "speaking"
        ) {
            return;
        }

        /*
         * Irregular spacing makes repeated gestures
         * feel less mechanical.
         */
        const delay = 5500 +
            Math.random() *
                2500;

        speakingTimerRef.current = window.setTimeout(
            () => {
                playSpeakingGesture();
            },
            delay,
        );
    };

    useEffect(() => {
        if (
            !gltf.animations.length
        ) {
            console.warn(
                "Pia.glb contains no animation clips.",
            );

            return;
        }

        const mixer = new THREE.AnimationMixer(
            scene,
        );

        mixerRef.current = mixer;

        const actions = gltf.animations.map(
            (clip) => {
                const action = mixer.clipAction(
                    clip,
                );

                action.enabled = true;

                return action;
            },
        );

        actionsRef.current = actions;

        /*
         * Start in a stable neutral animation.
         */
        playLoop(
            CLIP_IDLE,
            0,
            1,
        );

        const handleFinished = (
            event: {
                action: THREE.AnimationAction;
            },
        ) => {
            const gesture = actionsRef.current[
                CLIP_HAND_GESTURE
            ];

            if (
                event.action ===
                    gesture
            ) {
                gestureRunningRef.current = false;

                if (
                    currentStateRef.current ===
                        "speaking"
                ) {
                    playSpeakingBase();
                    scheduleSpeakingGesture();
                }
            }
        };

        mixer.addEventListener(
            "finished",
            handleFinished,
        );

        return () => {
            clearSpeakingTimer();

            mixer.removeEventListener(
                "finished",
                handleFinished,
            );

            mixer.stopAllAction();

            for (
                const action of actions
            ) {
                action.stop();
            }

            mixer.uncacheRoot(
                scene,
            );

            actionsRef.current = [];

            activeActionRef.current = null;

            mixerRef.current = null;

            gestureRunningRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        scene,
        gltf.animations,
    ]);

    useEffect(() => {
        currentStateRef.current = state;

        clearSpeakingTimer();

        gestureRunningRef.current = false;

        switch (state) {
            case "listening": {
                /*
                 * Waiting is the best attentive/listening clip.
                 * Slow it down slightly so it feels calmer.
                 */
                playLoop(
                    CLIP_WAITING,
                    0.35,
                    0.82,
                );

                break;
            }

            case "thinking": {
                /*
                 * Distinctive thinking pose.
                 */
                playLoop(
                    CLIP_THINKING,
                    0.4,
                    0.72,
                );

                break;
            }

            case "speaking": {
                playSpeakingBase();

                /*
                 * Let Pia establish speech first,
                 * then make one early gesture.
                 */
                speakingTimerRef.current = window.setTimeout(
                    () => {
                        playSpeakingGesture();
                    },
                    1800,
                );

                break;
            }

            case "error": {
                playLoop(
                    CLIP_WAITING,
                    0.35,
                    0.72,
                );

                break;
            }

            case "paused": {
                playLoop(
                    CLIP_IDLE,
                    0.35,
                    0.88,
                );

                break;
            }

            case "idle":
            default: {
                playLoop(
                    CLIP_IDLE,
                    0.35,
                    0.95,
                );

                break;
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useFrame(
        (
            _,
            delta,
        ) => {
            /*
             * IMPORTANT:
             * We let AnimationMixer fully own the skeleton.
             * Do not add cumulative bone rotations here.
             */
            mixerRef.current?.update(
                Math.min(
                    delta,
                    0.05,
                ),
            );
        },
    );

    const {
        scale,
        center,
    } = normalization;

    return (
        <group
            position={[
                0,
                PORTRAIT_MODEL_Y,
                0,
            ]}
        >
            <group
                scale={[
                    scale,
                    scale,
                    scale,
                ]}
            >
                <primitive
                    object={scene}
                    position={[
                        -center.x,
                        -center.y,
                        -center.z,
                    ]}
                />
            </group>
        </group>
    );
}

export default function Pia3D({
    state = "idle",
    className = "",
}: Pia3DProps) {
    return (
        <div
            className={`relative h-full w-full overflow-hidden ${className}`}
        >
            <Canvas
                dpr={[
                    1,
                    1.6,
                ]}
                camera={{
                    fov: 24,
                    near: 0.01,
                    far: 100,
                    position: [
                        0,
                        0.15,
                        5.1,
                    ],
                }}
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: "high-performance",
                }}
                onCreated={({
                    gl,
                    camera,
                }) => {
                    gl.outputColorSpace = THREE.SRGBColorSpace;

                    gl.toneMapping = THREE.ACESFilmicToneMapping;

                    gl.toneMappingExposure = 1.05;

                    camera.lookAt(
                        0,
                        0.1,
                        0,
                    );
                }}
            >
                <ambientLight
                    intensity={1.4}
                />

                <hemisphereLight
                    intensity={1.05}
                    color="#e5f8ff"
                    groundColor="#26415d"
                />

                <directionalLight
                    position={[
                        3,
                        5,
                        4,
                    ]}
                    intensity={2.15}
                />

                <directionalLight
                    position={[
                        -3,
                        2,
                        2,
                    ]}
                    intensity={0.75}
                />

                <Suspense
                    fallback={<LoadingPia />}
                >
                    <PiaModel
                        state={state}
                    />
                </Suspense>
            </Canvas>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#f3fbff]/25 to-transparent" />
        </div>
    );
}

useGLTF.preload(
    MODEL_URL,
);
