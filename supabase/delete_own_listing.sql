-- Let verified landlords and agents permanently remove only their own listings.
-- Deleting a property cascades to student saved-listing references.
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
