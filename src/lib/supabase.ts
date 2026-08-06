import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ConversationStatus = 'active' | 'resolved' | 'referred' | 'pending';
export type ReferralStatus =
  | 'pending'
  | 'confirmed'
  | 'assigned'
  | 'completed'
  | 'cancelled';

export interface Conversation {
  id: string;
  patient_name: string;
  patient_phone: string | null;
  status: ConversationStatus;
  referral_clinic: string | null;
  referral_reason: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'ai' | 'patient';
  content: string;
  created_at: string;
}

export interface PatientReferral {
  id: string;
  conversation_id: string | null;

  patient_name: string;
  clinic_name: string;
  reason: string;

  status: ReferralStatus;

  clinic_id: string | null;
  assigned_dentist_id: string | null;
  assigned_at: string | null;
  appointment_at: string | null;
  clinic_notes: string | null;

  created_at: string;
}

export interface DashboardStat {
  id: string;
  stat_date: string;
  total_chats: number;
  referrals_made: number;
  avg_rating: number;
  created_at: string;
}
