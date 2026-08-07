export type Sender = 'pia' | 'user';

export interface ClinicPrice {
    treatment: string;
    priceFrom?: number;
    priceTo?: number;
    currency: 'NOK';
    sourceType:
    | 'clinic_submitted'
    | 'clinic_website'
    | 'manual'
    | 'estimated';
    sourceUrl?: string;
    verifiedAt?: string;
}

export interface Clinic {
    id: string;
    name: string;
    address: string;
    city: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    googleMapsUrl?: string;
    distanceKm?: number;
    isPartner?: boolean;
    isVerified?: boolean;
    prices?: ClinicPrice[];
}

export interface ReferralDetails {
    clinicId?: string;
    clinicName: string;
    reason: string;
}

export interface ChatMessage {
    sender: Sender;
    text: string;
    options?: string[];
    clinics?: Clinic[];
    referral?: ReferralDetails;
}

export type ConversationStep =
    | 'greeting'
    | 'reason'
    | 'severity'
    | 'duration'
    | 'location'
    | 'clinicSelection'
    | 'name'
    | 'phone'
    | 'consent'
    | 'saving'
    | 'done';

export interface CollectedPatientData {
    reason?: string;
    severity?: string;
    duration?: string;
    location?: string;
    selectedClinic?: Clinic;
    patientName?: string;
    patientPhone?: string;
}

