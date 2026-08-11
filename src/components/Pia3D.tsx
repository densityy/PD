import {
    Suspense,
    useEffect,
    useMemo,
    useRef,
} from "react";
import {
    Canvas,
    useFrame,
} from "@react-three/fiber";
import {
    Html,
    useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

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

type BoneSnapshot = {
    x: number;
    y: number;
    z: number;
};

const MODEL_URL = "/models/Pia.glb";

/*
 * We normalize Pia to a predictable height, then deliberately
 * frame only the upper body. The previous version used automatic
 * Bounds fitting, which tried to keep her entire body visible.
 */
const NORMALIZED_FULL_HEIGHT = 4;
const PORTRAIT_MODEL_Y = -0.78;

function damp(
    current: number,
    target: number,
    speed: number,
    delta: number,
) {
    return THREE.MathUtils.damp(
        current,
        target,
        speed,
        delta,
    );
}

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

    const animatedRootRef =
        useRef<THREE.Group>(null);

    /*
     * Calculate Pia's real GLB dimensions once and normalize the
     * model. This makes the camera framing stable even if the GLB
     * was exported in unusual units.
     */
    const normalization =
        useMemo(() => {
            gltf.scene.updateWorldMatrix(
                true,
                true,
            );

            const box =
                new THREE.Box3().setFromObject(
                    gltf.scene,
                );

            const size =
                new THREE.Vector3();

            const center =
                new THREE.Vector3();

            box.getSize(size);
            box.getCenter(center);

            const height =
                Math.max(
                    size.y,
                    0.001,
                );

            return {
                scale:
                    NORMALIZED_FULL_HEIGHT /
                    height,

                center,
            };
        }, [gltf.scene]);

    /*
     * These names come from the actual Tripo skeleton in Pia.glb.
     */
    const bones = useMemo(() => {
        const getBone = (
            name: string,
        ) =>
            gltf.scene.getObjectByName(
                name,
            ) as
                | THREE.Bone
                | undefined;

        return {
            head:
                getBone("Head"),

            neck1:
                getBone(
                    "NeckTwist01",
                ),

            neck2:
                getBone(
                    "NeckTwist02",
                ),

            spine1:
                getBone(
                    "Spine01",
                ),

            spine2:
                getBone(
                    "Spine02",
                ),

            waist:
                getBone("Waist"),

            leftClavicle:
                getBone(
                    "L_Clavicle",
                ),

            rightClavicle:
                getBone(
                    "R_Clavicle",
                ),

            leftUpperArm:
                getBone(
                    "L_Upperarm",
                ),

            rightUpperArm:
                getBone(
                    "R_Upperarm",
                ),
        };
    }, [gltf.scene]);

    const baseRotations =
        useRef<
            Map<
                THREE.Object3D,
                BoneSnapshot
            >
        >(
            new Map(),
        );

    useEffect(() => {
        const objects = [
            bones.head,
            bones.neck1,
            bones.neck2,
            bones.spine1,
            bones.spine2,
            bones.waist,
            bones.leftClavicle,
            bones.rightClavicle,
            bones.leftUpperArm,
            bones.rightUpperArm,
        ].filter(
            Boolean,
        ) as THREE.Object3D[];

        const snapshots =
            new Map<
                THREE.Object3D,
                BoneSnapshot
            >();

        for (
            const object of objects
        ) {
            snapshots.set(
                object,
                {
                    x:
                        object
                            .rotation.x,

                    y:
                        object
                            .rotation.y,

                    z:
                        object
                            .rotation.z,
                },
            );
        }

        baseRotations.current =
            snapshots;
    }, [bones]);

    useFrame(
        (
            frameState,
            delta,
        ) => {
            const root =
                animatedRootRef.current;

            if (!root) {
                return;
            }

            const t =
                frameState.clock
                    .elapsedTime;

            const breathing =
                Math.sin(
                    t * 1.7,
                );

            const slowSway =
                Math.sin(
                    t * 0.72,
                );

            const speechCadence =
                Math.sin(
                    t * 5.8,
                );

            let headX = 0;
            let headY = 0;
            let headZ = 0;

            let neckX = 0;
            let neckY = 0;

            let spineX = 0;
            let spineZ = 0;

            let shoulderLift = 0;
            let leftArmZ = 0;
            let rightArmZ = 0;

            let targetRootX = 0;
            let targetRootY =
                PORTRAIT_MODEL_Y;

            let targetRootZ = 0;
            let targetRootYRotation = 0;

            switch (state) {
                case "listening": {
                    /*
                     * Attentive without moving toward the
                     * camera: tiny torso tilt, head tilt,
                     * shoulders relaxed and visible.
                     */
                    headX =
                        -0.018;

                    headY =
                        Math.sin(
                            t * 0.8,
                        ) *
                        0.016;

                    headZ =
                        0.045 +
                        slowSway *
                            0.012;

                    neckY =
                        slowSway *
                        0.008;

                    spineZ =
                        slowSway *
                        0.014;

                    shoulderLift =
                        breathing *
                        0.009;

                    targetRootX =
                        slowSway *
                        0.012;

                    targetRootZ =
                        slowSway *
                        0.006;

                    break;
                }

                case "thinking": {
                    /*
                     * Slower asymmetric pose. This should
                     * visibly read as a different state.
                     */
                    headY =
                        0.075 +
                        slowSway *
                            0.025;

                    headZ =
                        -0.055;

                    headX =
                        Math.sin(
                            t * 0.55,
                        ) *
                        0.01;

                    neckY =
                        0.022;

                    spineZ =
                        -0.018 +
                        slowSway *
                            0.012;

                    shoulderLift =
                        breathing *
                        0.005;

                    targetRootX =
                        -0.012 +
                        slowSway *
                        0.008;

                    targetRootZ =
                        -0.008;

                    targetRootYRotation =
                        0.018;

                    break;
                }

                case "speaking": {
                    /*
                     * Conversational body language:
                     * head cadence, torso sway, shoulder
                     * movement and tiny upper-arm motion.
                     */
                    headX =
                        speechCadence *
                        0.012 +
                        Math.sin(
                            t * 1.2,
                        ) *
                        0.008;

                    headY =
                        Math.sin(
                            t * 1.55,
                        ) *
                        0.026;

                    headZ =
                        Math.sin(
                            t * 1.05,
                        ) *
                        0.018;

                    neckY =
                        Math.sin(
                            t * 1.2,
                        ) *
                        0.008;

                    spineZ =
                        Math.sin(
                            t * 0.9,
                        ) *
                        0.02;

                    shoulderLift =
                        breathing *
                        0.014;

                    leftArmZ =
                        Math.sin(
                            t * 1.1,
                        ) *
                        0.008;

                    rightArmZ =
                        -Math.sin(
                            t * 1.1,
                        ) *
                        0.008;

                    targetRootX =
                        Math.sin(
                            t * 0.85,
                        ) *
                        0.014;

                    targetRootZ =
                        Math.sin(
                            t * 0.75,
                        ) *
                        0.009;

                    targetRootYRotation =
                        Math.sin(
                            t * 0.7,
                        ) *
                        0.012;

                    break;
                }

                case "paused": {
                    headY =
                        slowSway *
                        0.01;

                    headZ =
                        slowSway *
                        0.008;

                    spineZ =
                        slowSway *
                        0.005;

                    shoulderLift =
                        breathing *
                        0.004;

                    break;
                }

                case "error": {
                    headZ =
                        -0.045;

                    headX =
                        0.022;

                    spineZ =
                        -0.012;

                    break;
                }

                case "idle":
                default: {
                    /*
                     * Visible idle life without forward/back
                     * movement: breathing, shoulder motion,
                     * head sway and a small torso sway.
                     */
                    headY =
                        slowSway *
                        0.024;

                    headZ =
                        Math.sin(
                            t * 0.5,
                        ) *
                        0.014;

                    headX =
                        Math.sin(
                            t * 0.42,
                        ) *
                        0.005;

                    spineZ =
                        slowSway *
                        0.009;

                    shoulderLift =
                        breathing *
                        0.009;

                    targetRootX =
                        slowSway *
                        0.008;

                    targetRootZ =
                        slowSway *
                        0.004;

                    targetRootY +=
                        breathing *
                        0.002;

                    break;
                }
            }

            root.position.x =
                damp(
                    root.position.x,
                    targetRootX,
                    3.5,
                    delta,
                );

            root.position.y =
                damp(
                    root.position.y,
                    targetRootY,
                    3.5,
                    delta,
                );

            root.rotation.z =
                damp(
                    root.rotation.z,
                    targetRootZ,
                    3.5,
                    delta,
                );

            root.rotation.y =
                damp(
                    root.rotation.y,
                    targetRootYRotation,
                    3.5,
                    delta,
                );

            const animateBone = (
                bone:
                    | THREE.Object3D
                    | undefined,

                x: number,
                y: number,
                z: number,

                speed = 5,
            ) => {
                if (!bone) {
                    return;
                }

                const base =
                    baseRotations
                        .current
                        .get(
                            bone,
                        );

                if (!base) {
                    return;
                }

                bone.rotation.x =
                    damp(
                        bone
                            .rotation.x,
                        base.x + x,
                        speed,
                        delta,
                    );

                bone.rotation.y =
                    damp(
                        bone
                            .rotation.y,
                        base.y + y,
                        speed,
                        delta,
                    );

                bone.rotation.z =
                    damp(
                        bone
                            .rotation.z,
                        base.z + z,
                        speed,
                        delta,
                    );
            };

            animateBone(
                bones.head,
                headX,
                headY,
                headZ,
                5.5,
            );

            animateBone(
                bones.neck1,
                neckX,
                neckY,
                0,
                5,
            );

            animateBone(
                bones.neck2,
                neckX * 0.45,
                neckY * 0.55,
                headZ * 0.25,
                5,
            );

            animateBone(
                bones.spine1,
                0,
                0,
                spineZ * 0.55,
                4,
            );

            animateBone(
                bones.spine2,
                0,
                0,
                spineZ,
                4,
            );

            animateBone(
                bones.leftClavicle,
                0,
                0,
                shoulderLift,
                3,
            );

            animateBone(
                bones.rightClavicle,
                0,
                0,
                -shoulderLift,
                3,
            );

            animateBone(
                bones.leftUpperArm,
                0,
                0,
                leftArmZ,
                3.5,
            );

            animateBone(
                bones.rightUpperArm,
                0,
                0,
                rightArmZ,
                3.5,
            );
        },
    );

    const {
        scale,
        center,
    } = normalization;

    return (
        <group
            ref={
                animatedRootRef
            }
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
                    object={
                        gltf.scene
                    }
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
                    /*
                     * Fixed portrait camera.
                     * Lower FOV gives Pia a flattering
                     * video-call portrait rather than a
                     * distorted game-camera look.
                     */
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

                    powerPreference:
                        "high-performance",
                }}
                onCreated={({
                    gl,
                    camera,
                }) => {
                    gl.outputColorSpace =
                        THREE.SRGBColorSpace;

                    gl.toneMapping =
                        THREE.ACESFilmicToneMapping;

                    gl.toneMappingExposure =
                        1.05;

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
                    fallback={
                        <LoadingPia />
                    }
                >
                    <PiaModel
                        state={
                            state
                        }
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
