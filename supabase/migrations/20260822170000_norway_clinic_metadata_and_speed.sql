-- Norway-only clinic metadata used by the public finder and background workers.
alter table if exists public.clinic_directory
  add column if not exists country_code text not null default 'NO',
  add column if not exists nav_guarantee_accepted boolean,
  add column if not exists nav_guarantee_source_url text,
  add column if not exists nav_guarantee_checked_at timestamptz,
  add column if not exists price_refresh_requested_at timestamptz,
  add column if not exists last_seen_at timestamptz not null default now();

alter table if exists public.clinic_directory
  drop constraint if exists clinic_directory_country_code_check;

alter table if exists public.clinic_directory
  add constraint clinic_directory_country_code_check
  check (country_code = 'NO');

create index if not exists clinic_directory_country_seen_idx
  on public.clinic_directory (country_code, last_seen_at desc);

create index if not exists clinic_directory_norway_price_refresh_idx
  on public.clinic_directory (price_refresh_requested_at nulls first, last_seen_at desc)
  where country_code = 'NO';

create index if not exists clinic_prices_place_treatment_verified_idx
  on public.clinic_prices (google_place_id, treatment_id, verified_at desc);

create index if not exists clinic_price_queue_norway_status_idx
  on public.clinic_price_refresh_queue (status, requested_at)
  where status in ('pending', 'processing');
