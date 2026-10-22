-- Temporary testing mode: admin approval publishes listings directly.
-- Payment tables and function definitions stay in place for re-enabling later.
-- Keep payments disabled for this deployment. Re-enable only on a separate
-- branch after the owner confirms cross-device testing is complete.

-- Remove the payment-only publication gate while this testing mode is active.
drop trigger if exists properties_protect_paid_month on public.properties;

-- Make all approved listings visible while testing, without requiring paid_through.
drop policy if exists "Public can view published properties" on public.properties;
create policy "Public can view published properties"
on public.properties for select to anon, authenticated
using (status = 'published');

-- Keep the student save action available for test listings with no paid-through date.
do $block$
begin
  if to_regclass('public.saved_listings') is not null then
    execute 'drop policy if exists "Students can save published listings" on public.saved_listings';
    execute $policy$
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
          where pr.id = property_id and pr.status = 'published'
        )
      )
    $policy$;
  end if;
end;
$block$;

-- Listings approved under the previous flow should also be available in testing mode.
update public.properties
set status = 'published', updated_at = now()
where status = 'awaiting_payment';

-- Prevent payment requests/reviews through the API during the test period.
revoke execute on function public.request_listing_payment(text, uuid) from public, anon, authenticated;
revoke execute on function public.review_listing_payment(uuid, text) from public, anon, authenticated;
