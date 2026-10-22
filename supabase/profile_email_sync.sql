-- Keep the profile email available to administrator account tables.
-- Auth remains the source of truth for each account's email address.

alter table public.profiles
  add column if not exists email text;

update public.profiles as p
set email = u.email
from auth.users as u
where p.id = u.id
  and p.email is distinct from u.email;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;

  return new;
end;
$function$;

create or replace function public.fill_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.profiles as p
  set email = u.email
  from auth.users as u
  where p.id = new.id
    and u.id = new.id
    and p.email is distinct from u.email;

  return new;
end;
$function$;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;
revoke all on function public.fill_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists sync_profile_email_after_auth_user_change on auth.users;
create trigger sync_profile_email_after_auth_user_change
after insert or update of email on auth.users
for each row
execute function public.sync_profile_email_from_auth();

drop trigger if exists fill_profile_email_after_profile_insert on public.profiles;
create trigger fill_profile_email_after_profile_insert
after insert on public.profiles
for each row
execute function public.fill_profile_email_from_auth();
