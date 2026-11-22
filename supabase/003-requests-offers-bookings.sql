-- DormMart migration 003: request board, listing offers and rental/borrow booking requests.
-- Run once in the Supabase SQL Editor AFTER 002 (contract_version must be 3).
-- Transactional and additive: only NEW tables, functions, triggers and policies are created.
-- Existing tables are not altered except for one new AFTER UPDATE trigger on products
-- (see section 4). No existing row is changed by running this file.
--
-- No payments: a booking stores an ESTIMATE (daily price x days) and the listing's deposit as
-- information only. Nothing is charged, held or refunded by DormMart.
begin;

do $$begin
  if public.dormmart_contract_version() <> 3 then
    raise exception 'Expected contract_version 3 (apply 002 first). Nothing was changed.';
  end if;
end$$;

-- Needed for the overlap-proof exclusion constraint on (product, date range).
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

------------------------------------------------------------------------------------------
-- 1. Item requests ("Can't find it? Ask your campus")
------------------------------------------------------------------------------------------
create table public.item_requests(
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  note text not null,
  category text not null default 'Other',
  request_type text not null,            -- sale | rent | share (same words as products)
  budget numeric not null default 0,     -- per day for rent, total for sale, 0 for share
  needed_by date,
  area text not null,                    -- public pickup area only
  status text not null default 'open',   -- open | closed
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_requests_values check (
    length(trim(title)) between 1 and 80 and length(trim(note)) between 1 and 600
    and length(trim(area)) between 1 and 100 and char_length(category) between 1 and 80
    and request_type in ('sale','rent','share') and status in ('open','closed')
    and budget between 0 and 1000000 and (request_type<>'share' or budget=0))
);
create index dormmart_item_requests_open_idx on public.item_requests(created_at desc) where archived_at is null;
create index dormmart_item_requests_requester_idx on public.item_requests(requester_id);

create function public.dormmart_item_requests_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.created_at := now(); new.updated_at := now(); new.status := 'open'; new.archived_at := null;
  else
    if old.archived_at is not null then raise exception 'Archived requests cannot be changed'; end if;
    new.id := old.id; new.requester_id := old.requester_id; new.created_at := old.created_at;
    new.updated_at := now();
    if new.archived_at is not null then new.archived_at := now(); end if;
  end if;
  if new.needed_by is not null and new.needed_by < current_date
     and (tg_op='INSERT' or new.needed_by is distinct from old.needed_by) then
    raise exception 'Needed-by date cannot be in the past';
  end if;
  new.title := trim(new.title); new.note := trim(new.note); new.area := trim(new.area);
  return new;
end $$;
create trigger dormmart_item_requests_guard before insert or update on public.item_requests
  for each row execute function public.dormmart_item_requests_guard();

alter table public.item_requests enable row level security;
create policy "Read item requests" on public.item_requests for select to anon, authenticated
  using (archived_at is null or requester_id=(select auth.uid()));
create policy "Create own item requests" on public.item_requests for insert to authenticated
  with check (requester_id=(select auth.uid()));
create policy "Update own item requests" on public.item_requests for update to authenticated
  using (requester_id=(select auth.uid())) with check (requester_id=(select auth.uid()));
revoke all on public.item_requests from public, anon, authenticated;
grant select on public.item_requests to anon, authenticated;
grant insert (title,note,category,request_type,budget,needed_by,area) on public.item_requests to authenticated;
grant update (title,note,category,request_type,budget,needed_by,area,status,archived_at) on public.item_requests to authenticated;

------------------------------------------------------------------------------------------
-- 2. Offers: a seller points one of their active listings at a request.
--    Visible only to the offerer and the requester. Follow-up uses normal conversations.
------------------------------------------------------------------------------------------
create table public.request_offers(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.item_requests(id) on delete cascade,
  product_id uuid not null references public.products(id),
  offerer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note text not null,
  status text not null default 'active',  -- active | withdrawn
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_offers_values check (length(trim(note)) between 1 and 400 and status in ('active','withdrawn')),
  constraint request_offers_unique unique(request_id, product_id)
);
create index dormmart_request_offers_offerer_idx on public.request_offers(offerer_id);

create function public.dormmart_request_offers_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then new.created_at := now(); new.status := 'active';
  else new.id := old.id; new.request_id := old.request_id; new.product_id := old.product_id;
       new.offerer_id := old.offerer_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now(); new.note := trim(new.note);
  return new;
end $$;
create trigger dormmart_request_offers_guard before insert or update on public.request_offers
  for each row execute function public.dormmart_request_offers_guard();

alter table public.request_offers enable row level security;
create policy "Read own or received offers" on public.request_offers for select to authenticated
  using (offerer_id=(select auth.uid()) or exists(select 1 from public.item_requests r
    where r.id=request_offers.request_id and r.requester_id=(select auth.uid())));
