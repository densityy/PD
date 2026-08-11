import { supabase } from "@/lib/supabase";

export type PiaRealtimeEvent =
    | { type: "connected" }

    | {
        type: "user_transcript";
        transcript: string;
    }
    | { type: "disconnected" }
    | { type: "speech_started" }
    | { type: "speech_stopped" }
    | { type: "response_started"; responseId?: string }
    | { type: "response_done"; responseId?: string }
    | { type: "error"; error: unknown }
    | { type: "raw"; event: Record<string, unknown> };

export interface PiaRealtimeConnection {
    peerConnection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    localStream: MediaStream;
    remoteAudio: HTMLAudioElement;
    sendEvent: (event: Record<string, unknown>) => void;
    close: () => Promise<void>;
    cancelResponse: () => void;
}

interface ConnectPiaRealtimeOptions {
    onEvent?: (event: PiaRealtimeEvent) => void;
}

export async function connectPiaRealtime(
    options: ConnectPiaRealtimeOptions = {},
): Promise<PiaRealtimeConnection> {
    const { onEvent } = options;

    const peerConnection = new RTCPeerConnection();

    const remoteAudio = document.createElement("audio");

    remoteAudio.autoplay = true;
    remoteAudio.setAttribute("playsinline", "");
    remoteAudio.setAttribute("webkit-playsinline", "");
    remoteAudio.muted = false;
    remoteAudio.volume = 1;

    remoteAudio.style.position = "fixed";
    remoteAudio.style.width = "1px";
    remoteAudio.style.height = "1px";
    remoteAudio.style.opacity = "0";
    remoteAudio.style.pointerEvents = "none";

    document.body.appendChild(remoteAudio);

    let localStream: MediaStream | null = null;

    const dataChannel = peerConnection.createDataChannel(
        "oai-events",
    );

    const emit = (event: PiaRealtimeEvent) => {
        onEvent?.(event);
    };

    const sendEvent = (
        event: Record<string, unknown>,
    ) => {
        if (dataChannel.readyState !== "open") {
            console.warn(
                "Pia Realtime data channel is not open",
            );
            return;
        }

        dataChannel.send(JSON.stringify(event));
    };

    dataChannel.addEventListener("open", () => {
        console.log(
            "Pia Realtime data channel connected",
        );

        emit({
            type: "connected",
        });
    });

    dataChannel.addEventListener(
        "close",
        () => {
            console.log(
                "Pia Realtime data channel closed",
            );

            emit({
                type: "disconnected",
            });
        },
    );

    dataChannel.addEventListener(
        "message",
        (messageEvent) => {
            try {
                const event = JSON.parse(
                    messageEvent.data,
                ) as Record<string, unknown>;

                const type =
                    typeof event.type === "string"
                        ? event.type
                        : "";

                console.debug(
                    "[Pia Realtime]",
                    type,
                    event,
                );

                switch (type) {
                    case "input_audio_buffer.speech_started": {
                        emit({
                            type: "speech_started",
                        });

                        break;
                    }
                    case "conversation.item.input_audio_transcription.completed": {
                        const transcript =
                            typeof event.transcript === "string"
                                ? event.transcript.trim()
                                : "";

                        if (transcript) {
                            emit({
                                type: "user_transcript",
                                transcript,
                            });
                        }

                        break;
                    }
                    case "input_audio_buffer.speech_stopped": {
                        emit({
                            type: "speech_stopped",
                        });

                        break;
                    }

                    case "response.created": {
                        const response =
                            event.response as
                            | Record<string, unknown>
                            | undefined;

                        emit({
                            type: "raw",
                            event: {
                                ...event,
                                responseId:
                                    typeof response?.id === "string"
                                        ? response.id
                                        : undefined,
                            },
                        });

                        break;
                    }

                    case "output_audio_buffer.started": {
                        emit({
                            type: "response_started",
                        });

                        break;
                    }

                    case "output_audio_buffer.stopped": {
                        emit({
                            type: "response_done",
                        });

                        break;
                    }

                    case "response.done": {
                        const response =
                            event.response as
                            | Record<string, unknown>
                            | undefined;

                        emit({
                            type: "raw",
                            event: {
                                ...event,
                                responseId:
                                    typeof response?.id === "string"
                                        ? response.id
                                        : undefined,
                            },
                        });

                        break;
                    }

                    case "error": {
                        emit({
                            type: "error",
                            error: event,
                        });

                        break;
                    }

                    default: {
                        emit({
                            type: "raw",
                            event,
                        });
                    }
                }
            } catch (error) {
                console.error(
                    "Failed to parse Pia Realtime event",
                    error,
                );
            }
        },
    );

    peerConnection.addEventListener(
        "track",
        (event) => {
            const [stream] = event.streams;

            if (!stream) {
                return;
            }

            remoteAudio.srcObject = stream;

            void remoteAudio.play().catch((error) => {
                console.error(
                    "Could not start Pia remote audio:",
                    error,
                );

                emit({
                    type: "error",
                    error,
                });
            });
        },
    );

    peerConnection.addEventListener(
        "connectionstatechange",
        () => {
            console.log(
                "Pia WebRTC state:",
                peerConnection.connectionState,
            );

            if (
                peerConnection.connectionState ===
                "failed" ||
                peerConnection.connectionState ===
                "closed"
            ) {
                emit({
                    type: "disconnected",
                });
            }
        },
    );

    try {
        localStream =
            await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

        for (const track of localStream.getTracks()) {
            peerConnection.addTrack(
                track,
                localStream,
            );
        }

        const offer =
            await peerConnection.createOffer();

        await peerConnection.setLocalDescription(
            offer,
        );

        if (!offer.sdp) {
            throw new Error(
                "WebRTC offer did not contain SDP",
            );
        }

        const {
            data: { session },
        } = await supabase.auth.getSession();

        const supabaseUrl =
            import.meta.env.VITE_SUPABASE_URL;

        const supabaseAnonKey =
            import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(
                "Missing Supabase frontend configuration",
            );
        }

        const realtimeFunctionUrl =
            `${supabaseUrl}/functions/v1/pia-realtime`;

        const response = await fetch(
            realtimeFunctionUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/sdp",

                    apikey: supabaseAnonKey,

                    Authorization:
                        `Bearer ${session?.access_token ??
                        supabaseAnonKey
                        }`,
                },

                body: offer.sdp,
            },
        );

        if (!response.ok) {
            const errorText =
                await response.text();

            throw new Error(
                `Pia Realtime backend failed (${response.status}): ${errorText}`,
            );
        }

        const answerSdp =
            await response.text();

        await peerConnection.setRemoteDescription({
            type: "answer",
            sdp: answerSdp,
        });

        const cancelResponse = () => {
            sendEvent({
                type: "response.cancel",
            });
        };

        const close = async () => {
            try {
                if (
                    dataChannel.readyState === "open" ||
                    dataChannel.readyState === "connecting"
                ) {
                    dataChannel.close();
                }
            } catch (error) {
                console.warn(
                    "Could not close Pia data channel",
                    error,
                );
            }

            if (localStream) {
                for (const track of localStream.getTracks()) {
                    track.stop();
                }
            }

            try {
                remoteAudio.pause();
            } catch {
                // Ignore audio cleanup errors.
            }

            remoteAudio.srcObject = null;
            remoteAudio.remove();

            if (
                peerConnection.connectionState !== "closed"
            ) {
                peerConnection.close();
            }
        };

        return {
            peerConnection,
            dataChannel,
            localStream,
            remoteAudio,
            sendEvent,
            cancelResponse,
            close,
        };
    } catch (error) {
        if (localStream) {
            for (const track of localStream.getTracks()) {
                track.stop();
            }
        }

        remoteAudio.pause();
        remoteAudio.srcObject = null;

        try {
            dataChannel.close();
        } catch {
            // Ignore cleanup error.
        }

        try {
            peerConnection.close();
        } catch {
            // Ignore cleanup error.
        }

        emit({
            type: "error",
            error,
        });

        throw error;
    }
}