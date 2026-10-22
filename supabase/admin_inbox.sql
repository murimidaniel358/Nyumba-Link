-- In-app messages from admins, with controlled review and reapplication actions.
-- Run after verification_request_reviews.sql and the existing properties setup.
alter table public.verification_requests
  add column if not exists review_note text;

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  context_type text not null check (context_type in ('application', 'listing')),
  context_id uuid not null,
  subject text not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_messages_recipient_created_idx
  on public.admin_messages (recipient_id, created_at desc);

alter table public.admin_messages enable row level security;
grant select on public.admin_messages to authenticated;
grant update (read_at) on public.admin_messages to authenticated;
grant delete on public.admin_messages to authenticated;

drop policy if exists "Users can read their admin messages" on public.admin_messages;
create policy "Users can read their admin messages"
on public.admin_messages for select to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "Users can mark their admin messages as read" on public.admin_messages;
create policy "Users can mark their admin messages as read"
on public.admin_messages for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

drop policy if exists "Users can delete their admin messages" on public.admin_messages;
create policy "Users can delete their admin messages"
on public.admin_messages for delete to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "Applicants can view their own verification requests" on public.verification_requests;
create policy "Applicants can view their own verification requests"
on public.verification_requests for select to authenticated
using (user_id = (select auth.uid()));

drop function if exists public.review_verification_request(uuid, text);
create or replace function public.review_verification_request(
  p_request_id uuid,
  p_decision text,
  p_message text default null
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
  v_message text := trim(coalesce(p_message, ''));
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
  if p_decision = 'rejected' and (v_message = '' or length(v_message) > 2000) then
    raise exception using errcode = '22023', message = 'Write a message explaining what the applicant should correct';
  end if;

  select vr.* into v_request
  from public.verification_requests vr
  where vr.id = p_request_id and vr.status = 'pending'
  for update;
  if not found then return 0; end if;

  if p_decision = 'approved' then
    if v_request.applicant_role not in ('landlord', 'agent') then
      raise exception using errcode = '22023', message = 'Invalid advertiser role on request';
    end if;
    update public.profiles
    set role = v_request.applicant_role, verification_status = 'verified'
    where id = v_request.user_id;
    get diagnostics v_profile_count = row_count;
    if v_profile_count = 0 then
      raise exception using errcode = 'P0002', message = 'Applicant profile not found';
    end if;
    update public.verification_requests set status = 'approved', review_note = null
    where id = v_request.id and status = 'pending';
    get diagnostics v_updated_count = row_count;
  else
    update public.verification_requests
    set status = 'rejected', review_note = v_message
    where user_id = v_request.user_id
      and applicant_role = v_request.applicant_role
      and status = 'pending';
    get diagnostics v_updated_count = row_count;
    insert into public.admin_messages (recipient_id, sender_id, context_type, context_id, subject, body)
    values (v_request.user_id, (select auth.uid()), 'application', v_request.id,
      'Update your advertiser application', v_message);
  end if;
  return v_updated_count;
end;
$function$;

revoke all on function public.review_verification_request(uuid, text, text) from public, anon;
grant execute on function public.review_verification_request(uuid, text, text) to authenticated;

create or replace function public.reject_property_listing(p_property_id uuid, p_message text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_property public.properties%rowtype;
  v_message text := trim(coalesce(p_message, ''));
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if v_message = '' or length(v_message) > 2000 then
    raise exception using errcode = '22023', message = 'Write a message explaining what should be corrected';
  end if;

  select pr.* into v_property
  from public.properties pr
  where pr.id = p_property_id and pr.status = 'pending'
  for update;
  if not found then return false; end if;

  update public.properties
  set status = 'rejected', moderation_note = v_message
  where id = v_property.id and status = 'pending';
  if not found then return false; end if;

  insert into public.admin_messages (recipient_id, sender_id, context_type, context_id, subject, body)
  values (v_property.owner_id, (select auth.uid()), 'listing', v_property.id,
    'Update your property listing', v_message);
  return true;
end;
$function$;

revoke all on function public.reject_property_listing(uuid, text) from public, anon;
grant execute on function public.reject_property_listing(uuid, text) to authenticated;

create or replace function public.resubmit_verification_request(p_request_id uuid, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_new_request_id uuid;
  v_details text := trim(coalesce(p_details, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in before resubmitting your application';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if v_role is distinct from 'student' then
    raise exception using errcode = '42501', message = 'Only applicants awaiting advertiser verification can reapply';
  end if;
  if v_details = '' or length(v_details) > 4000 then
    raise exception using errcode = '22023', message = 'Add updated application details before resubmitting';
  end if;
  if not exists (
    select 1 from public.verification_requests vr
    where vr.id = p_request_id and vr.user_id = v_user_id and vr.status = 'rejected'
  ) then
    raise exception using errcode = '42501', message = 'This rejected application cannot be resubmitted';
  end if;
  if exists (
    select 1 from public.verification_requests vr
    where vr.user_id = v_user_id and vr.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'You already have an application waiting for review';
  end if;

  insert into public.verification_requests (user_id, applicant_role, details, status)
  select v_user_id, vr.applicant_role, v_details, 'pending'
  from public.verification_requests vr where vr.id = p_request_id
  returning id into v_new_request_id;
  return v_new_request_id;
end;
$function$;

revoke all on function public.resubmit_verification_request(uuid, text) from public, anon;
grant execute on function public.resubmit_verification_request(uuid, text) to authenticated;
