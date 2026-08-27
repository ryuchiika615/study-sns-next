-- X公式アカウント開始記念: 先着30名の創設メンバー永久Pro。
-- 決済完了Webhook（Service Role）だけが確定処理を行う。

create table if not exists public.founder_member_reservations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  checkout_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

alter table public.founder_member_reservations enable row level security;
drop policy if exists "founder_member_reservations_read_own" on public.founder_member_reservations;
create policy "founder_member_reservations_read_own"
  on public.founder_member_reservations for select using (auth.uid() = user_id);

create or replace function public.reserve_founder_member_slot(p_user_id uuid, p_checkout_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taken integer;
begin
  -- Serialize reservations so that no more than 30 checkout links can exist.
  lock table public.founder_member_reservations in share row exclusive mode;
  update public.founder_member_reservations
     set status = 'expired'
   where status = 'pending' and expires_at <= now();

  if exists (select 1 from public.founder_member_reservations where user_id = p_user_id and status in ('pending', 'confirmed')) then
    return false;
  end if;

  select count(*) into v_taken
    from public.founder_member_reservations
   where status in ('pending', 'confirmed');
  if v_taken >= 30 then return false; end if;

  insert into public.founder_member_reservations (user_id, checkout_session_id, expires_at)
  values (p_user_id, p_checkout_session_id, now() + interval '30 minutes')
  on conflict (user_id) do update
    set checkout_session_id = excluded.checkout_session_id,
        status = 'pending', reserved_at = now(), expires_at = excluded.expires_at,
        confirmed_at = null
    where public.founder_member_reservations.status = 'expired';
  return found;
end;
$$;

create or replace function public.confirm_founder_member_slot(p_checkout_session_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_title_id uuid;
  v_frame_id uuid;
begin
  lock table public.founder_member_reservations in share row exclusive mode;
  select user_id into v_user_id
    from public.founder_member_reservations
   where checkout_session_id = p_checkout_session_id
     and status in ('pending', 'confirmed')
     and (status = 'confirmed' or expires_at > now());
  if v_user_id is null then return null; end if;

  update public.founder_member_reservations
     set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
   where checkout_session_id = p_checkout_session_id;

  insert into public.pro_grants (user_id, source, starts_at, expires_at, note)
  select v_user_id, 'campaign', now(), null, '創設メンバー永久Pro（X公式開始記念）'
  where not exists (
    select 1 from public.pro_grants
    where user_id = v_user_id and source = 'campaign'
      and note = '創設メンバー永久Pro（X公式開始記念）' and revoked_at is null
  );

  select id into v_title_id from public.gacha_items where name = '創設メンバー' and category = 'title' limit 1;
  if v_title_id is null then
    insert into public.gacha_items (name, rarity, category) values ('創設メンバー', 'LR', 'title') returning id into v_title_id;
  end if;
  select id into v_frame_id from public.gacha_items where name = '創設者の星冠' and category = 'icon' limit 1;
  if v_frame_id is null then
    insert into public.gacha_items (name, rarity, category) values ('創設者の星冠', 'XR', 'icon') returning id into v_frame_id;
  end if;
  insert into public.user_items (user_id, item_id) values (v_user_id, v_title_id) on conflict do nothing;
  insert into public.user_items (user_id, item_id) values (v_user_id, v_frame_id) on conflict do nothing;
  update public.profiles
     set current_title_id = coalesce(current_title_id, v_title_id),
         current_avatar_id = coalesce(current_avatar_id, v_frame_id)
   where id = v_user_id;
  insert into public.notifications (recipient_id, sender_id, notification_type, message)
  values (v_user_id, v_user_id, 'achievement', '🎉 創設メンバー永久Proになりました。限定称号と限定フレームを受け取りました。');
  return v_user_id;
end;
$$;

grant execute on function public.reserve_founder_member_slot(uuid, text) to service_role;
grant execute on function public.confirm_founder_member_slot(text) to service_role;
