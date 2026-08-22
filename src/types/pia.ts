export type Sender = "pia" | "user";

export interface ClinicPrice {
    treatment: string;
    treatmentCode?: string;
    priceFrom?: number;
    priceTo?: number;
    currency: "NOK";
    sourceType:
    | "clinic_submitted"
    | "clinic_website"
    | "manual"
    | "estimated";
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
    clinicType?: "public" | "private" | null;
    countryCode?: "NO";
    acceptsNavGuarantee?: boolean | null;
    navGuaranteeSourceUrl?: string | null;
    navGuaranteeVerifiedAt?: string | null;
    prices?: ClinicPrice[];
    priceListUrl?: string | null;
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

export type PiaAction =
    | "search_clinics"
    | "request_location"
    | "compare_prices"
    | "check_public_eligibility"
    | "ask_follow_up"
    | "show_emergency_advice"
    | "none";

export type ConversationStep =
    | "greeting"
    | "reason"
    | "severity"
    | "duration"
    | "location"
    | "clinicSelection"
    | "name"
    | "phone"
    | "consent"
    | "saving"
    | "done";

export interface CollectedPatientData {
    reason?: string;
    severity?: string;
    duration?: string;
    location?: string;
    selectedClinic?: Clinic;
    patientName?: string;
    patientPhone?: string;
}
