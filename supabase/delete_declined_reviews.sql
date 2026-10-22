-- Allow administrators to permanently remove one declined application or
-- property listing from the declined-review history.
create or replace function public.delete_declined_review(
  p_request_id uuid,
  p_request_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_request_type in ('landlord', 'agent') then
    delete from public.verification_requests
    where id = p_request_id
      and applicant_role = p_request_type
      and status = 'rejected';
  elsif p_request_type = 'property' then
    delete from public.properties
    where id = p_request_id
      and status = 'rejected';
  else
    raise exception using errcode = '22023', message = 'Invalid declined request type';
  end if;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$function$;

revoke all on function public.delete_declined_review(uuid, text) from public, anon;
grant execute on function public.delete_declined_review(uuid, text) to authenticated;
