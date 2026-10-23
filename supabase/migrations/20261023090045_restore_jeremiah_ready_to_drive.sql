-- Restore the missing website award reported as earned in the game.
-- The original game unlock timestamp is unavailable, so a newly restored row
-- records the repair time. Existing awards and their timestamps are preserved.
begin;
insert into public.player_achievements(user_id, achievement_id)
select id, 'ready_to_drive' from public.profiles
where id = '69428320-e6ac-4c17-853a-5869947e10bb'::uuid
  and role = 'student'
on conflict (user_id, achievement_id) do nothing;
do $$ begin
  if not exists (select 1 from public.player_achievements
    where user_id = '69428320-e6ac-4c17-853a-5869947e10bb'::uuid
      and achievement_id = 'ready_to_drive') then
    raise exception 'Ready to Drive repair could not be verified';
  end if;
end; $$;
commit;
