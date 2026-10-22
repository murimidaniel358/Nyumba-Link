-- Allow administrators to permanently remove a user account and its
-- Nyumba Link listings and verification requests.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted_count integer := 0;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception using errcode = '22023', message = 'Choose another user account';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator accounts cannot be deleted from this directory';
  end if;

  delete from public.properties where owner_id = p_user_id;
  delete from public.verification_requests where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;

  delete from auth.users where id = p_user_id;
  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then
    raise exception using errcode = 'P0002', message = 'User account was not found';
  end if;
end;
$function$;

revoke all on function public.admin_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
