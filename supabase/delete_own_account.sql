-- Allow students, advertiser applicants, landlords and agents to permanently delete their own account.
-- Administrator accounts cannot use this self-service endpoint.
create or replace function public.delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_deleted_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in before deleting your account';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  if v_role is null or v_role not in ('student', 'applicant', 'landlord', 'agent') then
    raise exception using errcode = '42501', message = 'This account cannot use self-service deletion';
  end if;

  -- Remove dependent application data explicitly, then remove the Auth user.
  delete from public.properties where owner_id = v_user_id;
  delete from public.verification_requests where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception using errcode = 'P0002', message = 'User account was not found';
  end if;
  return true;
end;
$function$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
