-- Student-only saved listings.
create table if not exists public.saved_listings (
  student_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, property_id)
);

alter table public.saved_listings enable row level security;
grant select, insert, delete on public.saved_listings to authenticated;

drop policy if exists "Students can view their saved listings" on public.saved_listings;
create policy "Students can view their saved listings"
on public.saved_listings for select to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student'
  )
);

drop policy if exists "Students can save published listings" on public.saved_listings;
create policy "Students can save published listings"
on public.saved_listings for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student'
  )
  and exists (
    select 1 from public.properties pr
    where pr.id = property_id
      and pr.status = 'published'
      and pr.paid_through > now()
  )
);

drop policy if exists "Students can remove their saved listings" on public.saved_listings;
create policy "Students can remove their saved listings"
on public.saved_listings for delete to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student'
  )
);
