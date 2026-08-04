import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Sender = 'pia' | 'user';

interface ChatMessage {
  sender: Sender;
  text: string;
  options?: string[];
  referral?: {
    clinic: string;
    reason: string;
  };
}

type Step =
  | 'greeting'
  | 'reason'
  | 'severity'
  | 'duration'
  | 'location'
  | 'name'
  | 'phone'
  | 'consent'
  | 'saving'
  | 'done';

interface CollectedData {
  reason?: string;
  severity?: string;
  duration?: string;
  location?: string;
  patientName?: string;
  patientPhone?: string;
}

const CLINICS: Record<string, { name: string; area: string }> = {
  oslo: { name: 'Tannklinikken Sentrum', area: 'Oslo Sentrum' },
  bergen: { name: 'Bergen Tannhelse', area: 'Bergen' },
  trondheim: { name: 'Nordre Tannklinikk', area: 'Trondheim' },
  stavanger: { name: 'Stavanger Smileklinikk', area: 'Stavanger' },
  other: { name: 'Nærmeste partnerklinikk', area: 'din region' },
};

const REASON_LABELS: Record<string, string> = {
  toothache: 'Tannpine',
  checkup: 'Rutinekontroll',
  cosmetic: 'Estetisk tannbehandling',
  emergency: 'Akutt behov',
  other: 'Annet',
};

function getLocationKey(answer: string) {
  const value = answer.toLowerCase();

  if (value.includes('oslo')) return 'oslo';
  if (value.includes('bergen')) return 'bergen';
  if (value.includes('trondheim')) return 'trondheim';
  if (value.includes('stavanger')) return 'stavanger';

  return 'other';
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8;
}

export default function PiaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collected, setCollected] = useState<CollectedData>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  const startConversation = () => {
    setCollected({});
    setMessages([
      {
        sender: 'pia',
        text: 'Hei! Jeg er Pia, din digitale tannlegeresepsjonist. Jeg hjelper deg med å finne riktig klinikk. Hva gjelder det? 🦷',
        options: [
          'Tannpine',
          'Rutinekontroll',
          'Estetisk tannbehandling',
          'Akutt behov',
          'Annet',
        ],
      },
    ]);
    setStep('reason');
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
  }, [isOpen, messages.length]);

  const pushPia = (message: ChatMessage, delay = 500) => {
    setIsTyping(true);

    window.setTimeout(() => {
      setIsTyping(false);
      setMessages((current) => [...current, message]);
    }, delay);
  };

