import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Navigation,
  Phone,
  PhoneOff,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { sendMessageToPia } from "@/services/piaService";
import type { ChatMessage, Clinic } from "@/types/pia";

type PiaState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "error";

interface PiaCallProps {
  open: boolean;
  onClose: () => void;
}

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const GREETING =
  "Hei! Jeg er Pia, din digitale tannlegeresepsjonist. Hva kan jeg hjelpe deg med i dag?";

export default function PiaCall({
  open,
  onClose,
}: PiaCallProps) {
  const [piaState, setPiaState] =
    useState<PiaState>("idle");

  const [muted, setMuted] =
    useState(false);

  const [speaker, setSpeaker] =
    useState(true);

  const [seconds, setSeconds] =
    useState(0);

  const [lastUserText, setLastUserText] =
    useState("");

  const [lastPiaText, setLastPiaText] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Clinic state
   */
  const [clinics, setClinics] =
    useState<Clinic[]>([]);

  const [
    isSearchingClinics,
    setIsSearchingClinics,
  ] = useState(false);

  const [
    clinicSearchLocation,
    setClinicSearchLocation,
  ] = useState("");

  const [
    showClinics,
    setShowClinics,
  ] = useState(false);

  /*
   * Location request state
   */
  const [
    showLocationPrompt,
    setShowLocationPrompt,
  ] = useState(false);

  const [
    showManualLocation,
    setShowManualLocation,
  ] = useState(false);

  const [
    manualLocation,
    setManualLocation,
  ] = useState("");

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  /*
   * Once clinics are shown we pause the
   * active AI call so we don't keep spending
   * money unless the patient chooses to continue.
   */
  const [
    callPaused,
    setCallPaused,
  ] = useState(false);

  /*
   * Audio / microphone refs
   */
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const mediaStreamRef =
    useRef<MediaStream | null>(null);

  const audioChunksRef =
    useRef<Blob[]>([]);

  const historyRef =
    useRef<ChatMessage[]>([]);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const isEndingRef =
    useRef(false);

  const isProcessingRef =
    useRef(false);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const silenceFrameRef =
    useRef<number | null>(null);

  const voiceDetectedRef =
    useRef(false);

  const silenceStartedRef =
    useRef<number | null>(null);

  const maxRecordingTimerRef =
    useRef<number | null>(null);

  /*
   * --------------------------------------------------
   * CALL TIMER
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!open) {
      setSeconds(0);
      return;
    }

    const timer =
      window.setInterval(() => {
        setSeconds(
          (current) => current + 1,
        );
      }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open]);

  /*
   * Prevent background scrolling.
   */
  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  /*
   * --------------------------------------------------
   * CLEAN UP MICROPHONE
   * --------------------------------------------------
   */

  const cleanupRecorder = () => {
    if (
      silenceFrameRef.current !== null
    ) {
      cancelAnimationFrame(
        silenceFrameRef.current,
      );

      silenceFrameRef.current = null;
    }

    if (
      maxRecordingTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        maxRecordingTimerRef.current,
      );

      maxRecordingTimerRef.current =
        null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();

      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop(),
        );

      mediaStreamRef.current = null;
    }

    mediaRecorderRef.current = null;
  };

  /*
   * --------------------------------------------------
   * TRANSCRIPTION
   * --------------------------------------------------
   */

  const transcribeAudio = async (
    audioBlob: Blob,
  ): Promise<string> => {
    const formData =
      new FormData();

    let extension = "webm";

    if (
      audioBlob.type.includes("mp4") ||
      audioBlob.type.includes("m4a")
    ) {
      extension = "m4a";
    }

    formData.append(
      "action",
      "transcribe",
    );

    formData.append(
      "audio",
      audioBlob,
      `pia-recording.${extension}`,
    );

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/pia-voice`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${SUPABASE_ANON_KEY}`,

            apikey:
              SUPABASE_ANON_KEY,
          },

          body: formData,
        },
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Transcription failed:",
        errorText,
      );

      throw new Error(
        "Kunne ikke forstå stemmen.",
      );
    }

    const data =
      await response.json();

    return typeof data?.text ===
      "string"
      ? data.text.trim()
      : "";
  };

  /*
   * --------------------------------------------------
   * GENERATE PIA AUDIO
   * --------------------------------------------------
   */

  const generatePiaVoice = async (
    text: string,
  ): Promise<Blob> => {
    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/pia-voice`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${SUPABASE_ANON_KEY}`,

            apikey:
              SUPABASE_ANON_KEY,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            action: "speak",
            text,
          }),
        },
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Pia speech generation failed:",
        errorText,
      );

      throw new Error(
        "Kunne ikke generere stemmen til Pia.",
      );
    }

    return await response.blob();
  };

  /*
   * --------------------------------------------------
   * PLAY PIA AUDIO
   * --------------------------------------------------
   */

  const speak = async (
    text: string,
    listenAfter = true,
  ) => {
    if (
      isEndingRef.current ||
      !text.trim()
    ) {
      return;
    }

    /*
     * If speaker is disabled, simply continue
     * the conversation without generating audio.
     */
    if (!speaker) {
      setPiaState(
        listenAfter
          ? "idle"
          : "paused",
      );

      if (
        listenAfter &&
        !muted &&
        !callPaused
      ) {
        window.setTimeout(() => {
          void startListening();
        }, 300);
      }

      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setPiaState("speaking");

      const audioBlob =
        await generatePiaVoice(
          text,
        );

      if (
        isEndingRef.current
      ) {
        return;
      }

      const audioUrl =
        URL.createObjectURL(
          audioBlob,
        );

      const audio =
        new Audio(audioUrl);

      audioRef.current = audio;

      audio.volume = 1;

      audio.onended = () => {
        URL.revokeObjectURL(
          audioUrl,
        );

        audioRef.current = null;

        if (
          isEndingRef.current
        ) {
          return;
        }

        if (
          listenAfter &&
          !callPaused
        ) {
          setPiaState("idle");

          if (!muted) {
            window.setTimeout(() => {
              void startListening();
            }, 300);
          }
        } else {
          setPiaState("paused");
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(
          audioUrl,
        );

        audioRef.current = null;

        setPiaState("idle");

        setErrorMessage(
          "Pia sin lyd kunne ikke spilles.",
        );
      };

      await audio.play();
    } catch (error) {
      console.error(
        "Pia voice playback error:",
        error,
      );

      setPiaState("idle");

      setErrorMessage(
        "Trykk på mikrofonen for å fortsette samtalen.",
      );
    }
  };

  /*
   * --------------------------------------------------
   * STOP LISTENING
   * --------------------------------------------------
   */

  const stopListening = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current
        .state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (
      silenceFrameRef.current !== null
    ) {
      cancelAnimationFrame(
        silenceFrameRef.current,
      );

      silenceFrameRef.current = null;
    }

    if (
      maxRecordingTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        maxRecordingTimerRef.current,
      );

      maxRecordingTimerRef.current =
        null;
    }
  };

  /*
   * --------------------------------------------------
   * CLINIC SEARCH
   * --------------------------------------------------
   */

  const searchClinicsForPia = async (
    search:
      | {
          location: string;
        }
      | {
          latitude: number;
          longitude: number;
        },
    displayLocation: string,
  ): Promise<Clinic[]> => {
    /*
     * The objective of the active call is now being
     * completed, so stop microphone activity.
     */
    stopListening();
    cleanupRecorder();

    setCallPaused(true);
    setPiaState("paused");

    setShowLocationPrompt(false);
    setShowManualLocation(false);

    setClinicSearchLocation(
      displayLocation,
    );

    setClinics([]);
    setShowClinics(true);
    setIsSearchingClinics(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          "search-clinics",
          {
            body: search,
          },
        );

      if (error) {
        console.error(
          "Pia clinic search error:",
          error,
        );

        setErrorMessage(
          "Kunne ikke hente klinikker akkurat nå.",
        );

        return [];
      }

      const results =
        Array.isArray(
          data?.clinics,
        )
          ? (data.clinics as Clinic[])
          : [];

      /*
       * Keep the voice experience quick.
       * The full Clinic Finder can do deeper
       * price refresh work separately.
       */
      const topResults =
        results.slice(0, 5);

      setClinics(
        topResults,
      );

      return topResults;
    } catch (error) {
      console.error(
        "Pia clinic search failed:",
        error,
      );

      setErrorMessage(
        "Noe gikk galt under klinikksøket.",
      );

      return [];
    } finally {
      setIsSearchingClinics(false);
      setLocationLoading(false);
    }
  };

  /*
   * --------------------------------------------------
   * GPS LOCATION
   * --------------------------------------------------
   */

  const useCurrentLocationForPia =
    () => {
      setErrorMessage("");

      if (
        !navigator.geolocation
      ) {
        setErrorMessage(
          "Nettleseren din støtter ikke posisjon.",
        );

        return;
      }

      setLocationLoading(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          void searchClinicsForPia(
            {
              latitude:
                position.coords.latitude,

              longitude:
                position.coords.longitude,
            },

            "Din posisjon",
          );
        },

        (error) => {
          console.error(
            "Location error:",
            error,
          );

          setLocationLoading(false);

          setErrorMessage(
            "Kunne ikke hente posisjonen din. Du kan skrive inn stedet i stedet.",
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
    };

  /*
   * --------------------------------------------------
   * MANUAL LOCATION
   * --------------------------------------------------
   */

  const handleManualLocationForPia =
    async () => {
      const location =
        manualLocation.trim();

      if (!location) {
        setErrorMessage(
          "Skriv inn et sted først.",
        );

        return;
      }

      setErrorMessage("");
      setLocationLoading(true);

      await searchClinicsForPia(
        {
          location,
        },
        location,
      );
    };

  /*
   * --------------------------------------------------
   * HANDLE PIA AI RESPONSE
   * --------------------------------------------------
   */

  const handleUserSpeech = async (
    text: string,
  ) => {
    const trimmed =
      text.trim();

    if (
      !trimmed ||
      isEndingRef.current
    ) {
      setPiaState("idle");
      return;
    }

    setErrorMessage("");

    setLastUserText(
      trimmed,
    );

    setPiaState("thinking");

    isProcessingRef.current =
      true;

    const historyBeforeMessage =
      historyRef.current;

    historyRef.current = [
      ...historyRef.current,

      {
        sender: "user",
        text: trimmed,
      },
    ];

    try {
      const pia =
        await sendMessageToPia(
          trimmed,
          historyBeforeMessage,
        );

      if (
        isEndingRef.current
      ) {
        return;
      }

      historyRef.current = [
        ...historyRef.current,

        {
          sender: "pia",
          text: pia.message,
        },
      ];

      setLastPiaText(
        pia.message,
      );

      const requestsLocation =
        pia.actions.includes(
          "request_location",
        );

      const shouldSearchClinics =
        pia.actions.includes(
          "search_clinics",
        );

      /*
       * ----------------------------------------------
       * LOCATION REQUIRED
       * ----------------------------------------------
       *
       * Pia says one short sentence and then the
       * frontend handles location.
       *
       * The user does NOT need to speak the place.
       */
      if (requestsLocation) {
        isProcessingRef.current =
          false;

        stopListening();
        cleanupRecorder();

        setCallPaused(true);

        /*
         * Speak once but don't reopen microphone.
         */
        await speak(
          pia.message,
          false,
        );

        if (
          isEndingRef.current
        ) {
          return;
        }

        setShowLocationPrompt(
          true,
        );

        return;
      }

      /*
       * ----------------------------------------------
       * LOCATION ALREADY KNOWN
       * ----------------------------------------------
       */
      if (
        shouldSearchClinics &&
        pia.extracted.location
      ) {
        /*
         * Search directly using the extracted
         * location.
         */
        await searchClinicsForPia(
          {
            location:
              pia.extracted.location,
          },

          pia.extracted.location,
        );

        if (
          isEndingRef.current
        ) {
          return;
        }

        isProcessingRef.current =
          false;

        /*
         * Speak only once and then remain paused.
         */
        await speak(
          pia.message,
          false,
        );

        return;
      }

      /*
       * Normal conversation continues.
       */
      isProcessingRef.current =
        false;

      await speak(
        pia.message,
        true,
      );
    } catch (error) {
      console.error(
        "Pia conversation error:",
        error,
      );

      isProcessingRef.current =
        false;

      const fallback =
        "Beklager, jeg fikk et problem med samtalen. Kan du prøve igjen?";

      setLastPiaText(
        fallback,
      );

      await speak(
        fallback,
        true,
      );
    }
  };

  /*
   * --------------------------------------------------
   * SILENCE DETECTION
   * --------------------------------------------------
   */

  const monitorSilence = (
    analyser: AnalyserNode,
  ) => {
    const values =
      new Uint8Array(
        analyser.fftSize,
      );

    const checkAudio = () => {
      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current
          .state !== "recording"
      ) {
        return;
      }

      analyser.getByteTimeDomainData(
        values,
      );

      let total = 0;

      for (
        let index = 0;
        index < values.length;
        index++
      ) {
        const normalized =
          (values[index] -
            128) /
          128;

        total +=
          normalized *
          normalized;
      }

      const rms =
        Math.sqrt(
          total /
            values.length,
        );

      const speaking =
        rms > 0.025;

      if (speaking) {
        voiceDetectedRef.current =
          true;

        silenceStartedRef.current =
          null;
      } else if (
        voiceDetectedRef.current
      ) {
        if (
          silenceStartedRef.current ===
          null
        ) {
          silenceStartedRef.current =
            Date.now();
        }

        const silenceDuration =
          Date.now() -
          silenceStartedRef.current;

        if (
          silenceDuration >
          1300
        ) {
          stopListening();
          return;
        }
      }

      silenceFrameRef.current =
        requestAnimationFrame(
          checkAudio,
        );
    };

    checkAudio();
  };

  /*
   * --------------------------------------------------
   * START MICROPHONE
   * --------------------------------------------------
   */

  const startListening =
    async () => {
      if (
        !open ||
        muted ||
        isEndingRef.current ||
        isProcessingRef.current ||
        callPaused ||
        showLocationPrompt ||
        piaState === "thinking" ||
        piaState === "speaking"
      ) {
        return;
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        setErrorMessage(
          "Mikrofon er ikke tilgjengelig i denne nettleseren.",
        );

        setPiaState("error");

        return;
      }

      try {
        setErrorMessage("");

        cleanupRecorder();

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation:
                  true,

                noiseSuppression:
                  true,

                autoGainControl:
                  true,
              },
            },
          );

        if (
          isEndingRef.current
        ) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            );

          return;
        }

        mediaStreamRef.current =
          stream;

        let mimeType = "";

        const possibleTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ];

        for (
          const type of possibleTypes
        ) {
          if (
            MediaRecorder.isTypeSupported(
              type,
            )
          ) {
            mimeType = type;
            break;
          }
        }

        const recorder =
          mimeType
            ? new MediaRecorder(
                stream,
                {
                  mimeType,
                },
              )
            : new MediaRecorder(
                stream,
              );

        mediaRecorderRef.current =
          recorder;

        audioChunksRef.current =
          [];

        voiceDetectedRef.current =
          false;

        silenceStartedRef.current =
          null;

        recorder.ondataavailable =
          (event) => {
            if (
              event.data.size > 0
            ) {
              audioChunksRef.current.push(
                event.data,
              );
            }
          };

        recorder.onerror =
          (event) => {
            console.error(
              "MediaRecorder error:",
              event,
            );

            setErrorMessage(
              "Det oppstod et problem med mikrofonen.",
            );

            setPiaState("idle");

            cleanupRecorder();
          };

        recorder.onstop =
          async () => {
            const chunks =
              audioChunksRef.current;

            const recordingType =
              recorder.mimeType ||
              mimeType ||
              "audio/webm";

            const blob =
              new Blob(
                chunks,
                {
                  type: recordingType,
                },
              );

            cleanupRecorder();

            if (
              isEndingRef.current ||
              callPaused
            ) {
              return;
            }

            if (
              blob.size < 1000
            ) {
              setPiaState("idle");
              return;
            }

            try {
              setPiaState(
                "thinking",
              );

              isProcessingRef.current =
                true;

              const transcript =
                await transcribeAudio(
                  blob,
                );

              isProcessingRef.current =
                false;

              if (
                !transcript
              ) {
                setPiaState("idle");

                if (
                  !muted &&
                  !callPaused
                ) {
                  window.setTimeout(
                    () => {
                      void startListening();
                    },
                    300,
                  );
                }

                return;
              }

              await handleUserSpeech(
                transcript,
              );
            } catch (error) {
              console.error(
                "Voice transcription error:",
                error,
              );

              isProcessingRef.current =
                false;

              setPiaState("idle");

              setErrorMessage(
                "Jeg klarte ikke å høre hva du sa. Prøv igjen.",
              );
            }
          };

        const audioContext =
          new AudioContext();

        audioContextRef.current =
          audioContext;

        const source =
          audioContext.createMediaStreamSource(
            stream,
          );

        const analyser =
          audioContext.createAnalyser();

        analyser.fftSize =
          2048;

        analyser.smoothingTimeConstant =
          0.4;

        source.connect(analyser);

        analyserRef.current =
          analyser;

        recorder.start();

        setPiaState(
          "listening",
        );

        monitorSilence(
          analyser,
        );

        maxRecordingTimerRef.current =
          window.setTimeout(
            () => {
              stopListening();
            },
            20000,
          );
      } catch (error) {
        console.error(
          "Microphone error:",
          error,
        );

        setPiaState("idle");

        setErrorMessage(
          "Pia fikk ikke tilgang til mikrofonen. Kontroller mikrofontillatelsen i nettleseren.",
        );
      }
    };

  /*
   * --------------------------------------------------
   * CONTINUE AFTER CLINIC RESULTS
   * --------------------------------------------------
   */

  const continueTalking = () => {
    setCallPaused(false);

    setShowClinics(false);

    setShowLocationPrompt(false);

    setShowManualLocation(false);

    setErrorMessage("");

    setPiaState("idle");

    /*
     * User explicitly clicked this button,
     * so start another paid voice turn.
     */
    window.setTimeout(() => {
      void startListening();
    }, 100);
  };

  /*
   * --------------------------------------------------
   * END CALL
   * --------------------------------------------------
   */

  const endCall = () => {
    isEndingRef.current =
      true;

    stopListening();

    cleanupRecorder();

    if (audioRef.current) {
      audioRef.current.pause();

      audioRef.current = null;
    }

    setPiaState("idle");

    setLastUserText("");
    setLastPiaText("");

    setErrorMessage("");

    setClinics([]);

    setShowClinics(false);

    setIsSearchingClinics(false);

    setClinicSearchLocation("");

    setShowLocationPrompt(false);

    setShowManualLocation(false);

    setManualLocation("");

    setLocationLoading(false);

    setCallPaused(false);

    historyRef.current = [];

    onClose();

    window.setTimeout(() => {
      isEndingRef.current =
        false;
    }, 300);
  };

  /*
   * --------------------------------------------------
   * CALL START
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!open) return;

    isEndingRef.current =
      false;

    isProcessingRef.current =
      false;

    setPiaState("idle");

    setLastPiaText(
      GREETING,
    );

    setLastUserText("");

    setErrorMessage("");

    setClinics([]);

    setShowClinics(false);

    setIsSearchingClinics(false);

    setClinicSearchLocation("");

    setShowLocationPrompt(false);

    setShowManualLocation(false);

    setManualLocation("");

    setLocationLoading(false);

    setCallPaused(false);

    historyRef.current = [
      {
        sender: "pia",
        text: GREETING,
      },
    ];

    return () => {
      stopListening();

      cleanupRecorder();

      if (audioRef.current) {
        audioRef.current.pause();

        audioRef.current = null;
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  /*
   * --------------------------------------------------
   * DISPLAY HELPERS
   * --------------------------------------------------
   */

  const minutes =
    Math.floor(
      seconds / 60,
    )
      .toString()
      .padStart(2, "0");

  const remainingSeconds =
    (seconds % 60)
      .toString()
      .padStart(2, "0");

  const stateText = {
    idle: "Pia er klar",
    listening:
      "Pia lytter...",
    thinking:
      "Pia tenker...",
    speaking:
      "Pia snakker...",
    paused:
      showClinics
        ? "Klinikker funnet"
        : "Samtalen er satt på pause",
    error:
      "Et problem oppstod",
  }[piaState];

  /*
   * --------------------------------------------------
   * UI
   * --------------------------------------------------
   */

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#cfeeff]">
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#effaff_0%,_#ccecff_42%,_#a9d8f4_100%)]" />

      <div className="absolute left-1/2 top-[43%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/10 shadow-[0_0_100px_rgba(255,255,255,0.8)]" />

      {/* HEADER */}
      <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <div>
          <p className="text-lg font-black text-[#10233f]">
            Pia
          </p>

          <div className="flex items-center gap-2 text-xs font-medium text-[#55768e] sm:text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

            Digital tannlegeresepsjonist
          </div>
        </div>

        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-[#10233f] shadow-lg backdrop-blur-xl sm:px-5 sm:py-2.5"
        >
          Lukk
        </button>
      </div>

      {/* STATUS */}
      <div
        className={`absolute top-20 z-30 text-center transition-all sm:top-24 ${
          showClinics
            ? "left-0 right-0 md:right-[410px]"
            : "inset-x-0"
        }`}
      >
        <p className="text-sm font-bold text-[#47728f]">
          {stateText}
        </p>

        <p className="mt-1 text-base font-semibold text-[#10233f] sm:text-lg">
          {minutes}:{remainingSeconds}
        </p>

        {piaState ===
          "idle" &&
          seconds < 5 &&
          !showLocationPrompt &&
          !showClinics && (
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");

                void speak(
                  lastPiaText ||
                    GREETING,
                  true,
                );
              }}
              className="mt-3 rounded-full bg-[#1689d4] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#0878c2]"
            >
              Start samtalen
            </button>
          )}
      </div>

      {/* PIA AVATAR */}
      <div
        className={`absolute bottom-[150px] top-[120px] z-10 flex items-end justify-center transition-all duration-500 ${
          showClinics
            ? "inset-x-0 md:right-[400px]"
            : "inset-x-0"
        }`}
      >
        <div
          className={`relative flex h-full w-full max-w-[760px] items-end justify-center transition-all duration-500 ${
            piaState === "speaking"
              ? "scale-[1.02]"
              : piaState === "thinking"
                ? "scale-[0.99]"
                : "scale-100"
          }`}
        >
          <img
            src="/pia-avatar.png"
            alt="Pia"
            className={`max-h-full max-w-full select-none object-contain object-bottom drop-shadow-[0_25px_40px_rgba(26,93,139,0.18)] transition-all duration-500 ${
              showClinics
                ? "max-md:-translate-y-[16vh] max-md:scale-[0.78]"
                : ""
            }`}
            draggable={false}
          />

          {piaState ===
            "listening" && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-5 py-2 text-sm font-bold text-[#1689d4] shadow-lg backdrop-blur-xl">
              Lytter...
            </div>
          )}
        </div>
      </div>

      {/* TRANSCRIPT */}
      {!showClinics &&
        !showLocationPrompt && (
          <div className="absolute bottom-[122px] left-1/2 z-20 w-[calc(100%-32px)] max-w-xl -translate-x-1/2">
            {lastPiaText && (
              <div className="line-clamp-2 rounded-2xl bg-white/60 px-4 py-2 text-center text-xs text-[#21445d] shadow-lg backdrop-blur-xl sm:text-sm">
                <span className="font-bold">
                  Pia:{" "}
                </span>

                {lastPiaText}
              </div>
            )}

            {lastUserText && (
              <p className="mt-2 line-clamp-1 text-center text-xs font-medium text-[#4c748d]">
                Du: “{lastUserText}”
              </p>
            )}

            {errorMessage && (
              <p className="mt-2 rounded-xl bg-white/80 px-4 py-2 text-center text-xs font-semibold text-red-500 shadow">
                {errorMessage}
              </p>
            )}
          </div>
        )}

      {/* LOCATION PROMPT */}
      {showLocationPrompt &&
        !showClinics && (
          <div className="absolute bottom-[112px] left-1/2 z-50 w-[calc(100%-28px)] max-w-md -translate-x-1/2 rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_25px_80px_rgba(20,74,110,0.25)] backdrop-blur-2xl">
            {!showManualLocation ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf8ff] text-[#1689d4]">
                    <MapPin size={23} />
                  </div>

                  <h3 className="mt-3 text-lg font-black text-[#10233f]">
                    Hvor befinner du deg?
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#71899b]">
                    Pia trenger posisjonen din for å
                    finne relevante tannklinikker i
                    nærheten.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={locationLoading}
                  onClick={
                    useCurrentLocationForPia
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1689d4] px-5 py-3.5 font-black text-white shadow-lg shadow-[#1689d4]/20 transition hover:bg-[#0878c2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locationLoading ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Navigation size={18} />
                  )}

                  Bruk min posisjon
                </button>

                <button
                  type="button"
                  disabled={locationLoading}
                  onClick={() => {
                    setErrorMessage("");

                    setShowManualLocation(
                      true,
                    );
                  }}
                  className="mt-2 w-full rounded-2xl border border-[#dce8ef] bg-white px-5 py-3.5 font-bold text-[#536e83] transition hover:bg-[#f5f9fb]"
                >
                  Skriv inn sted
                </button>

                {errorMessage && (
                  <p className="mt-3 text-center text-xs font-semibold leading-5 text-red-500">
                    {errorMessage}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf8ff] text-[#1689d4]">
                    <MapPin size={23} />
                  </div>

                  <h3 className="mt-3 text-lg font-black text-[#10233f]">
                    Skriv inn sted
                  </h3>

                  <p className="mt-1 text-sm text-[#71899b]">
                    For eksempel Jessheim, Oslo eller
                    postnummer.
                  </p>
                </div>

                <input
                  type="text"
                  autoFocus
                  value={manualLocation}
                  onChange={(event) => {
                    setManualLocation(
                      event.target.value,
                    );

                    setErrorMessage("");
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      void handleManualLocationForPia();
                    }
                  }}
                  placeholder="By, område eller postnummer"
                  className="mt-4 h-12 w-full rounded-2xl border border-[#dce8ef] bg-[#f7fafc] px-4 text-sm font-semibold text-[#10233f] outline-none placeholder:text-[#9aacb9] focus:ring-2 focus:ring-[#1689d4]/20"
                />

                <button
                  type="button"
                  disabled={
                    locationLoading ||
                    !manualLocation.trim()
                  }
                  onClick={() => {
                    void handleManualLocationForPia();
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1689d4] px-5 py-3.5 font-black text-white shadow-lg shadow-[#1689d4]/20 transition hover:bg-[#0878c2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locationLoading && (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  )}

                  Finn klinikker
                </button>

                <button
                  type="button"
                  disabled={locationLoading}
                  onClick={() => {
                    setErrorMessage("");

                    setShowManualLocation(
                      false,
                    );
                  }}
                  className="mt-2 w-full py-2 text-sm font-bold text-[#71899b]"
                >
                  Tilbake
                </button>

                {errorMessage && (
                  <p className="mt-2 text-center text-xs font-semibold leading-5 text-red-500">
                    {errorMessage}
                  </p>
                )}
              </>
            )}
          </div>
        )}

      {/* CLINIC RESULTS */}
      {showClinics && (
        <ClinicResultsPanel
          clinics={clinics}
          location={
            clinicSearchLocation
          }
          loading={
            isSearchingClinics
          }
          onClose={() => {
            setShowClinics(false);
          }}
        />
      )}

      {/* CONTINUE BUTTON */}
      {showClinics &&
        !isSearchingClinics &&
        clinics.length > 0 &&
        callPaused && (
          <button
            type="button"
            onClick={continueTalking}
            className="absolute bottom-[112px] left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1689d4] px-6 py-3 text-sm font-black text-white shadow-xl shadow-[#1689d4]/25 transition hover:bg-[#0878c2] md:bottom-28 md:left-auto md:right-[420px] md:translate-x-0"
          >
            🎙️ Snakk videre med Pia
          </button>
        )}

      {/* CALL CONTROLS */}
      <div className="absolute inset-x-0 bottom-0 z-50">
        <div className="mx-auto mb-3 flex w-[calc(100%-20px)] max-w-xl items-center justify-center gap-2 rounded-[28px] border border-white/80 bg-white/55 px-2 py-3 shadow-[0_20px_60px_rgba(52,124,170,0.25)] backdrop-blur-2xl sm:mb-4 sm:gap-7 sm:px-5 sm:py-4">
          <CallButton
            label={
              callPaused
                ? "Pauset"
                : piaState ===
                    "listening"
                  ? "Stopp"
                  : "Mikrofon"
            }
            active={
              !muted &&
              !callPaused
            }
            disabled={
              callPaused ||
              showLocationPrompt
            }
            onClick={() => {
              if (
                callPaused ||
                showLocationPrompt
              ) {
                return;
              }

              if (
                piaState ===
                "listening"
              ) {
                stopListening();
                return;
              }

              if (muted) {
                setMuted(false);

                window.setTimeout(
                  () => {
                    void startListening();
                  },
                  100,
                );

                return;
              }

              void startListening();
            }}
          >
            {muted ||
            callPaused ? (
              <MicOff size={23} />
            ) : (
              <Mic size={23} />
            )}
          </CallButton>

          <CallButton
            label="Melding"
            onClick={() => {
              endCall();

              window.setTimeout(
                () => {
                  window.dispatchEvent(
                    new Event(
                      "open-pia-chat",
                    ),
                  );
                },
                150,
              );
            }}
          >
            <MessageCircle size={23} />
          </CallButton>

          <button
            type="button"
            onClick={endCall}
            className="flex flex-col items-center gap-1.5 sm:gap-2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/30 transition hover:scale-105 hover:bg-red-600 sm:h-16 sm:w-16">
              <PhoneOff size={28} />
            </span>

            <span className="text-[10px] font-bold text-[#52738a] sm:text-[11px]">
              Legg på
            </span>
          </button>

          <CallButton
            label="Høyttaler"
            active={speaker}
            onClick={() => {
              const next =
                !speaker;

              setSpeaker(next);

              if (
                !next &&
                audioRef.current
              ) {
                audioRef.current.pause();

                audioRef.current =
                  null;

                setPiaState(
                  callPaused
                    ? "paused"
                    : "idle",
                );
              }
            }}
          >
            {speaker ? (
              <Volume2 size={23} />
            ) : (
              <VolumeX size={23} />
            )}
          </CallButton>
        </div>
      </div>
    </div>
  );
}

