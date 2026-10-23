create or replace function portal_private.student_module_unlocked()
returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.portal_verified_sessions v join auth.sessions s on s.id=v.session_id and s.user_id=v.user_id
 join public.profiles p on p.id=v.user_id
 where v.user_id=(select auth.uid()) and v.session_id::text=(select auth.jwt()->>'session_id')
 and v.last_activity_at>now()-interval '5 minutes' and p.status is distinct from 'Inactive');
$$;
revoke all on function portal_private.student_module_unlocked() from public, anon;
grant execute on function portal_private.student_module_unlocked() to authenticated, service_role;
create or replace function portal_private.session_unlocked()
returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from auth.sessions s join public.profiles p on p.id=s.user_id
 where s.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
 and p.role in ('student','admin','superadmin') and p.status is distinct from 'Inactive');
$$;
create policy student_module_pin_required on public.student_profiles as restrictive for all to authenticated
 using ((select portal_private.account_role())='student' or (select portal_private.student_module_unlocked()))
 with check ((select portal_private.account_role())='student' or (select portal_private.student_module_unlocked()));
delete from public.portal_verified_sessions;
notify pgrst, 'reload schema';
