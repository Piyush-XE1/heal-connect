-- Heal Connect schema (mirrors src/server/db/types.ts, camelCase -> snake_case).
-- All timestamps and date-only values are ISO-8601 UTC text on purpose: the app
-- compares them as strings and a date like "2026-03-04" must never shift timezone.
-- RLS is enabled on every table with no policies: only the server (service role)
-- can read or write.

create table if not exists public.users (
  id text primary key,
  email text not null,
  name text not null,
  password_hash text,
  provider text not null check (provider in ('google','password','demo')),
  provider_id text,
  avatar_url text,
  role text not null check (role in ('donor','recipient','both')),
  is_admin boolean not null default false,
  is_demo boolean not null default false,
  account_status text not null default 'active' check (account_status in ('active','suspended')),
  suspended_reason text,
  onboarding_complete boolean not null default false,
  created_at text not null,
  updated_at text not null,
  last_login_at text
);
create unique index if not exists users_email_lower_key on public.users (lower(email));
create unique index if not exists users_provider_key on public.users (provider, provider_id) where provider_id is not null;

create table if not exists public.profiles (
  user_id text primary key references public.users(id) on delete cascade deferrable initially deferred,
  phone text,
  city text,
  area text,
  approx_lat double precision,
  approx_lng double precision,
  bio text,
  age integer,
  share_phone_with_matches boolean not null default false,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.donor_profiles (
  user_id text primary key references public.users(id) on delete cascade deferrable initially deferred,
  blood_group text not null check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  last_donation_date text,
  availability text not null check (availability in ('available','unavailable','on_hold')),
  preferences jsonb not null default '[]'::jsonb,
  max_travel_km integer not null default 30,
  is_visible_to_recipients boolean not null default true,
  notes text,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.help_requests (
  id text primary key,
  reference text not null,
  requester_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  request_type text not null check (request_type in ('blood','platelets','medical_assistance')),
  blood_group text check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_required integer not null check (units_required between 1 and 20),
  units_fulfilled integer not null default 0,
  hospital_name text not null,
  city text not null,
  area text,
  approx_lat double precision,
  approx_lng double precision,
  required_by text not null,
  urgency text not null check (urgency in ('normal','urgent','emergency')),
  status text not null check (status in ('draft','open','in_progress','fulfilled','cancelled','expired','removed')),
  additional_info text,
  contact_name text not null,
  contact_phone text not null,
  contact_instructions text,
  is_demo boolean not null default false,
  created_at text not null,
  updated_at text not null,
  resolved_at text,
  moderation_note text,
  removed_by text
);
create index if not exists help_requests_status_idx on public.help_requests (status);
create index if not exists help_requests_urgency_idx on public.help_requests (urgency);
create index if not exists help_requests_blood_group_idx on public.help_requests (blood_group);
create index if not exists help_requests_city_idx on public.help_requests (city);
create index if not exists help_requests_required_by_idx on public.help_requests (required_by);
create index if not exists help_requests_requester_idx on public.help_requests (requester_id);

create table if not exists public.donor_responses (
  id text primary key,
  request_id text not null references public.help_requests(id) on delete cascade deferrable initially deferred,
  donor_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  message text,
  status text not null check (status in ('pending','accepted','declined','withdrawn','completed')),
  share_contact boolean not null default false,
  created_at text not null,
  updated_at text not null,
  withdrawn_at text
);
create unique index if not exists donor_responses_active_key on public.donor_responses (request_id, donor_id) where status <> 'withdrawn';

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at text,
  created_at text not null
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table if not exists public.reports (
  id text primary key,
  reporter_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  target_type text not null check (target_type in ('user','request')),
  target_id text not null,
  reason text not null check (reason in ('misleading_information','payment_or_compensation_request','organ_trade_or_brokerage','harassment_or_abuse','spam_or_duplicate','privacy_violation','unsafe_or_illegal_activity','other')),
  details text,
  status text not null check (status in ('open','reviewing','resolved','dismissed')),
  resolution_note text,
  handled_by text,
  created_at text not null,
  updated_at text not null
);
create index if not exists reports_status_idx on public.reports (status);

create table if not exists public.verifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  organization_type text not null check (organization_type in ('individual_donor','hospital','blood_bank','ngo','patient_support_org')),
  organization_name text,
  evidence_note text,
  status text not null check (status in ('unverified','pending','verified','rejected')),
  review_note text,
  reviewed_by text,
  submitted_at text not null,
  reviewed_at text,
  is_demo boolean not null default false
);
create index if not exists verifications_status_idx on public.verifications (status);

create table if not exists public.blocks (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  blocked_user_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  created_at text not null
);

create table if not exists public.sessions (
  id text primary key,
  token_hash text not null,
  user_id text not null references public.users(id) on delete cascade deferrable initially deferred,
  created_at text not null,
  expires_at text not null,
  last_seen_at text not null
);
create unique index if not exists sessions_token_hash_key on public.sessions (token_hash);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

create table if not exists public.audit_log (
  id text primary key,
  actor_id text not null,
  action text not null,
  target_type text not null check (target_type in ('user','request','report','verification','system')),
  target_id text not null,
  note text,
  created_at text not null
);

create table if not exists public.store_counters (
  key text primary key,
  value bigint not null
);

create table if not exists public.store_meta (
  key text primary key,
  value jsonb not null
);

-- Server-only access.
do $$
declare t text;
begin
  foreach t in array array['users','profiles','donor_profiles','help_requests','donor_responses',
    'notifications','reports','verifications','blocks','sessions','audit_log','store_counters','store_meta']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Applies one mutate() change set atomically (a single transaction).
-- p_changes: { "upserts": { "<table>": [rows...] }, "deletes": { "<table>": [pk values...] } }
create or replace function public.heal_connect_apply(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  pk text;
  cols text;
  sets text;
  ordered text[] := array['users','profiles','donor_profiles','help_requests','donor_responses',
    'notifications','reports','verifications','blocks','sessions','audit_log','store_counters','store_meta'];
begin
  foreach t in array ordered loop
    pk := case when t in ('profiles','donor_profiles') then 'user_id'
               when t in ('store_counters','store_meta') then 'key'
               else 'id' end;
    if p_changes->'upserts' ? t and jsonb_array_length(p_changes->'upserts'->t) > 0 then
      select string_agg(quote_ident(column_name), ',' order by ordinal_position),
             string_agg(format('%1$I = excluded.%1$I', column_name), ',' order by ordinal_position)
        into cols, sets
        from information_schema.columns
       where table_schema = 'public' and table_name = t;
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) on conflict (%3$I) do update set %4$s',
        t, cols, pk, sets) using p_changes->'upserts'->t;
    end if;
  end loop;

  foreach t in array array['store_meta','store_counters','audit_log','sessions','blocks','verifications',
    'reports','notifications','donor_responses','help_requests','donor_profiles','profiles','users'] loop
    pk := case when t in ('profiles','donor_profiles') then 'user_id'
               when t in ('store_counters','store_meta') then 'key'
               else 'id' end;
    if p_changes->'deletes' ? t and jsonb_array_length(p_changes->'deletes'->t) > 0 then
      execute format('delete from public.%1$I where %2$I in (select jsonb_array_elements_text($1))', t, pk)
        using p_changes->'deletes'->t;
    end if;
  end loop;
end;
$$;

revoke all on function public.heal_connect_apply(jsonb) from public, anon, authenticated;
grant execute on function public.heal_connect_apply(jsonb) to service_role;