/*
 * --------------------------------------------------
 * CLINIC RESULTS PANEL
 * --------------------------------------------------
 */

interface ClinicResultsPanelProps {
  clinics: Clinic[];
  location: string;
  loading: boolean;
  onClose: () => void;
}

function ClinicResultsPanel({
  clinics,
  location,
  loading,
  onClose,
}: ClinicResultsPanelProps) {
  return (
    <div
      className="
        absolute
        bottom-[105px]
        left-3
        right-3
        z-40
        max-h-[43vh]
        overflow-hidden
        rounded-[28px]
        border
        border-white/80
        bg-white/95
        shadow-[0_25px_80px_rgba(20,74,110,0.28)]
        backdrop-blur-2xl

        md:bottom-[105px]
        md:left-auto
        md:right-5
        md:top-[92px]
        md:max-h-none
        md:w-[380px]
      "
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#e3edf3] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2
              size={18}
              className="text-[#1689d4]"
            />

            <p className="font-black text-[#10233f]">
              Tannklinikker
            </p>
          </div>

          {location && (
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#71899b]">
              <MapPin size={13} />

              {location}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eff6fa] text-[#60798c] transition hover:bg-[#e3eef5]"
          aria-label="Lukk klinikker"
        >
          <X size={18} />
        </button>
      </div>

      {loading && (
        <div className="flex min-h-32 flex-col items-center justify-center px-6 py-8 text-center">
          <Loader2
            size={28}
            className="animate-spin text-[#1689d4]"
          />

          <p className="mt-3 font-bold text-[#10233f]">
            Finner klinikker…
          </p>

          <p className="mt-1 text-xs text-[#7890a2]">
            Pia søker etter relevante alternativer
            nær deg.
          </p>
        </div>
      )}

      {!loading &&
        clinics.length === 0 && (
          <div className="px-6 py-8 text-center">
            <Building2
              size={30}
              className="mx-auto text-[#9cb0bf]"
            />

            <p className="mt-3 font-bold text-[#10233f]">
              Ingen klinikker funnet
            </p>

            <p className="mt-1 text-sm text-[#7890a2]">
              Prøv et annet sted eller start en ny
              samtale med Pia.
            </p>
          </div>
        )}

      {!loading &&
        clinics.length > 0 && (
          <div className="max-h-[calc(43vh-72px)] space-y-3 overflow-y-auto p-3 md:max-h-[calc(100vh-285px)]">
            {clinics.map(
              (clinic) => (
                <ClinicCallCard
                  key={clinic.id}
                  clinic={clinic}
                />
              ),
            )}
          </div>
        )}
    </div>
  );
}

/*
 * --------------------------------------------------
 * CLINIC CARD
 * --------------------------------------------------
 */

function ClinicCallCard({
  clinic,
}: {
  clinic: Clinic;
}) {
  return (
    <article className="rounded-[20px] border border-[#deebf2] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-[#10233f] sm:text-base">
            {clinic.name}
          </h3>

          {clinic.address && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-[#72899b]">
              <MapPin
                size={14}
                className="mt-0.5 shrink-0 text-[#14b8c4]"
              />

              <span>
                {clinic.address}
              </span>
            </div>
          )}
        </div>

        {clinic.rating !==
          undefined &&
          clinic.rating !==
            null && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-[#10233f]">
              <Star
                size={13}
                className="fill-current text-amber-400"
              />

              {clinic.rating}
            </div>
          )}
      </div>

      {clinic.reviewCount !==
        undefined &&
        clinic.reviewCount !==
          null && (
          <p className="mt-2 text-[11px] text-[#91a3b0]">
            {clinic.reviewCount.toLocaleString(
              "nb-NO",
            )}{" "}
            anmeldelser
          </p>
        )}

      <div className="mt-3 flex flex-wrap gap-2">
        {clinic.website && (
          <a
            href={clinic.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#10233f] px-3 py-2 text-xs font-bold text-white"
          >
            <Globe2 size={14} />

            Nettside
          </a>
        )}

        {clinic.phone && (
          <a
            href={`tel:${clinic.phone.replace(
              /[^\d+]/g,
              "",
            )}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#14c8d4] px-3 py-2 text-xs font-bold text-white"
          >
            <Phone size={14} />

            Ring
          </a>
        )}

        {clinic.googleMapsUrl && (
          <a
            href={
              clinic.googleMapsUrl
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce7ed] bg-white px-3 py-2 text-xs font-bold text-[#536e83]"
          >
            <MapPin size={14} />

            Kart
          </a>
        )}
      </div>
    </article>
  );
}

/*
 * --------------------------------------------------
 * CALL CONTROL BUTTON
 * --------------------------------------------------
 */

interface CallButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function CallButton({
  label,
  active = true,
  disabled = false,
  onClick,
  children,
}: CallButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition sm:h-14 sm:w-14 ${
          active
            ? "border-white/80 bg-white/80 text-[#1689d4]"
            : "border-white/40 bg-white/25 text-[#6f8798]"
        }`}
      >
        {children}
      </span>

      <span className="text-[10px] font-bold text-[#52738a] sm:text-[11px]">
        {label}
      </span>
    </button>
  );
}
