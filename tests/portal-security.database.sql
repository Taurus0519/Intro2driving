-- Run AFTER the migration, inside the SAME transaction; ROLLBACK afterward.
-- This uses existing account IDs with temporary sessions, without changing
-- passwords, PINs, or saved records. Test schedules use explicit negative IDs
-- so validation does not advance the live course schedule sequence.
create temporary table portal_test_context as
select profile.id as user_id, gen_random_uuid() as session_id
from public.profiles profile join auth.users account on account.id = profile.id
where profile.role = 'student' and profile.status = 'Active' limit 1;
grant select on portal_test_context to authenticated, service_role;
do $$
declare result jsonb; number integer;
begin
  if not exists (select 1 from portal_test_context) then raise exception 'Need an active student fixture'; end if;
  for number in 1..3 loop
    result := public.reserve_portal_attempt(repeat('a', 64));
    if not (result->>'allowed')::boolean or (result->>'attempts_left')::integer <> 3-number then raise exception 'Attempt counter failed'; end if;
  end loop;
  result := public.reserve_portal_attempt(repeat('a', 64));
  if (result->>'allowed')::boolean then raise exception 'Fourth attempt was allowed'; end if;
  update public.portal_login_attempts set blocked_until = now() - interval '1 second' where key = repeat('a', 64);
  result := public.reserve_portal_attempt(repeat('a', 64));
  if not (result->>'allowed')::boolean or (result->>'attempts_left')::integer <> 2 then raise exception 'Expired lock did not reset'; end if;
  if has_function_privilege('authenticated', 'public.reserve_portal_attempt(text)', 'execute')
    or has_function_privilege('anon', 'public.unlock_portal_session(uuid,uuid,text)', 'execute')
    or has_table_privilege('authenticated', 'public.portal_pin_credentials', 'select') then raise exception 'Security secrets are exposed'; end if;
end;
$$;
insert into auth.sessions(id, user_id, created_at, updated_at)
select session_id, user_id, now(), now() from portal_test_context;
insert into public.portal_pin_credentials(user_id, pin_hash, answer_hash, question_id)
select user_id, 'scrypt:' || repeat('1',32) || ':' || repeat('2',128), 'test-answer-hash', 'first-school' from portal_test_context;
select set_config('request.jwt.claims', (select jsonb_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text from portal_test_context), true);
set local role authenticated;
do $$
begin
  if portal_private.session_unlocked() then raise exception 'Password-only session was unlocked'; end if;
  if exists (select 1 from public.profiles) then raise exception 'Locked session could read profiles'; end if;
  if exists (select 1 from public.onsite_course_sessions) then raise exception 'Locked session could read schedules'; end if;
  begin
    perform public.reserve_portal_attempt(repeat('b',64));
    raise exception 'Authenticated caller could change rate limits';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role service_role;
select public.unlock_portal_session(user_id, session_id, 'scrypt:' || repeat('1',32) || ':' || repeat('2',128)) from portal_test_context;
set local role authenticated;
do $$
begin
  if not portal_private.session_unlocked() then raise exception 'Verified session remained locked'; end if;
  if not exists (select 1 from public.profiles where id = (select user_id from portal_test_context)) then raise exception 'Unlocked session could not read own profile'; end if;
  if exists (select 1 from public.student_profiles where student_id::text <> (select user_id::text from portal_test_context)) then raise exception 'Student could read another personal profile'; end if;
  begin
    update public.profiles set role = 'superadmin' where id = (select user_id from portal_test_context);
    raise exception 'Student could change their own role';
  exception when raise_exception then
    if sqlerrm <> 'Only a superadmin can change account roles' then raise; end if;
  end;
  begin
    insert into public.onsite_course_sessions(id, course_date, course_type) values (-90000000, '2099-01-15', 'onsite');
    raise exception 'Student could change schedules';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
update public.portal_verified_sessions set last_activity_at = now() - interval '5 minutes';
set local role authenticated;
do $$ begin
  if portal_private.session_unlocked() then raise exception 'Idle session stayed unlocked after five minutes'; end if;
end; $$;
reset role;
set local role service_role;
select public.unlock_portal_session(user_id, session_id, 'scrypt:' || repeat('1',32) || ':' || repeat('2',128)) from portal_test_context;
select public.replace_portal_pin(user_id, 'scrypt:' || repeat('3',32) || ':' || repeat('4',128), 'scrypt:' || repeat('1',32) || ':' || repeat('2',128)) from portal_test_context;
set local role authenticated;
do $$ begin
  if portal_private.session_unlocked() then raise exception 'PIN reset did not lock the old session'; end if;
end; $$;
reset role;
do $$
declare fixture_user uuid; fixture_session uuid;
begin
  select user_id, session_id into fixture_user, fixture_session from portal_test_context;
  begin
    perform public.unlock_portal_session(fixture_user, fixture_session, 'scrypt:' || repeat('1',32) || ':' || repeat('2',128));
    raise exception 'Old PIN hash could unlock after reset';
  exception when raise_exception then
    if sqlerrm <> 'PIN changed. Verify it again.' then raise; end if;
  end;
end;
$$;
insert into public.onsite_course_sessions(id, course_date, course_type) values
  (-90000001, '2099-01-15', 'onsite'), (-90000002, '2099-01-15', 'online'), (-90000003, '2099-01-15', 'additional');
do $$ begin
  if (select count(*) from public.onsite_course_sessions where course_date = '2099-01-15') <> 3 then raise exception 'Multiple course types on one date failed'; end if;
  begin
    insert into public.onsite_course_sessions(id, course_date, course_type) values (-90000004, '2099-01-15', 'onsite');
    raise exception 'Duplicate course type and date were accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.onsite_course_sessions(id, course_date, course_type) values (-90000004, '2099-01-16', 'invalid');
    raise exception 'Invalid course type was accepted';
  exception when check_violation then null; end;
end; $$;
