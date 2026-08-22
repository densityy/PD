-- Lock sensitive patient/chat data behind trusted Edge Functions.
-- The service-role key bypasses RLS; browsers using the anon key do not.

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.patient_referrals enable row level security;
alter table public.dashboard_stats enable row level security;

drop policy if exists "anon_select_conversations" on public.conversations;
drop policy if exists "anon_insert_conversations" on public.conversations;
drop policy if exists "anon_update_conversations" on public.conversations;
drop policy if exists "anon_delete_conversations" on public.conversations;

drop policy if exists "anon_select_messages" on public.messages;
drop policy if exists "anon_insert_messages" on public.messages;
drop policy if exists "anon_update_messages" on public.messages;
drop policy if exists "anon_delete_messages" on public.messages;

drop policy if exists "anon_select_referrals" on public.patient_referrals;
drop policy if exists "anon_insert_referrals" on public.patient_referrals;
drop policy if exists "anon_update_referrals" on public.patient_referrals;
drop policy if exists "anon_delete_referrals" on public.patient_referrals;

drop policy if exists "anon_insert_stats" on public.dashboard_stats;
drop policy if exists "anon_update_stats" on public.dashboard_stats;
drop policy if exists "anon_delete_stats" on public.dashboard_stats;

-- Aggregated, non-personal statistics may remain publicly readable.
drop policy if exists "anon_select_stats" on public.dashboard_stats;
create policy "public_read_aggregate_stats"
  on public.dashboard_stats
  for select
  to anon, authenticated
  using (true);

-- Consent evidence and a short, explicit retention window.
alter table public.conversations
  add column if not exists health_consent_at timestamptz,
  add column if not exists referral_consent_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

alter table public.patient_referrals
  add column if not exists referral_consent_at timestamptz,
  add column if not exists privacy_notice_version text,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

create index if not exists conversations_expires_at_idx
  on public.conversations (expires_at);

create index if not exists patient_referrals_expires_at_idx
  on public.patient_referrals (expires_at);

-- Remove only the demo identities inserted by the dashboard seed migration.
delete from public.patient_referrals
where patient_name in (
  'Emma Johansen',
  'Martin Larsen',
  'Silje Bakken'
);

delete from public.conversations
where patient_name in (
  'Emma Johansen',
  'Martin Larsen',
  'Silje Bakken',
  'Jonas Berg',
  'Maria Pettersen'
)
and patient_phone in (
  '+47 982 34 567',
  '+47 901 23 456',
  '+47 956 78 901',
  '+47 934 56 789',
  '+47 978 12 345'
);

-- Called by a trusted scheduled worker; never executable by public clients.
create or replace function public.purge_expired_patient_data()
returns table (deleted_referrals bigint, deleted_conversations bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_count bigint;
  conversation_count bigint;
begin
  delete from public.patient_referrals where expires_at <= now();
  get diagnostics referral_count = row_count;

  delete from public.conversations where expires_at <= now();
  get diagnostics conversation_count = row_count;

  return query select referral_count, conversation_count;
end;
$$;

revoke all on function public.purge_expired_patient_data() from public, anon, authenticated;
grant execute on function public.purge_expired_patient_data() to service_role;
