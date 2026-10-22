-- Give landlord and agent applicants a distinct role until an administrator
-- approves them. Run after admin_inbox.sql.

do $migration$
declare
  v_constraint record;
  v_had_role_check boolean := false;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', v_constraint.conname);
    v_had_role_check := true;
  end loop;

  if v_had_role_check then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'applicant', 'landlord', 'agent', 'admin'))
      not valid;
    alter table public.profiles validate constraint profiles_role_check;
  end if;
end;
$migration$;

-- Move existing pending or suspended advertiser applicants out of the
-- student role while preserving their application history.
update public.profiles p
set role = 'applicant'
where p.role = 'student'
  and exists (
    select 1
    from public.verification_requests vr
    where vr.user_id = p.id
      and vr.applicant_role in ('landlord', 'agent')
      and vr.status in ('pending', 'rejected')
  );

create or replace function public.submit_advertiser_application(
  p_applicant_role text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_profile_role text;
  v_request_id uuid;
  v_details text := trim(coalesce(p_details, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in before submitting an advertiser application';
  end if;
  if p_applicant_role is null or p_applicant_role not in ('landlord', 'agent') then
    raise exception using errcode = '22023', message = 'Choose landlord or agent as your advertiser role';
  end if;
  if v_details = '' or length(v_details) > 4000 then
    raise exception using errcode = '22023', message = 'Add application details before submitting';
  end if;

  select p.role into v_profile_role
  from public.profiles p
  where p.id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Your account profile could not be found';
  end if;
  if v_profile_role is null or v_profile_role not in ('student', 'applicant') then
    raise exception using errcode = '42501', message = 'This account cannot submit a new advertiser application';
  end if;

  select vr.id into v_request_id
  from public.verification_requests vr
  where vr.user_id = v_user_id and vr.status = 'pending'
  order by vr.created_at desc
  limit 1
  for update;
  if found then
    if exists (
      select 1 from public.verification_requests vr
      where vr.id = v_request_id and vr.applicant_role = p_applicant_role
    ) then
      return v_request_id;
    end if;
    raise exception using errcode = '23505', message = 'You already have an advertiser application waiting for review';
  end if;

  if v_profile_role = 'applicant' then
    raise exception using errcode = '42501', message = 'Update your suspended application from your inbox';
  end if;

  update public.profiles
  set role = 'applicant'
  where id = v_user_id and role = 'student';

  insert into public.verification_requests (user_id, applicant_role, details, status)
  values (v_user_id, p_applicant_role, v_details, 'pending')
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.submit_advertiser_application(text, text) from public, anon;
grant execute on function public.submit_advertiser_application(text, text) to authenticated;

-- Keep reapplication available after an advertiser request is suspended.
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
  if v_role is null or v_role not in ('applicant', 'student') then
    raise exception using errcode = '42501', message = 'Only advertiser applicants can reapply';
  end if;
  if v_details = '' or length(v_details) > 4000 then
    raise exception using errcode = '22023', message = 'Add updated application details before resubmitting';
  end if;
  if not exists (
    select 1 from public.verification_requests vr
    where vr.id = p_request_id and vr.user_id = v_user_id and vr.status = 'rejected'
  ) then
    raise exception using errcode = '42501', message = 'This suspended application cannot be resubmitted';
  end if;
  if exists (
    select 1 from public.verification_requests vr
    where vr.user_id = v_user_id and vr.status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'You already have an application waiting for review';
  end if;

  update public.profiles set role = 'applicant'
  where id = v_user_id and role = 'student';

  insert into public.verification_requests (user_id, applicant_role, details, status)
  select v_user_id, vr.applicant_role, v_details, 'pending'
  from public.verification_requests vr where vr.id = p_request_id
  returning id into v_new_request_id;
  return v_new_request_id;
end;
$function$;

revoke all on function public.resubmit_verification_request(uuid, text) from public, anon;
grant execute on function public.resubmit_verification_request(uuid, text) to authenticated;

-- Keep self-service account deletion available to pending applicants.
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
