/*
# Pocket Dentist - AI Receptionist Dashboard Schema

## Overview
Initial schema for the Pocket Dentist AI receptionist dashboard.

## New Tables
1. `conversations` - Chat sessions between the AI receptionist and patients
   - id, patient_name, patient_phone, status, started_at, ended_at, referral_clinic
2. `messages` - Individual messages within conversations
   - id, conversation_id, sender (ai/patient), content, created_at
3. `patient_referrals` - Referrals made by the AI to clinics
   - id, conversation_id, patient_name, clinic_name, reason, status, created_at
4. `dashboard_stats` - Daily aggregated stats (for chart data)
   - id, date, total_chats, referrals_made, avg_rating

## Security
- RLS enabled on all tables
- Policies for anon + authenticated (no sign-in required for this app)
*/

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL DEFAULT 'Ukjent pasient',
  patient_phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'referred', 'pending')),
  referral_clinic text,
  referral_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('ai', 'patient')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

-- Patient referrals table
CREATE TABLE IF NOT EXISTS patient_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  clinic_name text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_referrals" ON patient_referrals;
CREATE POLICY "anon_select_referrals" ON patient_referrals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_referrals" ON patient_referrals;
CREATE POLICY "anon_insert_referrals" ON patient_referrals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_referrals" ON patient_referrals;
CREATE POLICY "anon_update_referrals" ON patient_referrals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_referrals" ON patient_referrals;
CREATE POLICY "anon_delete_referrals" ON patient_referrals FOR DELETE
  TO anon, authenticated USING (true);

-- Dashboard stats table (for chart data)
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date date NOT NULL UNIQUE,
  total_chats integer NOT NULL DEFAULT 0,
  referrals_made integer NOT NULL DEFAULT 0,
  avg_rating numeric(3,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stats" ON dashboard_stats;
CREATE POLICY "anon_select_stats" ON dashboard_stats FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_stats" ON dashboard_stats;
CREATE POLICY "anon_insert_stats" ON dashboard_stats FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_stats" ON dashboard_stats;
CREATE POLICY "anon_update_stats" ON dashboard_stats FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_stats" ON dashboard_stats;
CREATE POLICY "anon_delete_stats" ON dashboard_stats FOR DELETE
  TO anon, authenticated USING (true);

-- Seed some chart data for the last 14 days
INSERT INTO dashboard_stats (stat_date, total_chats, referrals_made, avg_rating)
SELECT
  (CURRENT_DATE - interval '1 day' * s.i)::date,
  (10 + random() * 20)::integer,
  (3 + random() * 10)::integer,
  (4.0 + random() * 1.0)::numeric(3,2)
FROM generate_series(0, 13) AS s(i)
ON CONFLICT (stat_date) DO NOTHING;

-- Seed sample conversations
INSERT INTO conversations (patient_name, patient_phone, status, referral_clinic, referral_reason, started_at, ended_at) VALUES
  ('Emma Johansen', '+47 982 34 567', 'referred', 'Tannklinikken Sentrum', 'Tannpine - mulig rotfylling', now() - interval '2 hours', now() - interval '1 hour 45 min'),
  ('Martin Larsen', '+47 901 23 456', 'resolved', 'Oslo Tannlege', 'Rutinekontroll', now() - interval '3 hours', now() - interval '2 hours 30 min'),
  ('Silje Bakken', '+47 956 78 901', 'referred', 'Nordre Tannklinikk', 'Tannstilling - henvisning til kjeveortoped', now() - interval '4 hours', now() - interval '3 hours 20 min'),
  ('Jonas Berg', '+47 934 56 789', 'active', NULL, NULL, now() - interval '15 min', NULL),
  ('Maria Pettersen', '+47 978 12 345', 'pending', NULL, NULL, now() - interval '5 min', NULL)
ON CONFLICT DO NOTHING;

-- Seed sample referrals
INSERT INTO patient_referrals (patient_name, clinic_name, reason, status, created_at)
SELECT 'Emma Johansen', 'Tannklinikken Sentrum', 'Tannpine - mulig rotfylling', 'confirmed', now() - interval '1 hour 45 min'
WHERE NOT EXISTS (SELECT 1 FROM patient_referrals WHERE patient_name = 'Emma Johansen');

INSERT INTO patient_referrals (patient_name, clinic_name, reason, status, created_at)
SELECT 'Martin Larsen', 'Oslo Tannlege', 'Rutinekontroll', 'completed', now() - interval '2 hours 30 min'
WHERE NOT EXISTS (SELECT 1 FROM patient_referrals WHERE patient_name = 'Martin Larsen');

INSERT INTO patient_referrals (patient_name, clinic_name, reason, status, created_at)
SELECT 'Silje Bakken', 'Nordre Tannklinikk', 'Kjeveortoped-henvisning', 'pending', now() - interval '3 hours 20 min'
WHERE NOT EXISTS (SELECT 1 FROM patient_referrals WHERE patient_name = 'Silje Bakken');
