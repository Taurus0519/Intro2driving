create index if not exists quiz_attempts_student_created_id_idx
  on public.quiz_attempts (student_id, created_at, id);

create or replace function public.enforce_quiz_attempt_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_attempts bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.student_id::text, 0)
  );

  select count(*)
  into existing_attempts
  from public.quiz_attempts
  where student_id = new.student_id;

  if existing_attempts >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'You have used all 5 quiz attempts across the course.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_quiz_attempt_limit() from public, anon, authenticated;

drop trigger if exists enforce_quiz_attempt_limit on public.quiz_attempts;
create trigger enforce_quiz_attempt_limit
  before insert on public.quiz_attempts
  for each row
  execute function public.enforce_quiz_attempt_limit();
