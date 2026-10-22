-- Student viewing requests with private access for the student and verified owner.

create table if not exists public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  property_title text not null,
  property_area text not null,
  student_name text not null,
  student_email text not null,
  student_phone text,
  preferred_at timestamptz not null,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  response_note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists viewing_requests_student_idx
  on public.viewing_requests (student_id, created_at desc);
create index if not exists viewing_requests_property_idx
  on public.viewing_requests (property_id, created_at desc);
create unique index if not exists viewing_requests_one_pending_per_student_property
  on public.viewing_requests (student_id, property_id)
  where status = 'pending';

alter table public.viewing_requests enable row level security;
grant select on public.viewing_requests to authenticated;

drop policy if exists "Students and listing owners can view viewing requests"
  on public.viewing_requests;
create policy "Students and listing owners can view viewing requests"
on public.viewing_requests for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1
    from public.properties pr
    join public.profiles advertiser on advertiser.id = (select auth.uid())
    where pr.id = viewing_requests.property_id
      and pr.owner_id = (select auth.uid())
      and advertiser.role in ('landlord', 'agent')
      and advertiser.verification_status = 'verified'
  )
);

create or replace function public.request_property_viewing(
  p_property_id uuid,
  p_preferred_at timestamptz,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_property public.properties%rowtype;
  v_student public.profiles%rowtype;
  v_email text;
  v_request_id uuid;
  v_message text := trim(coalesce(p_message, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in as a student to request a viewing';
  end if;

  select p.* into v_student
  from public.profiles p
  where p.id = v_user_id;
  if not found or v_student.role is distinct from 'student' then
    raise exception using errcode = '42501', message = 'Only student accounts can request a property viewing';
  end if;

  if p_preferred_at is null or p_preferred_at <= now() or p_preferred_at > now() + interval '60 days' then
    raise exception using errcode = '22023', message = 'Choose a viewing time within the next 60 days';
  end if;
  if length(v_message) > 1000 then
    raise exception using errcode = '22023', message = 'Your note must be 1,000 characters or fewer';
  end if;

  select pr.* into v_property
  from public.properties pr
  where pr.id = p_property_id
    and pr.status = 'published'
    and lower(coalesce(pr.availability, '')) not in ('fully booked', 'unavailable')
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'This listing is no longer available for viewing requests';
  end if;
  if v_property.owner_id = v_user_id then
    raise exception using errcode = '42501', message = 'You cannot request a viewing for your own listing';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;

  insert into public.viewing_requests (
    property_id, student_id, property_title, property_area,
    student_name, student_email, student_phone, preferred_at, message
  ) values (
    v_property.id, v_user_id, v_property.title, v_property.location,
    coalesce(nullif(trim(v_student.full_name), ''), 'Student'),
    coalesce(v_email, ''), nullif(trim(v_student.phone), ''),
    p_preferred_at, v_message
  )
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.request_property_viewing(uuid, timestamptz, text) from public, anon;
grant execute on function public.request_property_viewing(uuid, timestamptz, text) to authenticated;

create or replace function public.respond_to_viewing_request(
  p_request_id uuid,
  p_decision text,
  p_response_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_verified text;
  v_request public.viewing_requests%rowtype;
  v_note text := trim(coalesce(p_response_note, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in before responding to viewing requests';
  end if;
  select p.role, p.verification_status into v_role, v_verified
  from public.profiles p where p.id = v_user_id;
  if v_role is null or v_role not in ('landlord', 'agent') or v_verified is distinct from 'verified' then
    raise exception using errcode = '42501', message = 'Only verified advertisers can respond to viewing requests';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception using errcode = '22023', message = 'Choose accept or decline';
  end if;
  if length(v_note) > 1000 then
    raise exception using errcode = '22023', message = 'Your response must be 1,000 characters or fewer';
  end if;

  select vr.* into v_request
  from public.viewing_requests vr
  join public.properties pr on pr.id = vr.property_id
  where vr.id = p_request_id and pr.owner_id = v_user_id and vr.status = 'pending'
  for update of vr;
  if not found then return false; end if;

  update public.viewing_requests
  set status = p_decision,
      response_note = nullif(v_note, ''),
      responded_at = now()
  where id = v_request.id and status = 'pending';
  return found;
end;
$function$;

revoke all on function public.respond_to_viewing_request(uuid, text, text) from public, anon;
grant execute on function public.respond_to_viewing_request(uuid, text, text) to authenticated;
