-- Extend the existing Nyumba Link properties table without replacing its data.
-- Existing columns retained: id, owner_id, title, description, location,
-- monthly_rent, property_type, status, created_at.

alter table public.properties
  add column if not exists deposit integer not null default 0,
  add column if not exists institution text not null default '',
  add column if not exists distance_m integer not null default 0,
  add column if not exists furnished boolean not null default false,
  add column if not exists wifi boolean not null default false,
  add column if not exists water boolean not null default false,
  add column if not exists security boolean not null default false,
  add column if not exists bills_included boolean not null default false,
  add column if not exists availability text not null default 'Available',
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists moderation_note text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists properties_public_search_idx
  on public.properties (status, institution, property_type, monthly_rent);
create index if not exists properties_owner_idx
  on public.properties (owner_id, created_at desc);

create or replace function public.set_property_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_property_updated_at();

-- Advertisers may edit their listing, but cannot publish it themselves or
-- change its owner. A declined listing may be resubmitted for admin review.
create or replace function public.protect_property_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
begin
  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid();

  if actor_role is distinct from 'admin' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'A listing owner cannot be changed';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('rejected', 'unavailable') and new.status = 'pending') then
      raise exception 'Only an administrator can change listing review status';
    end if;
    if new.moderation_note is distinct from old.moderation_note
       and not (old.status in ('rejected', 'unavailable') and new.status = 'pending' and new.moderation_note is null) then
      raise exception 'Only an administrator can change listing review notes';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_protect_moderation on public.properties;
create trigger properties_protect_moderation
before update on public.properties
for each row execute function public.protect_property_moderation();

alter table public.properties enable row level security;
grant select on public.properties to anon, authenticated;
grant update, delete on public.properties to authenticated;
revoke insert on public.properties from anon, authenticated;
drop policy if exists "Verified advertisers can create pending listings" on public.properties;

-- Keep the existing advertiser update policy but explicitly recreate it.
drop policy if exists "Verified advertisers can update their own listings" on public.properties;
create policy "Verified advertisers can update their own listings"
on public.properties for update to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('landlord', 'agent')
      and p.verification_status = 'verified'
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('landlord', 'agent')
      and p.verification_status = 'verified'
  )
);

drop policy if exists "Verified advertisers can delete their own listings" on public.properties;
create policy "Verified advertisers can delete their own listings"
on public.properties for delete to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('landlord', 'agent')
      and p.verification_status = 'verified'
  )
);

drop policy if exists "Administrators can update properties" on public.properties;
create policy "Administrators can update properties"
on public.properties for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
)
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- New listings must use the paid-listing RPC in listing_payments.sql. Existing
-- read, update and delete policies remain in force; the public reads published rows.
