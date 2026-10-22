-- Listing photo storage for verified landlords and agents.
-- Run this once in the Supabase SQL editor after listing_payments.sql.

alter table public.properties
  add column if not exists image_paths text[] not null default '{}',
  add column if not exists cover_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view listing photos" on storage.objects;
create policy "Public can view listing photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'property-images');

drop policy if exists "Verified advertisers upload own listing photos" on storage.objects;
create policy "Verified advertisers upload own listing photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('landlord', 'agent') and p.verification_status = 'verified'
  )
);

drop policy if exists "Advertisers manage own listing photos" on storage.objects;
create policy "Advertisers manage own listing photos"
on storage.objects for delete to authenticated
using (bucket_id = 'property-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.submit_listing_for_review(p_listing jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_verification_status text;
  v_property_id uuid;
  v_image_paths text[];
  v_cover_path text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Sign in before submitting a listing';
  end if;
  select p.role, p.verification_status
  into v_role, v_verification_status
  from public.profiles p where p.id = v_user_id;
  if not found or v_role not in ('landlord', 'agent') or v_verification_status is distinct from 'verified' then
    raise exception using errcode = '42501', message = 'Only verified landlords and agents can submit listings';
  end if;
  if p_listing is null or jsonb_typeof(p_listing) <> 'object'
     or coalesce(trim(p_listing->>'title'), '') = ''
     or coalesce(trim(p_listing->>'location'), '') = ''
     or coalesce(trim(p_listing->>'institution'), '') = ''
     or coalesce(trim(p_listing->>'contact_name'), '') = ''
     or coalesce(trim(p_listing->>'contact_phone'), '') = '' then
    raise exception using errcode = '22023', message = 'Complete the required listing details';
  end if;
  if jsonb_typeof(p_listing->'image_paths') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Add at least two listing photos';
  end if;
  if jsonb_array_length(p_listing->'image_paths') < 2 then
    raise exception using errcode = '22023', message = 'Add at least two listing photos';
  end if;
  select array_agg(value) into v_image_paths from jsonb_array_elements_text(p_listing->'image_paths') as photos(value);
  v_cover_path := p_listing->>'cover_image_path';
  if v_cover_path is null or not (v_cover_path = any(v_image_paths))
     or exists (select 1 from unnest(v_image_paths) as paths(image_path) where image_path not like v_user_id::text || '/%') then
    raise exception using errcode = '22023', message = 'Choose a cover photo from your uploaded listing photos';
  end if;

  insert into public.properties (
    owner_id, title, description, location, monthly_rent, property_type,
    status, deposit, institution, distance_m, furnished, wifi, water,
    security, bills_included, availability, contact_name, contact_phone, paid_through,
    image_paths, cover_image_path
  ) values (
    v_user_id,
    trim(p_listing->>'title'),
    coalesce(p_listing->>'description', ''),
    trim(p_listing->>'location'),
    (p_listing->>'monthly_rent')::numeric,
    p_listing->>'property_type',
    'pending',
    coalesce((p_listing->>'deposit')::integer, 0),
    trim(p_listing->>'institution'),
    coalesce((p_listing->>'distance_m')::integer, 0),
    coalesce((p_listing->>'furnished')::boolean, false),
    coalesce((p_listing->>'wifi')::boolean, false),
    coalesce((p_listing->>'water')::boolean, false),
    coalesce((p_listing->>'security')::boolean, false),
    coalesce((p_listing->>'bills_included')::boolean, false),
    coalesce(p_listing->>'availability', 'Available'),
    trim(p_listing->>'contact_name'),
    trim(p_listing->>'contact_phone'), null,
    v_image_paths, v_cover_path
  ) returning id into v_property_id;

  return v_property_id;
end;
$function$;

revoke all on function public.submit_listing_for_review(jsonb) from public, anon;
grant execute on function public.submit_listing_for_review(jsonb) to authenticated;
