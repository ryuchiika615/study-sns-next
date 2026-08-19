-- Pro学習計画とStripe契約の紐付け。既存のPro付与・既存データは変更しない。

alter table public.pro_grants add column if not exists provider_subscription_id text;
create unique index if not exists idx_pro_grants_provider_subscription
  on public.pro_grants(provider_subscription_id)
  where provider_subscription_id is not null;

create table if not exists public.pro_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_name text not null check (char_length(exam_name) between 1 and 100),
  exam_date date not null,
  weekly_minutes integer not null check (weekly_minutes between 30 and 10080),
  current_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pro_study_plans_user_created on public.pro_study_plans(user_id, created_at desc);

alter table public.pro_study_plans enable row level security;
create policy "users_read_own_pro_study_plans" on public.pro_study_plans for select using (auth.uid() = user_id);
create policy "users_insert_own_pro_study_plans" on public.pro_study_plans for insert with check (auth.uid() = user_id);
create policy "users_update_own_pro_study_plans" on public.pro_study_plans for update using (auth.uid() = user_id);
create policy "users_delete_own_pro_study_plans" on public.pro_study_plans for delete using (auth.uid() = user_id);

create or replace function public.enforce_pro_study_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pro_grants where user_id = new.user_id and revoked_at is null and starts_at <= now() and (expires_at is null or expires_at > now())) then
    raise exception 'この機能はPro限定です。' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_pro_study_plan_insert on public.pro_study_plans;
create trigger enforce_pro_study_plan_insert before insert on public.pro_study_plans for each row execute function public.enforce_pro_study_plan();
