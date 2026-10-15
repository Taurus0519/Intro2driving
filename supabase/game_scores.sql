create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  level integer not null check (level > 0),
  score integer not null check (score >= 0),
  max_score integer not null check (max_score > 0),
  recorded_at timestamptz not null default now()
);

create index if not exists game_scores_player_level_idx
  on public.game_scores (player_id, level, recorded_at desc);

alter table public.game_scores enable row level security;

create policy "Students can view their own game scores"
on public.game_scores for select
to authenticated
using (auth.uid() = player_id);

create policy "Students can insert their own game scores"
on public.game_scores for insert
to authenticated
with check (auth.uid() = player_id);

create policy "Admins can view all game scores"
on public.game_scores for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  )
);