useEffect(() => {
  const openChat = () => setIsOpen(true);

  window.addEventListener('open-pia-chat', openChat);

  return () => {
    window.removeEventListener('open-pia-chat', openChat);
  };
}, []);
  
  const handleOption = (option: string) => {
    if (isSaving) return;

    setMessages((current) => [
      ...current,
      { sender: 'user', text: option },
    ]);

    void advance(option);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const answer = input.trim();
    if (!answer || isSaving) return;

    setMessages((current) => [
      ...current,
      { sender: 'user', text: answer },
    ]);
    setInput('');

    void advance(answer);
  };

  const saveReferral = async (data: CollectedData) => {
    const locationKey = data.location ?? 'other';
    const clinic = CLINICS[locationKey];
    const reasonLabel = data.reason
      ? REASON_LABELS[data.reason]
      : 'Tannhelse';

    setIsSaving(true);
    setStep('saving');

    try {
      const { error: conversationError } = await supabase
        .from('conversations')
        .insert({
          patient_name: data.patientName,
          patient_phone: data.patientPhone,
          status: 'referred',
          referral_clinic: clinic.name,
          referral_reason: reasonLabel,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        });

      if (conversationError) {
        throw conversationError;
      }

      const { error: referralError } = await supabase
        .from('patient_referrals')
        .insert({
          patient_name: data.patientName,
          clinic_name: clinic.name,
          reason: reasonLabel,
          status: 'confirmed',
        });

      if (referralError) {
        throw referralError;
      }

      pushPia(
        {
          sender: 'pia',
          text: `Takk, ${data.patientName}! Forespørselen er sendt til ${clinic.name}. Klinikken kan kontakte deg på ${data.patientPhone}.`,
          referral: {
            clinic: clinic.name,
            reason: reasonLabel,
          },
          options: ['Ferdig'],
        },
        300,
      );

      setStep('done');
    } catch (error) {
      console.error('Kunne ikke lagre henvisningen:', error);

      pushPia(
        {
          sender: 'pia',
          text: 'Beklager, noe gikk galt da jeg skulle sende forespørselen. Ingen henvisning ble bekreftet. Prøv igjen, eller kontakt oss direkte.',
          options: ['Prøv på nytt'],
        },
        300,
      );

      setStep('consent');
    } finally {
      setIsSaving(false);
    }
  };

  const advance = async (answer: string) => {
    if (step === 'reason') {
      const reasonKey =
        Object.keys(REASON_LABELS).find(
          (key) => REASON_LABELS[key] === answer,
        ) ?? 'other';

      setCollected((current) => ({
        ...current,
        reason: reasonKey,
      }));

      if (reasonKey === 'checkup' || reasonKey === 'cosmetic') {
        pushPia({
          sender: 'pia',
          text: 'Hvilken by eller hvilket område ønsker du tannlege i?',
          options: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Annet sted'],
        });
        setStep('location');
        return;
      }

      if (reasonKey === 'emergency') {
        pushPia({
          sender: 'pia',
          text: 'Hvor lenge har du hatt plagene?',
          options: ['Siden i dag', '1–2 dager', 'Mer enn 3 dager'],
        });
        setStep('duration');
        return;
      }

      pushPia({
        sender: 'pia',
        text: 'På en skala fra 1 til 10, hvor sterke er smertene?',
        options: ['Mild (1–3)', 'Moderat (4–6)', 'Sterk (7–10)'],
      });
      setStep('severity');
      return;
    }

    if (step === 'severity') {
      setCollected((current) => ({
        ...current,
        severity: answer,
      }));

      pushPia({
        sender: 'pia',
        text: 'Hvor lenge har du hatt dette problemet?',
        options: ['Siden i dag', '1–2 dager', 'Mer enn 3 dager'],
      });
      setStep('duration');
      return;
    }

    if (step === 'duration') {
      setCollected((current) => ({
        ...current,
        duration: answer,
      }));

      pushPia({
        sender: 'pia',
        text: 'Hvilken by eller hvilket område ønsker du tannlege i?',
        options: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Annet sted'],
      });
      setStep('location');
      return;
    }

    if (step === 'location') {
      const location = getLocationKey(answer);

      setCollected((current) => ({
        ...current,
        location,
      }));

      pushPia({
        sender: 'pia',
        text: 'Hva heter du?',
      });
      setStep('name');
      return;
    }

    if (step === 'name') {
      if (answer.trim().length < 2) {
        pushPia({
          sender: 'pia',
          text: 'Skriv inn navnet ditt, så klinikken vet hvem de skal kontakte.',
        });
        return;
      }

      setCollected((current) => ({
        ...current,
        patientName: answer.trim(),
      }));

      pushPia({
        sender: 'pia',
        text: `Hyggelig å møte deg, ${answer.trim()}! Hva er telefonnummeret ditt?`,
      });
      setStep('phone');
      return;
    }

    if (step === 'phone') {
      if (!isValidPhone(answer)) {
        pushPia({
          sender: 'pia',
          text: 'Det telefonnummeret ser litt kort ut. Skriv minst 8 sifre.',
        });
        return;
      }

      const patientPhone = answer.trim();
      const finalData = {
        ...collected,
        patientPhone,
      };

      setCollected(finalData);

      const clinic = CLINICS[finalData.location ?? 'other'];
      const reasonLabel = finalData.reason
        ? REASON_LABELS[finalData.reason]
        : 'Tannhelse';

      pushPia({
        sender: 'pia',
        text: `Jeg anbefaler ${clinic.name} i ${clinic.area} for ${reasonLabel.toLowerCase()}. Kan jeg sende navnet og telefonnummeret ditt til klinikken, slik at de kan kontakte deg?`,
        options: ['Ja, send forespørselen', 'Nei takk'],
        referral: {
          clinic: clinic.name,
          reason: reasonLabel,
        },
      });
      setStep('consent');
      return;
    }

    if (step === 'consent') {
      if (answer === 'Prøv på nytt') {
        await saveReferral(collected);
        return;
      }

      if (answer.toLowerCase().startsWith('ja')) {
        await saveReferral(collected);
        return;
      }

      pushPia({
        sender: 'pia',
        text: 'Helt i orden. Opplysningene dine ble ikke sendt til klinikken.',
        options: ['Start på nytt'],
      });
      setStep('done');
      return;
    }

    if (step === 'done') {
      if (answer === 'Start på nytt' || answer === 'Prøv på nytt') {
        startConversation();
        return;
      }

      pushPia({
        sender: 'pia',
        text: 'Takk for at du brukte Pocket Dentist. God bedring! 😊',
      });
    }
  };

  const reset = () => {
    setInput('');
    setIsTyping(false);
    setIsSaving(false);
    setMessages([]);
    setStep('greeting');
    setCollected({});

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
          <span className="text-sm font-semibold">Snakk med Pia</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#0d1e3d] to-[#143a6e] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-[#14c8d4]/40">
                  <img
                    src="/logo_web.png"
                    alt="Pia"
                    className="h-full w-[200%] object-cover object-left"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1e3d] bg-green-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Pia</p>
                <p className="text-xs text-white/50">
                  Digital tannlegeresepsjonist · Online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="px-2 py-1 text-xs text-white/40 transition-colors hover:text-white/80"
              >
                Nullstill
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/40 transition-colors hover:text-white"
                aria-label="Lukk chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-[300px] max-h-[460px] flex-1 space-y-2.5 overflow-y-auto bg-gray-50 p-3"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.text}-${index}`}
                className={`flex gap-2 ${
                  message.sender === 'user'
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
                  className={`max-w-[82%] ${
                    message.sender === 'pia' ? 'w-full' : ''
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                      message.sender === 'pia'
                        ? 'rounded-bl-sm border border-gray-100 bg-white text-gray-700'
                        : 'rounded-br-sm bg-[#14c8d4] text-white'
                    }`}
                  >
                    {message.text}
                  </div>

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
                          {message.referral.clinic}
                        </p>
                        <p className="truncate text-xs text-white/50">
                          {message.referral.reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {message.options && message.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.options.map((option) => (
                        <button
                          type="button"
                          key={option}
                          onClick={() => handleOption(option)}
                          disabled={isSaving}
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

            {isTyping && (
              <div className="flex justify-start gap-2">
                <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-xl border border-[#14c8d4]/30">
                  <img
                    src="/logo_web.png"
                    alt="Pia"
                    className="h-full w-[200%] object-cover object-left"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
          >
            <input
              type={step === 'phone' ? 'tel' : 'text'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                step === 'name'
                  ? 'Skriv navnet ditt...'
                  : step === 'phone'
                    ? 'Skriv telefonnummer...'
                    : 'Skriv melding...'
              }
              disabled={isSaving}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#14c8d4] disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!input.trim() || isSaving}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#14c8d4] transition-colors hover:bg-[#0fb3be] disabled:opacity-40"
              aria-label="Send melding"
            >
              <Send size={15} className="text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}