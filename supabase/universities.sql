-- Shared list of universities, colleges, and TVET institutions available in accommodation filters.
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists universities_name_case_insensitive_key
  on public.universities (lower(name));

alter table public.universities enable row level security;
grant select on public.universities to anon, authenticated;
grant insert, update, delete on public.universities to authenticated;

drop policy if exists "Anyone can view active universities" on public.universities;
create policy "Anyone can view active universities"
on public.universities for select to anon, authenticated
using (
  active
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

drop policy if exists "Administrators can manage universities" on public.universities;
create policy "Administrators can manage universities"
on public.universities for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- Keep the original demo institutions available. The earlier expanded demo seed
-- is retired below; admin-created institutions (created_by is set) are preserved.
update public.universities
set active = false
where created_by is null
  and name in (
    'Moi University',
    'Maseno University',
    'Masinde Muliro University of Science and Technology',
    'Dedan Kimathi University of Technology',
    'Chuka University',
    'Kisii University',
    'Machakos University',
    'Technical University of Kenya',
    'Multimedia University of Kenya',
    'Mount Kenya University',
    'Strathmore University',
    'Kenya Medical Training College',
    'Kenya Utalii College',
    'Kenya Institute of Mass Communication',
    'Nairobi Technical Training Institute',
    'Kabete National Polytechnic',
    'Kenya School of TVET',
    'The Kenya Coast National Polytechnic',
    'Kisumu National Polytechnic',
    'Eldoret National Polytechnic',
    'Nyeri National Polytechnic',
    'The Siaya National Polytechnic'
  );

-- These are the four institutions used by the original demo listings.
insert into public.universities (name) values
  ('Kenyatta University'),
  ('JKUAT'),
  ('University of Nairobi'),
  ('Egerton University')
on conflict (name) do update
set active = true;
