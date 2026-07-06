-- 科目テンプレート（ユーザーがよく使う科目を保存）
create table if not exists subject_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table subject_templates enable row level security;

create policy "Users can manage own subject templates"
  on subject_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
