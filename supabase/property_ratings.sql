-- One rating per student and published listing, with public aggregate scores
-- and private in-app notifications for the listing owner.

create table if not exists public.property_ratings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (property_id, student_id)
);

create index if not exists property_ratings_property_idx
  on public.property_ratings (property_id, created_at desc);

alter table public.property_ratings enable row level security;
grant select on public.property_ratings to authenticated;
revoke insert, update, delete on public.property_ratings from anon, authenticated;

drop policy if exists "Students can read their own property ratings"
  on public.property_ratings;
create policy "Students can read their own property ratings"
on public.property_ratings for select to authenticated
using (student_id = (select auth.uid()));

create or replace view public.property_rating_summary as
select
  r.property_id,
  round(avg(r.rating)::numeric, 1) as average_rating,
  count(*)::integer as rating_count
from public.property_ratings r
join public.properties p on p.id = r.property_id
where p.status = 'published'
group by r.property_id;

grant select on public.property_rating_summary to anon, authenticated;

create table if not exists public.property_rating_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  property_title text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists property_rating_notifications_owner_idx
  on public.property_rating_notifications (owner_id, created_at desc);

alter table public.property_rating_notifications enable row level security;
grant select on public.property_rating_notifications to authenticated;
grant update (read_at) on public.property_rating_notifications to authenticated;
revoke insert, delete on public.property_rating_notifications from anon, authenticated;

drop policy if exists "Listing owners can read their rating notifications"
  on public.property_rating_notifications;
create policy "Listing owners can read their rating notifications"
on public.property_rating_notifications for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Listing owners can mark rating notifications read"
  on public.property_rating_notifications;
create policy "Listing owners can mark rating notifications read"
on public.property_rating_notifications for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create or replace function public.notify_property_rating_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid;
  v_title text;
begin
  select p.owner_id, p.title into v_owner_id, v_title
  from public.properties p
  where p.id = new.property_id and p.status = 'published';

  if v_owner_id is not null then
    insert into public.property_rating_notifications (
      owner_id, property_id, property_title, rating
    ) values (
      v_owner_id, new.property_id, coalesce(v_title, 'Your listing'), new.rating
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists property_ratings_notify_owner on public.property_ratings;
create trigger property_ratings_notify_owner
after insert on public.property_ratings
for each row execute function public.notify_property_rating_owner();

create or replace function public.submit_property_rating(
  p_property_id uuid,
  p_rating integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_owner_id uuid;
  v_rating_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Log in with a student account to rate a listing';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if v_role is distinct from 'student' then
    raise exception using errcode = '42501', message = 'Only student accounts can rate listings';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'Choose a rating from 1 to 5 stars';
  end if;

  select p.owner_id into v_owner_id
  from public.properties p
  where p.id = p_property_id and p.status = 'published';
  if not found then
    raise exception using errcode = 'P0002', message = 'This listing is no longer available for rating';
  end if;
  if v_owner_id = v_user_id then
    raise exception using errcode = '42501', message = 'You cannot rate your own listing';
  end if;

  insert into public.property_ratings (property_id, student_id, rating)
  values (p_property_id, v_user_id, p_rating::smallint)
  returning id into v_rating_id;
  return v_rating_id;
end;
$function$;

revoke all on function public.submit_property_rating(uuid, integer) from public, anon;
grant execute on function public.submit_property_rating(uuid, integer) to authenticated;