-- An offer needs an open, unexpired request by someone else and an active listing you own.
create policy "Offer own active listing" on public.request_offers for insert to authenticated
  with check (offerer_id=(select auth.uid())
    and exists(select 1 from public.item_requests r where r.id=request_offers.request_id
      and r.status='open' and r.archived_at is null and r.requester_id<>(select auth.uid())
      and (r.needed_by is null or r.needed_by>=current_date))
    and exists(select 1 from public.products p where p.id=request_offers.product_id
      and p.seller_id=(select auth.uid()) and p.status='active' and p.deleted_at is null));
create policy "Update own offers" on public.request_offers for update to authenticated
  using (offerer_id=(select auth.uid()))
  with check (offerer_id=(select auth.uid()) and (status='withdrawn' or exists(select 1 from public.item_requests r
    where r.id=request_offers.request_id and r.status='open' and r.archived_at is null)));
revoke all on public.request_offers from public, anon, authenticated;
grant select on public.request_offers to authenticated;
grant insert (request_id,product_id,note) on public.request_offers to authenticated;
grant update (note,status) on public.request_offers to authenticated;

-- Create or refresh an offer (idempotent per request + listing). Runs under the caller's RLS.
create function public.dormmart_offer_listing(p_request uuid, p_product uuid, p_note text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare offer uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.request_offers(request_id,product_id,note) values(p_request,p_product,p_note)
  on conflict (request_id,product_id) do update set note=excluded.note, status='active'
  returning id into offer;
  return offer;
end $$;

------------------------------------------------------------------------------------------
-- 3. Booking requests for rent and free-sharing listings (no payments).
------------------------------------------------------------------------------------------
create table public.booking_requests(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  requester_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.profiles(id),
  item_title text not null,               -- snapshot, so history survives archiving
  listing_type text not null,             -- rent | share at request time
  start_date date not null,               -- pickup
  end_date date not null,                 -- return; the item can be picked up again that day
  daily_price numeric not null,           -- snapshot
  deposit numeric not null,               -- snapshot, information only, never collected here
  estimated_total numeric not null,       -- daily_price x days (0 for sharing), excludes deposit
  note text not null default '',
  status text not null default 'pending', -- pending | accepted | rejected | cancelled | completed
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint booking_values check (start_date<end_date and requester_id<>owner_id
    and listing_type in ('rent','share') and status in ('pending','accepted','rejected','cancelled','completed')
    and char_length(note)<=500 and char_length(decision_note)<=200
    and daily_price>=0 and deposit>=0 and estimated_total>=0),
  -- Two ACCEPTED bookings for one listing can never overlap, even under concurrent accepts.
  constraint booking_no_overlap exclude using gist
    (product_id with =, daterange(start_date,end_date,'[)') with &&) where (status='accepted')
);
create index dormmart_bookings_requester_idx on public.booking_requests(requester_id);
create index dormmart_bookings_owner_idx on public.booking_requests(owner_id);
create index dormmart_bookings_product_idx on public.booking_requests(product_id, status);

alter table public.booking_requests enable row level security;
create policy "Read own bookings" on public.booking_requests for select to authenticated
  using (requester_id=(select auth.uid()) or owner_id=(select auth.uid()));
-- No direct writes: all changes go through the functions below.
revoke all on public.booking_requests from public, anon, authenticated;
grant select on public.booking_requests to authenticated;

-- Shared date rules. Raises a readable error or returns quietly.
create function public.dormmart_check_booking_dates(p public.products, p_start date, p_end date, p_ignore uuid)
returns void language plpgsql stable security definer set search_path='' as $$
declare max_days integer := (case when p.listing_type='rent' then 30 else 7 end);
begin
  if p_start is null or p_end is null or p_start>=p_end then raise exception 'Choose a return date after the pickup date'; end if;
  if p_start < current_date then raise exception 'Pickup date has passed'; end if;
  if p_end-p_start > max_days then raise exception 'Bookings can last at most % days', max_days; end if;
  if p.available_from is not null and (p_start<p.available_from or p_end>p.available_until) then
    raise exception 'Choose dates within the owner''s availability window'; end if;
  if p.blocked_from is not null and p_start<p.blocked_until and p_end>p.blocked_from then
    raise exception 'The item is unavailable on some of those dates'; end if;
  if exists(select 1 from public.booking_requests b where b.product_id=p.id and b.status='accepted'
      and b.id is distinct from p_ignore and b.start_date<p_end and b.end_date>p_start) then
    raise exception 'Those dates overlap an accepted booking'; end if;
end $$;
revoke all on function public.dormmart_check_booking_dates(public.products,date,date,uuid) from public,anon,authenticated;

create function public.dormmart_request_booking(p_id uuid, p_product uuid, p_start date, p_end date, p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); p public.products; existing public.booking_requests; days integer;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if p_id is null then raise exception 'Missing request id'; end if;
  -- Retrying with the same client id returns the original request instead of a duplicate.
  select * into existing from public.booking_requests where id=p_id;
  if found then
    if existing.requester_id<>me then raise exception 'Request id already used'; end if;
    return existing.id;
  end if;
  select * into p from public.products where id=p_product and deleted_at is null and status='active';
  if not found then raise exception 'This listing is not available'; end if;
  if p.listing_type not in ('rent','share') then raise exception 'Only rental and free-sharing listings can be booked'; end if;
  if p.seller_id=me then raise exception 'You cannot book your own listing'; end if;
  if char_length(coalesce(p_note,''))>500 then raise exception 'Note is too long'; end if;
  if (select count(*) from public.booking_requests where product_id=p_product and requester_id=me and status='pending')>=3 then
    raise exception 'You already have three pending requests for this item'; end if;
  perform public.dormmart_check_booking_dates(p,p_start,p_end,null);
  days := p_end-p_start;
  insert into public.booking_requests(id,product_id,requester_id,owner_id,item_title,listing_type,start_date,end_date,
      daily_price,deposit,estimated_total,note)
    values(p_id,p.id,me,p.seller_id,p.title,p.listing_type,p_start,p_end,
      case when p.listing_type='rent' then p.price else 0 end,
      case when p.listing_type='rent' then p.deposit else 0 end,
      case when p.listing_type='rent' then p.price*days else 0 end,
      trim(coalesce(p_note,'')));
  return p_id;
end $$;

-- accept / reject (owner, pending), cancel (requester, pending or accepted before pickup),
-- complete (owner, accepted, on or after pickup day).
create function public.dormmart_decide_booking(p_id uuid, p_action text, p_note text default '')
returns text language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid(); b public.booking_requests; p public.products; new_status text;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if char_length(coalesce(p_note,''))>200 then raise exception 'Note is too long'; end if;
  select * into b from public.booking_requests where id=p_id for update;
  if not found or me not in (b.requester_id,b.owner_id) then raise exception 'Booking not found'; end if;
  if p_action='accept' and me=b.owner_id and b.status='pending' then
    -- Serialise accepts per listing; the exclusion constraint is the final guarantee.
    select * into p from public.products where id=b.product_id for update;
    if p.deleted_at is not null or p.status<>'active' then raise exception 'This listing is no longer available'; end if;
    perform public.dormmart_check_booking_dates(p,b.start_date,b.end_date,b.id);
    new_status := 'accepted';
  elsif p_action='reject' and me=b.owner_id and b.status='pending' then new_status := 'rejected';
  elsif p_action='cancel' and me=b.requester_id and (b.status='pending' or (b.status='accepted' and b.start_date>current_date)) then new_status := 'cancelled';
  elsif p_action='complete' and me=b.owner_id and b.status='accepted' and current_date>=b.start_date then new_status := 'completed';
  else raise exception 'This action is not allowed for this booking';
  end if;
  begin
    update public.booking_requests set status=new_status, decision_note=trim(coalesce(p_note,'')), decided_at=now(), updated_at=now()
      where id=b.id;
  exception when exclusion_violation then
    raise exception 'Those dates overlap an accepted booking';
  end;
  return new_status;
end $$;

-- Public, identity-free accepted date ranges for an active listing (used by the date picker).
create function public.dormmart_booked_ranges(p_product uuid)
returns table(start_date date, end_date date) language sql stable security definer set search_path='' as $$
  select b.start_date, b.end_date from public.booking_requests b
  join public.products p on p.id=b.product_id and p.deleted_at is null and p.status='active'
  where b.product_id=p_product and b.status='accepted' and b.end_date>=current_date
  order by b.start_date
$$;

revoke all on function public.dormmart_request_booking(uuid,uuid,date,date,text) from public,anon;
revoke all on function public.dormmart_decide_booking(uuid,text,text) from public,anon;
revoke all on function public.dormmart_offer_listing(uuid,uuid,text) from public,anon;
revoke all on function public.dormmart_booked_ranges(uuid) from public;
grant execute on function public.dormmart_request_booking(uuid,uuid,date,date,text) to authenticated;
grant execute on function public.dormmart_decide_booking(uuid,text,text) to authenticated;
grant execute on function public.dormmart_offer_listing(uuid,uuid,text) to authenticated;
grant execute on function public.dormmart_booked_ranges(uuid) to anon, authenticated;

------------------------------------------------------------------------------------------
-- 4. Archiving a listing closes its open workflow items (history is kept).
------------------------------------------------------------------------------------------
create function public.dormmart_on_product_archived()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.booking_requests set status='rejected', decision_note='Listing removed by owner', decided_at=now(), updated_at=now()
    where product_id=new.id and status='pending';
  update public.request_offers set status='withdrawn' where product_id=new.id and status='active';
  return null;
end $$;
revoke all on function public.dormmart_on_product_archived() from public,anon,authenticated;
create trigger dormmart_product_archived after update of deleted_at on public.products
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.dormmart_on_product_archived();

create or replace function public.dormmart_contract_version()
returns integer language sql stable security invoker set search_path='' as $$ select 4 $$;

commit;
select public.dormmart_contract_version() as contract_version;
