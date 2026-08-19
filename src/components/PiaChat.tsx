import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  CheckCircle2,
  Globe2,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

import { searchClinics } from "@/services/clinicService";

import { sendMessageToPia } from "@/services/piaService";

import {
  getReasonLabel,
  savePatientReferral,
} from "@/services/referralService";

import type {
  ChatMessage,
  Clinic,
  CollectedPatientData,
  ConversationStep,
} from "@/types/pia";

type PiaAvatarState =
  | "idle"
  | "thinking"
  | "searching"
  | "saving";

type LocationConsent =
  | "prompt"
  | "granted"
  | "not_now";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface PiaAvatarProps {
  state?: PiaAvatarState;
  size?: number;
  showOnlineDot?: boolean;
}

function isValidPhone(
  value: string,
) {
  const digits = value.replace(
    /\D/g,
    "",
  );

  return (
    digits.length >= 8
  );
}

function isSimpleGreeting(
  value: string,
) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(
      /[!?.,]/g,
      "",
    );

  return [
    "hei",
    "hey",
    "heisann",
    "hallo",
    "hello",
    "hi",
    "yo",
  ].includes(
    normalized,
  );
}

function getTreatmentOptions(
  clinics: Clinic[],
) {
  return Array.from(
    new Set(
      clinics.flatMap(
        (clinic) =>
          Array.isArray(clinic.prices)
            ? clinic.prices
                .map((price) => price.treatment?.trim())
                .filter(
                  (treatment): treatment is string =>
                    Boolean(treatment),
                )
            : [],
      ),
    ),
  ).sort((a, b) =>
    a.localeCompare(
      b,
      "nb-NO",
    )
  );
}

function formatPhoneLink(
  value: string,
) {
  return value.replace(
    /[^\d+]/g,
    "",
  );
}

function PiaAvatar({
  state = "idle",
  size = 52,
  showOnlineDot = false,
}: PiaAvatarProps) {
  const isBusy = state !== "idle";

  const animationClass = state ===
      "searching"
    ? "pia-avatar-searching"
    : state ===
          "thinking" ||
        state ===
          "saving"
    ? "pia-avatar-thinking"
    : "pia-avatar-idle";

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: size,
        height: size,
      }}
    >
      {isBusy && (
        <>
          <span className="pia-avatar-halo absolute -inset-2 rounded-full bg-[#14c8d4]/25 blur-md" />

          <span className="pia-avatar-orbit pia-avatar-orbit-two absolute h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        </>
      )}

      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/80 bg-gradient-to-b from-[#e9fcff] to-[#d8f4fa] shadow-[0_8px_25px_rgba(13,30,61,0.16)]">
        <img
          src="/pia-avatar.png"
          alt="Pia"
          className={`h-full w-full object-cover ${animationClass}`}
        />

        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#14c8d4]/8 to-transparent" />
      </div>

      {showOnlineDot && (
        <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
      )}
    </div>
  );
}

