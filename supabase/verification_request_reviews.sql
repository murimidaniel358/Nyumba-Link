-- Let administrators read the request history and review applications
-- atomically, updating both the request and the applicant profile.
alter table public.verification_requests enable row level security;
grant select on public.verification_requests to authenticated;

drop policy if exists "Administrators can view all verification requests"
  on public.verification_requests;
create policy "Administrators can view all verification requests"
on public.verification_requests for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.verification_requests%rowtype;
  v_updated_count integer := 0;
  v_profile_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'Decision must be approved or rejected';
  end if;

  select vr.* into v_request
  from public.verification_requests vr
  where vr.id = p_request_id and vr.status = 'pending'
  for update;

  if not found then
    return 0;
  end if;

  if p_decision = 'approved' then
    if v_request.applicant_role not in ('landlord', 'agent') then
      raise exception using errcode = '22023', message = 'Invalid advertiser role on request';
    end if;

    update public.profiles
    set role = v_request.applicant_role,
        verification_status = 'verified'
    where id = v_request.user_id;
    get diagnostics v_profile_count = row_count;

    if v_profile_count = 0 then
      raise exception using errcode = 'P0002', message = 'Applicant profile not found';
    end if;

    update public.verification_requests
    set status = 'approved'
    where id = v_request.id and status = 'pending';
    get diagnostics v_updated_count = row_count;
  else
    update public.verification_requests
    set status = 'rejected'
    where user_id = v_request.user_id
      and applicant_role = v_request.applicant_role
      and status = 'pending';
    get diagnostics v_updated_count = row_count;
  end if;

  return v_updated_count;
end;
$function$;

revoke all on function public.review_verification_request(uuid, text) from public, anon;
grant execute on function public.review_verification_request(uuid, text) to authenticated;
