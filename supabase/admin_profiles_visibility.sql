-- Allow authenticated administrators to read profiles for the admin's
-- landlord, agent, and student directories without exposing them publicly.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$function$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Administrators can view all profiles" on public.profiles;
create policy "Administrators can view all profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_is_admin())
);
