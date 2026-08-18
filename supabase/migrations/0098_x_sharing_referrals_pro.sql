-- X連携・共有分析・紹介・Pro権限の追加。既存データは変更しない。

create table if not exists public.x_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  x_user_id text not null unique,
  username text,
  display_name text,
  profile_image_url text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('admin', 'paid', 'campaign', 'other')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);
create index if not exists idx_pro_grants_user_active on public.pro_grants(user_id, starts_at, expires_at) where revoked_at is null;

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_clicks (
  id bigint primary key generated always as identity,
  referral_code text not null references public.referral_codes(code) on delete cascade,
  source text not null default 'direct',
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_clicks_code_created on public.referral_clicks(referral_code, created_at desc);

create table if not exists public.referrals (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  referral_code text not null references public.referral_codes(code) on delete restrict,
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  check (referred_user_id <> referrer_user_id)
);
create index if not exists idx_referrals_referrer on public.referrals(referrer_user_id, created_at desc);

create table if not exists public.share_events (
  id bigint primary key generated always as identity,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_type text not null check (share_type in ('study_record', 'ranking', 'achievement')),
  entity_id text,
  platform text not null default 'x',
  created_at timestamptz not null default now()
);
create index if not exists idx_share_events_type_created on public.share_events(share_type, created_at desc);
create index if not exists idx_share_events_user_created on public.share_events(user_id, created_at desc);

alter table public.x_connections enable row level security;
alter table public.pro_grants enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.referrals enable row level security;
alter table public.share_events enable row level security;

create policy "users_read_own_x_connection" on public.x_connections for select using (auth.uid() = user_id);
create policy "users_read_own_pro_grants" on public.pro_grants for select using (auth.uid() = user_id);
create policy "users_read_own_referral_code" on public.referral_codes for select using (auth.uid() = user_id);
create policy "users_read_own_referrals" on public.referrals for select using (auth.uid() = referred_user_id or auth.uid() = referrer_user_id);
create policy "users_read_own_share_events" on public.share_events for select using (auth.uid() = user_id);

-- 書込みはサーバーのService Role経由のみ。通常ユーザーはX情報・Pro権限・紹介実績を改ざんできない。
