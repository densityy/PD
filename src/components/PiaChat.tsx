import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  CheckCircle2,
  MapPin,
  RotateCcw,
  Send,
  Star,
  X,
} from 'lucide-react';

import { searchClinics } from '@/services/clinicService';
import { sendMessageToPia } from '@/services/piaService';
import {
  getReasonLabel,
  savePatientReferral,
} from '@/services/referralService';

import type {
  ChatMessage,
  Clinic,
  CollectedPatientData,
  ConversationStep,
} from '@/types/pia';

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8;
}

export default function PiaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] =
    useState<ConversationStep>('greeting');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [collected, setCollected] =
    useState<CollectedPatientData>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping, isSearching]);

  const startConversation = () => {
    setCollected({});
    setInput('');
    setIsTyping(false);
    setIsSaving(false);
    setIsSearching(false);

    setMessages([
      {
        sender: 'pia',
        text:
          'Hei! Jeg er Pia, din digitale tannlegeresepsjonist. ' +
          'Fortell meg med egne ord hva du trenger hjelp med, og gjerne hvor du befinner deg. 🦷',
        options: [
          'Jeg har tannpine',
          'Jeg trenger en kontroll',
          'Jeg har knekt en tann',
          'Jeg vil sammenligne priser',
        ],
      },
    ]);

    setStep('greeting');
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const openChat = () => setIsOpen(true);

    window.addEventListener('open-pia-chat', openChat);

    return () => {
      window.removeEventListener('open-pia-chat', openChat);
    };
  }, []);

  const addPiaMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  };

  const searchForClinics = async (
    locationAnswer: string,
    treatment?: string,
  ) => {
    const location = locationAnswer.trim();

    if (location.length < 2) {
      addPiaMessage({
        sender: 'pia',
        text:
          'Hvilken by, hvilket område eller postnummer ønsker du tannlege i?',
      });
      return;
    }

    setIsSearching(true);

    setCollected((current) => ({
      ...current,
      location,
      reason: treatment ?? current.reason,
    }));

    try {
      const result = await searchClinics({
        location,
        treatment: treatment ?? collected.reason,
        maxResults: 5,
      });

      if (result.clinics.length === 0) {
        addPiaMessage({
          sender: 'pia',
          text:
            `Jeg fant ingen tannklinikker for «${location}». ` +
            'Prøv et nærliggende sted eller et postnummer.',
        });
        return;
      }

      addPiaMessage({
        sender: 'pia',
        text:
          `Jeg fant ${result.clinics.length} tannklinikker ` +
          `i eller rundt ${location}. Du kan velge en klinikk nedenfor.`,
        clinics: result.clinics,
      });

      setStep('clinicSelection');
    } catch (error) {
      console.error('Kunne ikke søke etter klinikker:', error);

      addPiaMessage({
        sender: 'pia',
        text:
          'Beklager, jeg klarte ikke å hente klinikker akkurat nå. ' +
          'Prøv gjerne igjen om litt.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleNaturalMessage = async (
    answer: string,
    historyBeforeUserMessage: ChatMessage[],
  ) => {
    setIsTyping(true);

    try {
      const pia = await sendMessageToPia(
        answer,
        historyBeforeUserMessage,
      );

      const updatedData: CollectedPatientData = {
        ...collected,
        location:
          pia.extracted.location ??
          collected.location,
        reason:
          pia.extracted.treatment ??
          collected.reason,
        severity:
          pia.extracted.severity !== null
            ? String(pia.extracted.severity)
            : collected.severity,
        duration:
          pia.extracted.duration ??
          collected.duration,
      };

      setCollected(updatedData);

      addPiaMessage({
        sender: 'pia',
        text: pia.message,
      });

      if (
        pia.actions.includes('show_emergency_advice') ||
        pia.extracted.emergencyWarning
      ) {
        return;
      }

      const shouldSearch =
        pia.actions.includes('search_clinics') ||
        pia.actions.includes('compare_prices') ||
        pia.extracted.wantsClinicSearch ||
        pia.extracted.wantsPriceComparison;

      const location =
        pia.extracted.location ??
        updatedData.location;

      const treatment =
        pia.extracted.treatment ??
        updatedData.reason;

      if (shouldSearch && location) {
        await searchForClinics(location, treatment);
      }
    } catch (error) {
      console.error('Pia conversation error:', error);

      addPiaMessage({
        sender: 'pia',
        text:
          'Beklager, jeg klarte ikke å behandle meldingen akkurat nå. ' +
          'Prøv gjerne igjen.',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const selectClinic = (clinic: Clinic) => {
    setMessages((current) => [
      ...current,
      {
        sender: 'user',
        text: `Jeg velger ${clinic.name}`,
      },
    ]);

    setCollected((current) => ({
      ...current,
      selectedClinic: clinic,
    }));

    addPiaMessage({
      sender: 'pia',
      text:
        `${clinic.name} er valgt. ` +
        'Hva heter du?',
      referral: {
        clinicId: clinic.id,
        clinicName: clinic.name,
        reason: getReasonLabel(collected.reason),
      },
    });

    setStep('name');
  };

  const saveReferral = async (
    data: CollectedPatientData,
  ) => {
    if (!data.selectedClinic) {
      addPiaMessage({
        sender: 'pia',
        text:
          'Du må velge en klinikk før forespørselen kan sendes.',
      });

      setStep('clinicSelection');
      return;
    }

    setIsSaving(true);
    setStep('saving');

    try {
      const result = await savePatientReferral(data);

      addPiaMessage({
        sender: 'pia',
        text:
          `Takk, ${data.patientName}! Forespørselen er registrert ` +
          `for ${result.clinic.name}. Klinikken kan kontakte deg på ` +
          `${data.patientPhone}.`,
        referral: {
          clinicId: result.clinic.id,
          clinicName: result.clinic.name,
          reason: result.reasonLabel,
        },
        options: ['Ferdig'],
      });

      setStep('done');
    } catch (error) {
      console.error(
        'Kunne ikke lagre henvisningen:',
        error,
      );

      addPiaMessage({
        sender: 'pia',
        text:
          'Beklager, noe gikk galt da forespørselen skulle lagres. ' +
          'Ingen forespørsel ble bekreftet.',
        options: ['Prøv på nytt', 'Start på nytt'],
      });

      setStep('consent');
    } finally {
      setIsSaving(false);
    }
  };

  const processAnswer = async (
    answer: string,
    historyBeforeUserMessage: ChatMessage[],
  ) => {
    if (step === 'clinicSelection') {
      addPiaMessage({
        sender: 'pia',
        text:
          'Velg en av klinikkene i listen før vi går videre.',
      });
      return;
    }

    if (step === 'name') {
      const patientName = answer.trim();

      if (patientName.length < 2) {
        addPiaMessage({
          sender: 'pia',
          text:
            'Skriv inn navnet ditt, så klinikken vet hvem de skal kontakte.',
        });
        return;
      }

      setCollected((current) => ({
        ...current,
        patientName,
      }));

      addPiaMessage({
        sender: 'pia',
        text:
          `Hyggelig å møte deg, ${patientName}! ` +
          'Hva er telefonnummeret ditt?',
      });

      setStep('phone');
      return;
    }

    if (step === 'phone') {
      if (!isValidPhone(answer)) {
        addPiaMessage({
          sender: 'pia',
          text:
            'Telefonnummeret ser litt kort ut. Skriv inn minst 8 sifre.',
        });
        return;
      }

      const patientPhone = answer.trim();

      const finalData: CollectedPatientData = {
        ...collected,
        patientPhone,
      };

      setCollected(finalData);

      const clinic = finalData.selectedClinic;

      if (!clinic) {
        addPiaMessage({
          sender: 'pia',
          text:
            'Jeg finner ikke den valgte klinikken. Velg klinikk på nytt.',
        });

        setStep('clinicSelection');
        return;
      }

      const reasonLabel = getReasonLabel(
        finalData.reason,
      );

      addPiaMessage({
        sender: 'pia',
        text:
          `Da har jeg det jeg trenger. Kan jeg sende forespørselen ` +
          `til ${clinic.name} med navnet og telefonnummeret ditt?`,
        options: [
          'Ja, send forespørselen',
          'Nei takk',
        ],
        referral: {
          clinicId: clinic.id,
          clinicName: clinic.name,
          reason: reasonLabel,
        },
      });

      setStep('consent');
      return;
    }

    if (step === 'consent') {
      if (answer === 'Start på nytt') {
        startConversation();
        return;
      }

      if (answer === 'Prøv på nytt') {
        await saveReferral(collected);
        return;
      }

      if (answer.toLowerCase().startsWith('ja')) {
        await saveReferral(collected);
        return;
      }

      addPiaMessage({
        sender: 'pia',
        text:
          'Helt i orden. Opplysningene dine ble ikke sendt eller lagret.',
        options: ['Start på nytt'],
      });

      setStep('done');
      return;
    }

    if (step === 'done') {
      if (
        answer === 'Start på nytt' ||
        answer === 'Prøv på nytt'
      ) {
        startConversation();
        return;
      }

      addPiaMessage({
        sender: 'pia',
        text:
          'Takk for at du brukte Pocket Dentist. God bedring! 😊',
      });
      return;
    }

    await handleNaturalMessage(
      answer,
      historyBeforeUserMessage,
    );
  };

  const submitAnswer = (answer: string) => {
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

    setMessages((current) => [
      ...current,
      {
        sender: 'user',
        text: trimmedAnswer,
      },
    ]);

    setInput('');

    void processAnswer(
      trimmedAnswer,
      historyBeforeUserMessage,
    );
  };

  const handleOption = (option: string) => {
    submitAnswer(option);
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    submitAnswer(input);
  };

  const reset = () => {
    setMessages([]);
    setStep('greeting');
    setCollected({});
    setInput('');
    setIsTyping(false);
    setIsSaving(false);
    setIsSearching(false);

    window.setTimeout(startConversation, 0);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-[#14c8d4] py-1 pl-1 pr-4 text-white shadow-lg shadow-[#14c8d4]/30 transition-all duration-200 hover:scale-105 hover:bg-[#0fb3be]"
        >
          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl">
            <img
              src="/logo_web.png"
              alt="Pia"
              className="h-full w-[200%] object-cover object-left"
            />

            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#14c8d4] bg-green-400" />
          </div>

          <span className="text-sm font-semibold">
            Snakk med Pia
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#0d1e3d] to-[#143a6e] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-10 w-10 overflow-hidden rounded-xl border border-[#14c8d4]/40">
                  <img
                    src="/logo_web.png"
                    alt="Pia"
                    className="h-full w-[200%] object-cover object-left"
                  />
                </div>

                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1e3d] bg-green-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Pia
                </p>

                <p className="text-xs text-white/50">
                  Digital tannlegeresepsjonist · Online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Nullstill samtalen"
              >
                <RotateCcw size={15} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Lukk chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-[320px] max-h-[520px] flex-1 space-y-2.5 overflow-y-auto bg-gray-50 p-3"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.text}-${index}`}
                className={`flex gap-2 ${message.sender === 'user'
                    ? 'justify-end'
                    : 'justify-start'
                  }`}
              >
                {message.sender === 'pia' && (
                  <div className="mt-auto h-7 w-7 flex-shrink-0 overflow-hidden rounded-xl border border-[#14c8d4]/30">
                    <img
                      src="/logo_web.png"
                      alt="Pia"
                      className="h-full w-[200%] object-cover object-left"
                    />
                  </div>
                )}

                <div
                  className={`max-w-[84%] ${message.sender === 'pia'
                      ? 'w-full'
                      : ''
                    }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${message.sender === 'pia'
                        ? 'rounded-bl-sm border border-gray-100 bg-white text-gray-700'
                        : 'rounded-br-sm bg-[#14c8d4] text-white'
                      }`}
                  >
                    {message.text}
                  </div>

                  {message.clinics &&
                    message.clinics.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.clinics.map((clinic) => (
                          <div
                            key={clinic.id}
                            className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#0d1e3d]">
                                  {clinic.name}
                                </p>

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

                              {typeof clinic.rating === 'number' && (
                                <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                  <Star
                                    size={12}
                                    fill="currentColor"
                                  />

                                  {clinic.rating.toFixed(1)}
                                </div>
                              )}
                            </div>

                            {typeof clinic.reviewCount === 'number' && (
                              <p className="mt-2 text-xs text-gray-400">
                                {clinic.reviewCount} Google-anmeldelser
                              </p>
                            )}

                            {clinic.prices?.map((price) => (
                              <div
                                key={`${clinic.id}-${price.treatment}`}
                                className="mt-2 rounded-xl bg-[#f0fbfc] px-3 py-2"
                              >
                                <p className="text-xs font-medium text-[#0d1e3d]">
                                  {price.treatment}
                                </p>

                                <p className="mt-0.5 text-sm font-semibold text-[#0d1e3d]">
                                  {typeof price.priceFrom === 'number' &&
                                    typeof price.priceTo === 'number'
                                    ? `${price.priceFrom.toLocaleString('nb-NO')}–${price.priceTo.toLocaleString('nb-NO')} kr`
                                    : typeof price.priceFrom === 'number'
                                      ? `Fra ${price.priceFrom.toLocaleString('nb-NO')} kr`
                                      : 'Pris ikke tilgjengelig'}
                                </p>

                                <p className="mt-1 text-[11px] text-gray-500">
                                  {price.sourceType === 'clinic_submitted'
                                    ? 'Bekreftet av klinikken'
                                    : price.sourceType === 'clinic_website'
                                      ? 'Publisert på klinikkens nettside'
                                      : price.sourceType === 'manual'
                                        ? 'Manuelt kontrollert'
                                        : 'Veiledende pris'}
                                </p>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() =>
                                selectClinic(clinic)
                              }
                              disabled={
                                isSaving ||
                                isSearching ||
                                step !== 'clinicSelection'
                              }
                              className="mt-3 w-full rounded-xl bg-[#0d1e3d] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#143a6e] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Velg denne klinikken
                            </button>
                          </div>
                        ))}
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
                          {message.referral.clinicName}
                        </p>

                        <p className="truncate text-xs text-white/50">
                          {message.referral.reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {message.options &&
                    message.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.options.map((option) => (
                          <button
                            type="button"
                            key={option}
                            onClick={() =>
                              handleOption(option)
                            }
                            disabled={
                              isSaving ||
                              isSearching ||
                              isTyping
                            }
                            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0d1e3d] transition-colors hover:border-[#14c8d4] hover:bg-[#f0fbfc] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}

            {(isTyping || isSearching) && (
              <div className="flex justify-start gap-2">
                <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-xl border border-[#14c8d4]/30">
                  <img
                    src="/logo_web.png"
                    alt="Pia"
                    className="h-full w-[200%] object-cover object-left"
                  />
                </div>

                <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  {isSearching && (
                    <p className="mb-2 text-xs text-gray-500">
                      Søker etter klinikker og priser…
                    </p>
                  )}

                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />

                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300"
                      style={{
                        animationDelay: '150ms',
                      }}
                    />

                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300"
                      style={{
                        animationDelay: '300ms',
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
              type={
                step === 'phone'
                  ? 'tel'
                  : 'text'
              }
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              placeholder={
                step === 'name'
                  ? 'Skriv navnet ditt...'
                  : step === 'phone'
                    ? 'Skriv telefonnummer...'
                    : step === 'clinicSelection'
                      ? 'Velg en klinikk ovenfor...'
                      : 'Fortell Pia hva du trenger hjelp med...'
              }
              disabled={
                isSaving ||
                isSearching ||
                isTyping ||
                step === 'clinicSelection'
              }
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#14c8d4] disabled:cursor-not-allowed disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={
                !input.trim() ||
                isSaving ||
                isSearching ||
                isTyping ||
                step === 'clinicSelection'
              }
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#14c8d4] transition-colors hover:bg-[#0fb3be] disabled:opacity-40"
              aria-label="Send melding"
            >
              <Send
                size={15}
                className="text-white"
              />
            </button>
          </form>
        </div>
      )}
    </>
  );
}