export default function PiaChat() {
  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    step,
    setStep,
  ] = useState<ConversationStep>(
    "greeting",
  );

  const [
    messages,
    setMessages,
  ] = useState<
    ChatMessage[]
  >([]);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    isTyping,
    setIsTyping,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isSearching,
    setIsSearching,
  ] = useState(false);

  const [
    isRefreshingPrices,
    setIsRefreshingPrices,
  ] = useState(false);

  const [
    selectedTreatment,
    setSelectedTreatment,
  ] = useState("");

  const [
    coordinates,
    setCoordinates,
  ] = useState<Coordinates | null>(
    null,
  );

  const [
    locationConsent,
    setLocationConsent,
  ] = useState<LocationConsent>(
    "prompt",
  );

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    collected,
    setCollected,
  ] = useState<CollectedPatientData>(
    {},
  );

  const scrollRef = useRef<HTMLDivElement>(
    null,
  );

  const searchAbortRef = useRef<AbortController | null>(
    null,
  );

  const pendingClinicSearchRef = useRef<{
    treatment?: string;
  } | null>(null);

  const piaAvatarState: PiaAvatarState = isSearching ||
      isRefreshingPrices
    ? "searching"
    : isSaving
    ? "saving"
    : isTyping
    ? "thinking"
    : "idle";

  /*
   * If the user has previously granted
   * location use to Pocket Dentist,
   * reuse that permission on future opens.
   *
   * We store permission intent only.
   * Coordinates themselves are NOT stored.
   */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        "pocket-dentist-location",
      );

      if (
        saved ===
          "granted"
      ) {
        setLocationConsent(
          "granted",
        );

        if (
          navigator.geolocation
        ) {
          navigator.geolocation.getCurrentPosition(
            (
              position,
            ) => {
              setCoordinates(
                {
                  latitude: position
                    .coords
                    .latitude,

                  longitude: position
                    .coords
                    .longitude,
                },
              );
            },
            () => {
              setCoordinates(
                null,
              );
            },
            {
              enableHighAccuracy: false,

              timeout: 8000,

              maximumAge: 300000,
            },
          );
        }
      }
    } catch {
      // Local storage is optional.
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(
      {
        top: scrollRef
          .current
          .scrollHeight,

        behavior: "smooth",
      },
    );
  }, [
    messages,
    isTyping,
    isSearching,
    isRefreshingPrices,
    isSaving,
  ]);

  const startConversation = () => {
    searchAbortRef.current?.abort();

    setCollected(
      {},
    );

    setInput(
      "",
    );

    setIsTyping(
      false,
    );

    setIsSaving(
      false,
    );

    setIsSearching(
      false,
    );

    setIsRefreshingPrices(
      false,
    );

    setSelectedTreatment(
      "",
    );

    setMessages([
      {
        sender: "pia",

        text: "Hei! 😊 Jeg er Pia. Hva kan jeg hjelpe deg med i dag?",

        options: [
          "Jeg har tannpine",
          "Jeg trenger en kontroll",
          "Jeg har knekt en tann",
          "Jeg vil sammenligne priser",
        ],
      },
    ]);

    setStep(
      "greeting",
    );
  };

  useEffect(() => {
    if (
      isOpen &&
      messages.length ===
        0
    ) {
      startConversation();
    }
  }, [
    isOpen,
    messages.length,
  ]);

  useEffect(() => {
    const openChat = () =>
      setIsOpen(
        true,
      );

    window.addEventListener(
      "open-pia-chat",
      openChat,
    );

    return () => {
      window.removeEventListener(
        "open-pia-chat",
        openChat,
      );
    };
  }, []);

  const addPiaMessage = (
    message: ChatMessage,
  ) => {
    setMessages(
      (
        current,
      ) => [
        ...current,
        message,
      ],
    );
  };

  const updateLatestClinicMessage = (
    clinics: Clinic[],
  ) => {
    setMessages(
      (
        current,
      ) => {
        const next = [
          ...current,
        ];

        for (
          let index = next.length -
            1;
          index >= 0;
          index--
        ) {
          if (
            next[
                index
              ]
                .sender ===
              "pia" &&
            Array.isArray(
              next[
                index
              ]
                .clinics,
            )
          ) {
            next[
              index
            ] = {
              ...next[
                index
              ],

              clinics,
            };

            break;
          }
        }

        return next;
      },
    );
  };

  const requestLocation = () => {
    setLocationError(
      "",
    );

    if (
      !navigator.geolocation
    ) {
      setLocationError(
        "Nettleseren støtter ikke posisjon.",
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (
        position,
      ) => {
        const nextCoordinates = {
          latitude: position
            .coords
            .latitude,

          longitude: position
            .coords
            .longitude,
        };

        setCoordinates(
          nextCoordinates,
        );

        setLocationConsent(
          "granted",
        );

        try {
          window.localStorage.setItem(
            "pocket-dentist-location",
            "granted",
          );
        } catch {
          // Optional.
        }

        const pendingSearch = pendingClinicSearchRef.current;

        if (pendingSearch) {
          pendingClinicSearchRef.current = null;

          void searchForClinics(
            undefined,
            pendingSearch.treatment,
            nextCoordinates,
          );
        }
      },
      () => {
        setCoordinates(
          null,
        );

        setLocationError(
          "Posisjonstilgang ble ikke gitt. Pia kan fortsatt spørre etter by eller postnummer når det trengs.",
        );
      },
      {
        enableHighAccuracy: false,

        timeout: 10000,

        maximumAge: 300000,
      },
    );
  };

  async function searchForClinics(
    locationAnswer?: string,
    treatment?: string,
    coordinateOverride?: Coordinates | null,
  ) {
    const explicitLocation = locationAnswer?.trim() ??
      "";

    const activeCoordinates = coordinateOverride ?? coordinates;

    const canUseCoordinates = !explicitLocation &&
      activeCoordinates !==
        null;

    if (
      !explicitLocation &&
      !canUseCoordinates
    ) {
      addPiaMessage({
        sender: "pia",

        text: "Hvor vil du finne tannlege? Du kan skrive by eller postnummer.",
      });

      return;
    }

    searchAbortRef.current?.abort();

    const controller = new AbortController();

    searchAbortRef.current = controller;

    setIsSearching(
      true,
    );

    setIsRefreshingPrices(
      false,
    );

    setSelectedTreatment(
      "",
    );

    const locationLabel = explicitLocation ||
      "i nærheten av deg";

    setCollected(
      (
        current,
      ) => ({
        ...current,

        location: explicitLocation ||
          current.location ||
          "Din posisjon",

        reason: treatment ??
          current.reason,
      }),
    );

    let hasShownClinicMessage = false;

    try {
      const result = await searchClinics(
        {
          location: explicitLocation ||
            undefined,

          latitude: canUseCoordinates ? activeCoordinates?.latitude : undefined,

          longitude: canUseCoordinates ? activeCoordinates?.longitude : undefined,

          treatment: treatment ??
            collected.reason,

          maxResults: 5,

          signal: controller.signal,

          onUpdate: (
            update,
          ) => {
            if (
              controller
                .signal
                .aborted
            ) {
              return;
            }

            /*
             * Initial Google clinic search
             * has completed. The patient
             * can already inspect results
             * while background workers
             * continue fetching prices.
             */
            setIsSearching(
              false,
            );

            setIsRefreshingPrices(
              !update.complete &&
                update.missingPrices >
                  0,
            );

            if (
              !hasShownClinicMessage
            ) {
              hasShownClinicMessage = true;

              addPiaMessage(
                {
                  sender: "pia",

                  text:
                    `Jeg fant ${update.clinics.length} aktuelle klinikker ${locationLabel}. ` +
                    (update.missingPrices >
                        0
                      ? "Jeg henter noen av prisene nå."
                      : "Her er prisene jeg fant."),

                  clinics: update.clinics,
                },
              );

              setStep(
                "clinicSelection",
              );

              return;
            }

            updateLatestClinicMessage(
              update.clinics,
            );
          },
        },
      );

      if (
        controller
          .signal
          .aborted
      ) {
        return;
      }

      if (
        result.clinics
          .length ===
          0
      ) {
        if (
          !hasShownClinicMessage
        ) {
          addPiaMessage(
            {
              sender: "pia",

              text: explicitLocation
                ? `Jeg fant ingen tannklinikker for «${explicitLocation}». Prøv gjerne et nærliggende sted eller postnummer.`
                : "Jeg fant ingen tannklinikker i nærheten akkurat nå.",
            },
          );
        }

        return;
      }

      if (
        !hasShownClinicMessage
      ) {
        addPiaMessage({
          sender: "pia",

          text:
            `Jeg fant ${result.clinics.length} aktuelle klinikker ${locationLabel}.`,

          clinics: result.clinics,
        });

        setStep(
          "clinicSelection",
        );
      } else {
        updateLatestClinicMessage(
          result.clinics,
        );
      }
    } catch (error) {
      if (
        controller
          .signal
          .aborted
      ) {
        return;
      }

      console.error(
        "Kunne ikke søke etter klinikker:",
        error,
      );

      addPiaMessage({
        sender: "pia",

        text:
          "Beklager, jeg klarte ikke å hente klinikker akkurat nå. Prøv gjerne igjen om litt.",
      });
    } finally {
      if (
        !controller
          .signal
          .aborted
      ) {
        setIsSearching(
          false,
        );

        setIsRefreshingPrices(
          false,
        );
      }
    }
  }

  const handleNaturalMessage = async (
    answer: string,
    historyBeforeUserMessage: ChatMessage[],
  ) => {
    setIsTyping(
      true,
    );

    try {
      const pia = await sendMessageToPia(
        answer,
        historyBeforeUserMessage,
        "chat",
      );

      const updatedData: CollectedPatientData = {
        ...collected,

        location: pia.extracted
          .location ??
          collected.location,

        reason: pia.extracted
          .treatment ??
          collected.reason,

        severity: pia.extracted
            .severity !==
            null
          ? String(
            pia
              .extracted
              .severity,
          )
          : collected.severity,

        duration: pia.extracted
          .duration ??
          collected.duration,
      };

      setCollected(
        updatedData,
      );

      const location = pia.extracted
        .location ??
        updatedData.location;

      const treatment = pia.extracted
        .treatment ??
        updatedData.reason;

      const normalSearchRequest = pia.actions.includes(
        "search_clinics",
      ) ||
        pia.actions.includes(
          "compare_prices",
        ) ||
        pia.extracted
          .wantsClinicSearch ||
        pia.extracted
          .wantsPriceComparison;

      const requestsLocation = pia.actions.includes(
        "request_location",
      );

      /*
       * The shared pia-ai backend also serves voice calls, where spoken
       * place names should still be confirmed. In text chat, however, a
       * typed place name is already a usable search location. If browser
       * coordinates are available, they are usable too.
       */
      const canAutoContinueLocationRequest = requestsLocation &&
        (Boolean(
          pia.extracted.location?.trim(),
        ) || Boolean(coordinates));

      if (
        canAutoContinueLocationRequest
      ) {
        addPiaMessage({
          sender: "pia",

          text: pia.extracted.location
            ? `Klart. Jeg finner aktuelle tannklinikker i ${pia.extracted.location}.`
            : "Klart. Jeg bruker posisjonen din og finner aktuelle klinikker i nærheten.",
        });
      } else {
        addPiaMessage({
          sender: "pia",

          text: pia.message,
        });
      }

      if (
        requestsLocation &&
        !canAutoContinueLocationRequest
      ) {
        /*
         * Remember the treatment so clicking "Bruk posisjonen min"
         * immediately continues the search instead of forcing the user
         * to type "I shared it" or repeat the request.
         */
        pendingClinicSearchRef.current = {
          treatment,
        };

        setLocationConsent(
          "prompt",
        );
      } else {
        pendingClinicSearchRef.current = null;
      }

      if (
        pia.actions.includes(
          "show_emergency_advice",
        ) ||
        pia.extracted
          .emergencyWarning
      ) {
        return;
      }

      const shouldSearch = normalSearchRequest ||
        canAutoContinueLocationRequest;

      if (
        shouldSearch &&
        (location ||
          coordinates)
      ) {
        /*
         * OpenAI has finished thinking.
         * Clinic searching gets its own
         * visual avatar state from here.
         */
        setIsTyping(
          false,
        );

        await searchForClinics(
          pia.extracted
            .location ??
            undefined,
          treatment,
        );
      }
    } catch (error) {
      console.error(
        "Pia conversation error:",
        error,
      );

      addPiaMessage({
        sender: "pia",

        text:
          "Beklager, jeg klarte ikke å behandle meldingen akkurat nå. Prøv gjerne igjen.",
      });
    } finally {
      setIsTyping(
        false,
      );
    }
  };

  const selectClinic = (
    clinic: Clinic,
  ) => {
    searchAbortRef.current?.abort();

    setIsRefreshingPrices(
      false,
    );

    setMessages(
      (
        current,
      ) => [
        ...current,

        {
          sender: "user",

          text: `Jeg velger ${clinic.name}`,
        },
      ],
    );

    setCollected(
      (
        current,
      ) => ({
        ...current,

        selectedClinic: clinic,
      }),
    );

    addPiaMessage({
      sender: "pia",

      text: `${clinic.name} er valgt. Hva heter du?`,

      referral: {
        clinicId: clinic.id,

        clinicName: clinic.name,

        reason: getReasonLabel(
          collected.reason,
        ),
      },
    });

    setStep(
      "name",
    );
  };

  const saveReferral = async (
    data: CollectedPatientData,
  ) => {
    if (
      !data.selectedClinic
    ) {
      addPiaMessage({
        sender: "pia",

        text: "Du må velge en klinikk før forespørselen kan sendes.",
      });

      setStep(
        "clinicSelection",
      );

      return;
    }

    setIsSaving(
      true,
    );

    setStep(
      "saving",
    );

    try {
      const result = await savePatientReferral(
        data,
      );

      addPiaMessage({
        sender: "pia",

        text: `Takk, ${data.patientName}! Forespørselen er registrert ` +
          `for ${result.clinic.name}. Klinikken kan kontakte deg på ${data.patientPhone}.`,

        referral: {
          clinicId: result
            .clinic
            .id,

          clinicName: result
            .clinic
            .name,

          reason: result.reasonLabel,
        },

        options: [
          "Ferdig",
        ],
      });

      setStep(
        "done",
      );
    } catch (error) {
      console.error(
        "Kunne ikke lagre henvisningen:",
        error,
      );

      addPiaMessage({
        sender: "pia",

        text:
          "Beklager, noe gikk galt da forespørselen skulle lagres. Ingen forespørsel ble bekreftet.",

        options: [
          "Prøv på nytt",
          "Start på nytt",
        ],
      });

      setStep(
        "consent",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  };

  const processAnswer = async (
    answer: string,
    historyBeforeUserMessage: ChatMessage[],
  ) => {
    if (
      step ===
        "clinicSelection"
    ) {
      addPiaMessage({
        sender: "pia",

        text: "Velg en av klinikkene i listen før vi går videre.",
      });

      return;
    }

    if (
      step ===
        "greeting" &&
      isSimpleGreeting(
        answer,
      )
    ) {
      addPiaMessage({
        sender: "pia",

        text: "Hei 😊 Hva kan jeg hjelpe deg med?",
      });

      return;
    }

    if (
      step ===
        "name"
    ) {
      const patientName = answer.trim();

      if (
        patientName.length <
          2
      ) {
        addPiaMessage({
          sender: "pia",

          text:
            "Skriv inn navnet ditt, så klinikken vet hvem de skal kontakte.",
        });

        return;
      }

      setCollected(
        (
          current,
        ) => ({
          ...current,
          patientName,
        }),
      );

      addPiaMessage({
        sender: "pia",

        text:
          `Hyggelig å møte deg, ${patientName}! Hva er telefonnummeret ditt?`,
      });

      setStep(
        "phone",
      );

      return;
    }

    if (
      step ===
        "phone"
    ) {
      if (
        !isValidPhone(
          answer,
        )
      ) {
        addPiaMessage({
          sender: "pia",

          text: "Telefonnummeret ser litt kort ut. Skriv inn minst 8 sifre.",
        });

        return;
      }

      const patientPhone = answer.trim();

      const finalData: CollectedPatientData = {
        ...collected,
        patientPhone,
      };

      setCollected(
        finalData,
      );

      const clinic = finalData.selectedClinic;

      if (
        !clinic
      ) {
        addPiaMessage({
          sender: "pia",

          text: "Jeg finner ikke den valgte klinikken. Velg klinikk på nytt.",
        });

        setStep(
          "clinicSelection",
        );

        return;
      }

      addPiaMessage({
        sender: "pia",

        text:
          `Da har jeg det jeg trenger. Kan jeg sende forespørselen til ${clinic.name} med navnet og telefonnummeret ditt?`,

        options: [
          "Ja, send forespørselen",
          "Nei takk",
        ],

        referral: {
          clinicId: clinic.id,

          clinicName: clinic.name,

          reason: getReasonLabel(
            finalData.reason,
          ),
        },
      });

      setStep(
        "consent",
      );

      return;
    }

    if (
      step ===
        "consent"
    ) {
      if (
        answer ===
          "Start på nytt"
      ) {
        startConversation();
        return;
      }

      if (
        answer ===
          "Prøv på nytt"
      ) {
        await saveReferral(
          collected,
        );

        return;
      }

      if (
        answer
          .toLowerCase()
          .startsWith(
            "ja",
          )
      ) {
        await saveReferral(
          collected,
        );

        return;
      }

      addPiaMessage({
        sender: "pia",

        text: "Helt i orden. Opplysningene dine ble ikke sendt eller lagret.",

        options: [
          "Start på nytt",
        ],
      });

      setStep(
        "done",
      );

      return;
    }

    if (
      step ===
        "done"
    ) {
      if (
        answer ===
          "Start på nytt" ||
        answer ===
          "Prøv på nytt"
      ) {
        startConversation();
        return;
      }

      addPiaMessage({
        sender: "pia",

        text: "Takk for at du brukte Pocket Dentist. God bedring! 😊",
      });

      return;
    }

    await handleNaturalMessage(
      answer,
      historyBeforeUserMessage,
    );
  };

  const submitAnswer = (
    answer: string,
  ) => {
    if (
      !answer.trim() ||
      isSaving ||
      isSearching ||
      isTyping
    ) {
      return;
    }

    const trimmedAnswer = answer.trim();

    const historyBeforeUserMessage = messages;

    setMessages(
      (
        current,
      ) => [
        ...current,

        {
          sender: "user",

          text: trimmedAnswer,
        },
      ],
    );

    setInput(
      "",
    );

    void processAnswer(
      trimmedAnswer,
      historyBeforeUserMessage,
    );
  };

  const reset = () => {
    searchAbortRef.current?.abort();

    setMessages(
      [],
    );

    setStep(
      "greeting",
    );

    setCollected(
      {},
    );

    setInput(
      "",
    );

    setIsTyping(
      false,
    );

    setIsSaving(
      false,
    );

    setIsSearching(
      false,
    );

    setIsRefreshingPrices(
      false,
    );

    window.setTimeout(
      startConversation,
      0,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    submitAnswer(
      input,
    );
  };

  return (
    <>
      <style>
        {`
                @keyframes piaIdle {
                    0%, 100% {
                        transform:
                            translateY(0px)
                            translateX(0px)
                            rotate(0deg)
                            scale(1);
                    }

                    25% {
                        transform:
                            translateY(-2px)
                            translateX(0.5px)
                            rotate(0.4deg)
                            scale(1.012);
                    }

                    50% {
                        transform:
                            translateY(-3px)
                            translateX(0px)
                            rotate(0deg)
                            scale(1.02);
                    }

                    75% {
                        transform:
                            translateY(-1px)
                            translateX(-0.5px)
                            rotate(-0.4deg)
                            scale(1.01);
                    }
                }

                @keyframes piaThinking {
                    0%, 100% {
                        transform:
                            translateY(0)
                            rotate(-0.5deg)
                            scale(1);
                    }

                    50% {
                        transform:
                            translateY(-4px)
                            rotate(0.8deg)
                            scale(1.035);
                    }
                }

                @keyframes piaSearching {
                    0%, 100% {
                        transform:
                            translateX(0)
                            translateY(0)
                            scale(1);
                    }

                    25% {
                        transform:
                            translateX(-2px)
                            translateY(-2px)
                            scale(1.025);
                    }

                    50% {
                        transform:
                            translateX(0)
                            translateY(-3px)
                            scale(1.035);
                    }

                    75% {
                        transform:
                            translateX(2px)
                            translateY(-2px)
                            scale(1.025);
                    }
                }

                @keyframes piaHalo {
                    0%, 100% {
                        opacity: 0.25;
                        transform: scale(0.92);
                    }

                    50% {
                        opacity: 0.85;
                        transform: scale(1.12);
                    }
                }

                @keyframes piaRing {
                    0% {
                        opacity: 0.8;
                        transform: scale(0.94);
                    }

                    100% {
                        opacity: 0;
                        transform: scale(1.42);
                    }
                }

                @keyframes piaOrbit {
                    0% {
                        transform:
                            rotate(0deg)
                            translateX(36px)
                            rotate(0deg);
                    }

                    100% {
                        transform:
                            rotate(360deg)
                            translateX(36px)
                            rotate(-360deg);
                    }
                }

                @keyframes piaOrbitReverse {
                    0% {
                        transform:
                            rotate(360deg)
                            translateX(31px)
                            rotate(-360deg);
                    }

                    100% {
                        transform:
                            rotate(0deg)
                            translateX(31px)
                            rotate(0deg);
                    }
                }

                @keyframes piaMessageEnter {
                    0% {
                        opacity: 0;
                        transform:
                            translateY(4px)
                            scale(0.94);
                    }

                    100% {
                        opacity: 1;
                        transform:
                            translateY(0)
                            scale(1);
                    }
                }

                .pia-avatar-idle {
                    animation:
                        piaIdle
                        4.5s
                        ease-in-out
                        infinite;

                    transform-origin:
                        center bottom;
                }

                .pia-avatar-thinking {
                    animation:
                        piaThinking
                        1.3s
                        ease-in-out
                        infinite;

                    transform-origin:
                        center bottom;
                }

                .pia-avatar-searching {
                    animation:
                        piaSearching
                        0.95s
                        ease-in-out
                        infinite;

                    transform-origin:
                        center bottom;
                }

                .pia-avatar-halo {
                    animation:
                        piaHalo
                        1.35s
                        ease-in-out
                        infinite;
                }

                .pia-avatar-ring {
                    animation:
                        piaRing
                        1.4s
                        ease-out
                        infinite;
                }

                .pia-avatar-orbit {
                    left: 50%;
                    top: 50%;
                    transform-origin: 0 0;
                }

                .pia-avatar-orbit-one {
                    animation:
                        piaOrbit
                        2.2s
                        linear
                        infinite;
                }

                .pia-avatar-orbit-two {
                    animation:
                        piaOrbitReverse
                        3s
                        linear
                        infinite;
                }

                .pia-message-avatar {
                    animation:
                        piaMessageEnter
                        300ms
                        ease-out;
                }

                @media (
                    prefers-reduced-motion:
                    reduce
                ) {
                    .pia-avatar-idle,
                    .pia-avatar-thinking,
                    .pia-avatar-searching,
                    .pia-avatar-halo,
                    .pia-avatar-ring,
                    .pia-avatar-orbit,
                    .pia-message-avatar {
                        animation:
                            none !important;
                    }
                }
            `}
      </style>

      {!isOpen && (
        <button
          type="button"
          onClick={() =>
            setIsOpen(
              true,
            )}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-[#14c8d4] py-1.5 pl-1.5 pr-5 text-white shadow-xl shadow-[#14c8d4]/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0fb3be]"
        >
          <PiaAvatar
            state="idle"
            size={56}
            showOnlineDot
          />

          <span className="text-sm font-semibold">
            Snakk med Pia
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[430px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-2xl">
          <div className="relative flex items-center justify-between overflow-hidden bg-gradient-to-r from-[#0d1e3d] to-[#143a6e] px-4 py-3.5">
            <div className="absolute -left-10 top-0 h-28 w-28 rounded-full bg-[#14c8d4]/10 blur-2xl" />

            <div className="relative flex items-center gap-3">
              <PiaAvatar
                state={piaAvatarState}
                size={64}
                showOnlineDot
              />

              <div>
                <p className="text-base font-semibold text-white">
                  Pia
                </p>

                <p className="mt-0.5 text-xs text-white/55">
                  {isSearching
                    ? "Finner klinikker…"
                    : isRefreshingPrices
                    ? "Henter priser…"
                    : isSaving
                    ? "Sender forespørselen…"
                    : isTyping
                    ? "Tenker…"
                    : coordinates
                    ? "Digital tannlegeresepsjonist · Posisjon aktiv"
                    : "Digital tannlegeresepsjonist · Online"}
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Nullstill samtalen"
              >
                <RotateCcw
                  size={16}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsOpen(
                    false,
                  )}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Lukk chat"
              >
                <X
                  size={19}
                />
              </button>
            </div>
          </div>

          {locationConsent ===
              "prompt" && (
            <div className="border-b border-[#dcebef] bg-[#f4fbfc] px-4 py-3">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#14c8d4]/10">
                  <Navigation
                    size={15}
                    className="text-[#0daeba]"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#0d1e3d]">
                    Finn klinikker nær deg
                  </p>

                  <p className="mt-1 text-[11px] leading-4 text-gray-500">
                    Pia kan bruke posisjonen din når hun søker etter
                    tannklinikker. Vi lagrer ikke posisjonen din i nettleseren.
                  </p>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="rounded-lg bg-[#14c8d4] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0fb3be]"
                    >
                      Bruk posisjonen min
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setLocationConsent(
                          "not_now",
                        )}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-white"
                    >
                      Ikke nå
                    </button>
                  </div>

                  {locationError && (
                    <p className="mt-2 text-[11px] text-red-500">
                      {locationError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {locationConsent ===
              "granted" &&
            coordinates && (
            <div className="flex items-center gap-2 border-b border-[#e7eff3] bg-white px-4 py-2 text-[11px] font-medium text-[#527182]">
              <ShieldCheck
                size={13}
                className="text-emerald-500"
              />

              Pia bruker posisjonen din for klinikksøk
            </div>
          )}

          <div
            ref={scrollRef}
            className="min-h-[340px] max-h-[540px] flex-1 space-y-3 overflow-y-auto bg-[#f7f9fb] p-3.5"
          >
            {messages.map(
              (
                message,
                index,
              ) => (
                <div
                  key={`${message.text}-${index}`}
                  className={`flex gap-2.5 ${
                    message.sender ===
                        "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.sender ===
                      "pia" && (
                    <div className="pia-message-avatar mt-auto">
                      <PiaAvatar
                        state="idle"
                        size={36}
                      />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] ${
                      message.sender ===
                          "pia"
                        ? "w-full"
                        : ""
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                        message.sender ===
                            "pia"
                          ? "rounded-bl-sm border border-gray-100 bg-white text-gray-700"
                          : "rounded-br-sm bg-[#14c8d4] text-white"
                      }`}
                    >
                      {message.text}
                    </div>

                    {message.clinics &&
                      message
                          .clinics
                          .length >
                        0 &&
                      (
                        <div className="mt-2.5 space-y-2.5">
                          <div className="rounded-2xl border border-[#dfe8ee] bg-white p-3.5 shadow-sm">
                            <label
                              htmlFor={`treatment-${index}`}
                              className="mb-1.5 block text-xs font-semibold text-[#0d1e3d]"
                            >
                              Velg behandling for å se pris
                            </label>

                            <select
                              id={`treatment-${index}`}
                              value={selectedTreatment}
                              onChange={(event) =>
                                setSelectedTreatment(
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-xl border border-[#d7e4e9] bg-white px-3 py-2.5 text-sm text-[#0d1e3d] outline-none transition focus:border-[#14c8d4] focus:ring-2 focus:ring-[#14c8d4]/15"
                            >
                              <option value="">
                                Velg behandling
                              </option>

                              {getTreatmentOptions(
                                message.clinics,
                              ).map(
                                (
                                  treatment,
                                ) => (
                                  <option
                                    key={treatment}
                                    value={treatment}
                                  >
                                    {treatment}
                                  </option>
                                ),
                              )}
                            </select>

                            {isRefreshingPrices && (
                              <p className="mt-1.5 text-[10px] text-gray-500">
                                Pia henter fortsatt priser i bakgrunnen. Flere behandlinger kan dukke opp.
                              </p>
                            )}
                          </div>

                          {message.clinics.map(
                            (
                              clinic,
                            ) => {
                              const selectedPrice = selectedTreatment
                                ? clinic.prices?.find(
                                    (price) =>
                                      price.treatment === selectedTreatment,
                                  )
                                : undefined;

                              return (
                                <div
                                  key={clinic.id}
                                  className="rounded-2xl border border-[#dfe8ee] bg-white p-3.5 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="text-sm font-semibold text-[#0d1e3d]">
                                          {clinic.name}
                                        </p>

                                        {clinic.clinicType ===
                                            "public" && (
                                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                            Offentlig
                                          </span>
                                        )}

                                        {clinic.clinicType ===
                                            "private" && (
                                          <span className="rounded-full bg-[#ecfbfc] px-2 py-0.5 text-[10px] font-semibold text-[#098e98]">
                                            Privat
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                                        <MapPin
                                          size={13}
                                          className="mt-0.5 flex-shrink-0"
                                        />

                                        <span>
                                          {clinic.address}
                                        </span>
                                      </div>
                                    </div>

                                    {typeof clinic.rating ===
                                        "number" && (
                                      <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                        <Star
                                          size={12}
                                          fill="currentColor"
                                        />

                                        {clinic.rating.toFixed(
                                          1,
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {!selectedTreatment && (
                                    <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
                                      <p className="text-xs font-medium text-gray-600">
                                        Velg en behandling over for å se pris.
                                      </p>
                                    </div>
                                  )}

                                  {selectedTreatment &&
                                    selectedPrice && (
                                    <div className="mt-3 rounded-xl bg-[#ecfafb] px-3 py-2.5">
                                      <p className="text-[11px] font-medium text-[#557181]">
                                        {selectedPrice.treatment}
                                      </p>

                                      <p className="mt-0.5 text-base font-bold text-[#0d1e3d]">
                                        {typeof selectedPrice.priceFrom ===
                                              "number" &&
                                            typeof selectedPrice.priceTo ===
                                              "number"
                                          ? `${
                                            selectedPrice.priceFrom.toLocaleString(
                                              "nb-NO",
                                            )
                                          }–${
                                            selectedPrice.priceTo.toLocaleString(
                                              "nb-NO",
                                            )
                                          } kr`
                                          : typeof selectedPrice.priceFrom ===
                                              "number"
                                          ? `Fra ${
                                            selectedPrice.priceFrom.toLocaleString(
                                              "nb-NO",
                                            )
                                          } kr`
                                          : "Pris ikke tilgjengelig"}
                                      </p>

                                      <p className="mt-1 text-[10px] text-gray-500">
                                        {selectedPrice.sourceType ===
                                            "clinic_submitted"
                                          ? "Bekreftet av klinikken"
                                          : selectedPrice.sourceType ===
                                              "clinic_website"
                                          ? "Publisert på klinikkens nettside"
                                          : selectedPrice.sourceType ===
                                              "manual"
                                          ? "Manuelt kontrollert"
                                          : "Veiledende pris"}
                                      </p>
                                    </div>
                                  )}

                                  {selectedTreatment &&
                                    !selectedPrice &&
                                    isRefreshingPrices && (
                                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f0fbfc] px-3 py-2.5">
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#14c8d4]/30 border-t-[#14c8d4]" />

                                      <div>
                                        <p className="text-xs font-semibold text-[#0d1e3d]">
                                          Henter pris…
                                        </p>

                                        <p className="text-[10px] text-gray-500">
                                          Sjekker pris for {selectedTreatment}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {selectedTreatment &&
                                    !selectedPrice &&
                                    !isRefreshingPrices && (
                                    <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
                                      <p className="text-xs font-semibold text-gray-600">
                                        Pris ikke tilgjengelig for {selectedTreatment}
                                      </p>
                                    </div>
                                  )}

                                  <div className="mt-3 flex gap-2">
                                    {clinic.website && (
                                      <a
                                        href={clinic.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dce7ec] bg-white px-3 py-2 text-xs font-semibold text-[#0d1e3d] transition hover:bg-gray-50"
                                      >
                                        <Globe2
                                          size={13}
                                        />
                                        Nettside
                                      </a>
                                    )}

                                    {clinic.phone && (
                                      <a
                                        href={`tel:${formatPhoneLink(
                                          clinic.phone,
                                        )}`}
                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dce7ec] bg-white px-3 py-2 text-xs font-semibold text-[#0d1e3d] transition hover:bg-gray-50"
                                      >
                                        <Phone
                                          size={13}
                                        />
                                        Ring
                                      </a>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectClinic(
                                        clinic,
                                      )
                                    }
                                    disabled={
                                      isSaving ||
                                      isSearching ||
                                      step !==
                                        "clinicSelection"
                                    }
                                    className="mt-3 w-full rounded-xl bg-[#0d1e3d] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#143a6e] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Velg denne klinikken
                                  </button>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}

                    {message.referral && (
                      <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#0d1e3d] p-3 text-white">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#14c8d4]/20">
                          <CheckCircle2
                            size={16}
                            className="text-[#14c8d4]"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">
                            {message
                              .referral
                              .clinicName}
                          </p>

                          <p className="truncate text-xs text-white/50">
                            {message
                              .referral
                              .reason}
                          </p>
                        </div>
                      </div>
                    )}

                    {message.options &&
                      message
                          .options
                          .length >
                        0 &&
                      (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.options.map(
                            (
                              option,
                            ) => (
                              <button
                                type="button"
                                key={option}
                                onClick={() =>
                                  submitAnswer(
                                    option,
                                  )}
                                disabled={isSaving ||
                                  isSearching ||
                                  isTyping}
                                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0d1e3d] transition-colors hover:border-[#14c8d4] hover:bg-[#f0fbfc] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {option}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              ),
            )}

            {(isTyping ||
              isSearching ||
              isSaving) && (
              <div className="flex justify-start gap-2.5">
                <PiaAvatar
                  state={piaAvatarState}
                  size={46}
                />

                <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <p className="mb-2 text-xs font-medium text-gray-500">
                    {isSearching
                      ? "Finner klinikker…"
                      : isSaving
                      ? "Sender forespørselen…"
                      : "Pia tenker…"}
                  </p>

                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#14c8d4]/60" />

                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#14c8d4]/60"
                      style={{
                        animationDelay: "150ms",
                      }}
                    />

                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#14c8d4]/60"
                      style={{
                        animationDelay: "300ms",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
          >
            <input
              type={step ===
                  "phone"
                ? "tel"
                : "text"}
              value={input}
              onChange={(
                event,
              ) =>
                setInput(
                  event
                    .target
                    .value,
                )}
              placeholder={step ===
                  "name"
                ? "Skriv navnet ditt..."
                : step ===
                    "phone"
                ? "Skriv telefonnummer..."
                : step ===
                    "clinicSelection"
                ? "Velg en klinikk ovenfor..."
                : "Skriv til Pia..."}
              disabled={isSaving ||
                isSearching ||
                isTyping ||
                step ===
                  "clinicSelection"}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#14c8d4] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!input.trim() ||
                isSaving ||
                isSearching ||
                isTyping ||
                step ===
                  "clinicSelection"}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#14c8d4] transition-all hover:bg-[#0fb3be] disabled:opacity-40"
              aria-label="Send melding"
            >
              <Send
                size={16}
                className="text-white"
              />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
