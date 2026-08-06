import type { CollectedPatientData } from '@/types/pia';

export type TreatmentIntent =
  | 'toothache'
  | 'checkup'
  | 'emergency'
  | 'cosmetic'
  | 'broken_tooth'
  | 'wisdom_tooth'
  | 'root_canal'
  | 'cleaning'
  | 'other';

export interface EngineResult {
  handledLocally: boolean;
  needsAi: boolean;
  detectedLocation?: string;
  detectedIntent?: TreatmentIntent;
  detectedUrgency?: 'normal' | 'urgent' | 'emergency';
  nextQuestion?: string;
  response?: string;
  updatedData: Partial<CollectedPatientData>;
}

const NORWEGIAN_LOCATIONS = [
  'oslo',
  'bergen',
  'trondheim',
  'stavanger',
  'tromsø',
  'drammen',
  'fredrikstad',
  'kristiansand',
  'sandnes',
  'sarpsborg',
  'skien',
  'ålesund',
  'sandefjord',
  'haugesund',
  'tønsberg',
  'moss',
  'porsgrunn',
  'bodø',
  'arendal',
  'hamar',
  'larvik',
  'halden',
  'lillehammer',
  'molde',
  'kongsberg',
  'gjøvik',
  'harstad',
  'jessheim',
  'lillestrøm',
  'kløfta',
];

const INTENT_KEYWORDS: Record<TreatmentIntent, string[]> = {
  toothache: [
    'tannpine',
    'tannverk',
    'vondt i tanna',
    'vondt i tann',
    'tannsmerter',
    'smerter i tanna',
  ],
  checkup: [
    'kontroll',
    'undersøkelse',
    'sjekk',
    'rutinekontroll',
    'tannsjekk',
  ],
  emergency: [
    'akutt',
    'akuttime',
    'øyeblikkelig',
    'haster',
    'veldig vondt',
  ],
  cosmetic: [
    'bleking',
    'tannbleking',
    'estetisk',
    'hvite tenner',
    'skallfasett',
  ],
  broken_tooth: [
    'knekt tann',
    'brukket tann',
    'knakk tanna',
    'ødelagt tann',
    'mistet en bit',
  ],
  wisdom_tooth: [
    'visdomstann',
    'visdomstenner',
  ],
  root_canal: [
    'rotfylling',
    'rotkanal',
  ],
  cleaning: [
    'tannrens',
    'rense tennene',
    'tannstein',
  ],
  other: [],
};

const EMERGENCY_KEYWORDS = [
  'pustevansker',
  'klarer ikke puste',
  'vanskelig å puste',
  'kraftig blødning',
  'stopper ikke å blø',
  'hevelse i halsen',
  'hoven i halsen',
  'ansiktet hovner',
  'rask hevelse',
  'kjeven er brukket',
  'bevisstløs',
];

const URGENT_KEYWORDS = [
  'hoven',
  'hevelse',
  'feber',
  'sterke smerter',
  'veldig sterke smerter',
  'knust tann',
  'slått ut tann',
  'tann slått ut',
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ');
}

function findLocation(text: string) {
  const normalized = normalizeText(text);

  const location = NORWEGIAN_LOCATIONS.find((city) =>
    normalized.includes(city),
  );

  if (location) {
    return location.charAt(0).toUpperCase() + location.slice(1);
  }

  const postalCodeMatch = normalized.match(/\b\d{4}\b/);

  return postalCodeMatch?.[0];
}

function findIntent(text: string): TreatmentIntent | undefined {
  const normalized = normalizeText(text);

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return intent as TreatmentIntent;
    }
  }

  return undefined;
}

function findUrgency(text: string) {
  const normalized = normalizeText(text);

  if (EMERGENCY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'emergency' as const;
  }

  if (URGENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'urgent' as const;
  }

  return 'normal' as const;
}

export function processMessageLocally(
  message: string,
  currentData: CollectedPatientData,
): EngineResult {
  const detectedLocation = findLocation(message);
  const detectedIntent = findIntent(message);
  const detectedUrgency = findUrgency(message);

  const updatedData: Partial<CollectedPatientData> = {};

  if (detectedLocation) {
    updatedData.location = detectedLocation;
  }

  if (detectedIntent) {
    updatedData.reason = detectedIntent;
  }

  if (detectedUrgency === 'emergency') {
    return {
      handledLocally: true,
      needsAi: false,
      detectedLocation,
      detectedIntent,
      detectedUrgency,
      updatedData,
      response:
        'Dette kan være akutt. Ved pustevansker, kraftig blødning eller rask hevelse i ansikt eller hals bør du kontakte 113 eller legevakt med en gang.',
    };
  }

  const location = detectedLocation ?? currentData.location;
  const intent = detectedIntent ?? currentData.reason;

  if (location && intent) {
    return {
      handledLocally: true,
      needsAi: false,
      detectedLocation,
      detectedIntent,
      detectedUrgency,
      updatedData,
      response: `Jeg har registrert ${getIntentLabel(
        intent,
      ).toLowerCase()} og område ${location}. Jeg kan nå søke etter passende klinikker.`,
    };
  }

  if (intent && !location) {
    return {
      handledLocally: true,
      needsAi: false,
      detectedIntent,
      detectedUrgency,
      updatedData,
      nextQuestion:
        'Hvilken by, hvilket område eller postnummer ønsker du tannlege i?',
    };
  }

  if (location && !intent) {
    return {
      handledLocally: true,
      needsAi: false,
      detectedLocation,
      detectedUrgency,
      updatedData,
      nextQuestion: 'Hva trenger du hjelp med?',
    };
  }

  const shortSimpleMessage = normalizeText(message).split(' ').length <= 3;

  if (shortSimpleMessage) {
    return {
      handledLocally: true,
      needsAi: false,
      detectedUrgency,
      updatedData,
      nextQuestion:
        'Kan du beskrive kort hva du trenger hjelp med, for eksempel tannpine, kontroll eller en knekt tann?',
    };
  }

  return {
    handledLocally: false,
    needsAi: true,
    detectedUrgency,
    updatedData,
  };
}

export function getIntentLabel(intent: string) {
  const labels: Record<string, string> = {
    toothache: 'Tannpine',
    checkup: 'Rutinekontroll',
    emergency: 'Akutt behov',
    cosmetic: 'Estetisk tannbehandling',
    broken_tooth: 'Knekt tann',
    wisdom_tooth: 'Visdomstann',
    root_canal: 'Rotfylling',
    cleaning: 'Tannrens',
    other: 'Annet',
  };

  return labels[intent] ?? 'Tannhelse';
}