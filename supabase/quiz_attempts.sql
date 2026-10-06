create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  percentage numeric(5, 2) not null check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

grant select, insert on public.quiz_attempts to authenticated;

drop policy if exists "Students can record their own quiz attempts" on public.quiz_attempts;
create policy "Students can record their own quiz attempts"
  on public.quiz_attempts
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'student'
    )
  );

drop policy if exists "Admins can view quiz attempts" on public.quiz_attempts;
create policy "Admins can view quiz attempts"
  on public.quiz_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'superadmin')
    )
  );
