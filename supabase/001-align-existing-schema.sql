-- Run this complete file once in Supabase SQL Editor. Changes are transactional.
-- No user rows are deleted.
begin;
-- The earlier seller-policy bug must not leave historical spoofed conversations unnoticed.
do $$begin
  if exists(select 1 from public.conversations c join public.products p on p.id=c.product_id where c.seller_id<>p.seller_id) then
    raise exception 'Existing conversations do not match product sellers. Review those rows before continuing; no data has been changed.';
  end if;
end$$;
-- Reviewed against the user's exported schema/policies on 22 November 2026.
-- No tables or user rows are deleted. Existing both/reserved/sold values are retained.
alter table public.profiles add column if not exists bio text not null default '';
alter table public.products
  add column if not exists deposit numeric not null default 0,
  add column if not exists area text not null default '',
  add column if not exists available_from date,
  add column if not exists available_until date,
  add column if not exists blocked_from date,
  add column if not exists blocked_until date,
  add column if not exists deleted_at timestamptz;
alter table public.product_images add column if not exists position integer;
with ranked as (
  select id, (row_number() over(partition by product_id order by created_at nulls last,id)-1)::integer as pos
  from public.product_images
)
update public.product_images i set position=r.pos from ranked r where r.id=i.id and i.position is null;
alter table public.product_images alter column position set not null;
alter table public.product_images add constraint dormmart_image_position_unique unique(product_id,position);
alter table public.product_images add constraint dormmart_image_position_nonnegative check(position>=0);

alter table public.products drop constraint products_listing_type_check;
alter table public.products add constraint products_listing_type_check check(listing_type in ('sale','rent','both','share'));
-- NOT VALID avoids rejecting historic rows during installation, while constraining new writes.
alter table public.products add constraint dormmart_product_values check (
  price between 0 and 1000000 and deposit between 0 and 1000000
  and (listing_type<>'share' or price=0)
  and (listing_type in ('rent','both') or deposit=0)
  and length(trim(title)) between 1 and 70
  and char_length(description)<=1000 and char_length(area)<=80
  and char_length(category)<=80 and char_length(condition)<=80
) not valid;
alter table public.products add constraint dormmart_product_dates check (
  (available_from is null and available_until is null or available_from is not null and available_until is not null and available_from<available_until)
  and (blocked_from is null and blocked_until is null or blocked_from is not null and blocked_until is not null
    and available_from is not null and available_until is not null
    and blocked_from<blocked_until and blocked_from>=available_from and blocked_until<=available_until)
) not valid;
alter table public.profiles add constraint dormmart_profile_lengths check (
  char_length(full_name)<=60 and char_length(university)<=100 and char_length(bio)<=300
) not valid;
-- Preserve old messages up to the existing 5000-character limit; prevent new whitespace-only messages.
alter table public.messages add constraint dormmart_message_nonblank check (content ~ '[^[:space:]]') not valid;

revoke truncate,references,trigger on public.profiles,public.products,public.product_images,public.conversations,public.messages from public,anon,authenticated;
revoke update on public.product_images from public,anon,authenticated;
revoke update,delete on public.conversations,public.messages from public,anon,authenticated;

-- Owners retain database visibility of archived items. The catalogue explicitly excludes them.
-- Chat rows/messages survive archive; buyers see an unavailable-listing label.
alter policy "View active products" on public.products using (
  seller_id=(select auth.uid())
  or (status='active' and deleted_at is null)
);
alter policy "Start own conversations" on public.conversations with check (
  buyer_id=(select auth.uid()) and buyer_id<>seller_id
  and exists(select 1 from public.products p where p.id=conversations.product_id
    and p.seller_id=conversations.seller_id and p.status='active' and p.deleted_at is null)
);

create policy "Read own product photo metadata" on storage.objects for select to authenticated
using (bucket_id='product-images' and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy "Upload own product photos" on storage.objects with check (
  bucket_id='product-images' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name !~ '(^|/)\.\.?(/|$)'
);
alter policy "Add own product images" on public.product_images with check (
  exists(select 1 from public.products p where p.id=product_images.product_id
    and p.seller_id=(select auth.uid()) and p.deleted_at is null)
  and split_part(storage_path,'/',1)=(select auth.uid())::text
  and exists(select 1 from storage.objects o where o.bucket_id='product-images'
    and o.name=product_images.storage_path and o.owner_id=(select auth.uid())::text)
);
alter policy "Delete own product photos" on storage.objects using (
  bucket_id='product-images' and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.product_images i where i.storage_path=objects.name)
);

create index if not exists dormmart_products_seller_idx on public.products(seller_id);
create index if not exists dormmart_images_product_idx on public.product_images(product_id);
create index if not exists dormmart_conversations_seller_idx on public.conversations(seller_id);
create index if not exists dormmart_conversations_buyer_idx on public.conversations(buyer_id);
create index if not exists dormmart_messages_chat_time_idx on public.messages(conversation_id,created_at,id);

-- Transaction functions for the verified seller_id/listing_type schema.
create or replace function public.dormmart_save_product(p_id uuid,p_product jsonb,p_paths text[],p_create boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare owner uuid := auth.uid(); changed uuid; image_path text;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if p_id is null or p_create is null or p_product is null then raise exception 'Invalid product'; end if;
  if coalesce(array_length(p_paths,1),0) not between 1 and 3 then raise exception 'One to three images required'; end if;
  if length(trim(coalesce(p_product->>'title',''))) not between 1 and 70
    or length(trim(coalesce(p_product->>'description',''))) not between 1 and 1000
    or length(trim(coalesce(p_product->>'area',''))) not between 1 and 80
    or coalesce(p_product->>'listing_type','') not in ('sale','rent','share','both')
    or coalesce(p_product->>'status','') not in ('active','reserved','sold','inactive')
    or coalesce((p_product->>'price')::numeric,-1) not between 0 and 1000000
    or coalesce((p_product->>'deposit')::numeric,-1) not between 0 and 1000000
    then raise exception 'Invalid product details'; end if;
  if (p_product->>'listing_type'='share' and (p_product->>'price')::numeric<>0)
    or (p_product->>'listing_type'<>'rent' and (p_product->>'deposit')::numeric<>0)
    or (p_product->>'listing_type'='sale' and p_product->>'status'='reserved')
    or (p_product->>'listing_type'not in ('sale','both') and p_product->>'status'='sold')
    then raise exception 'Invalid mode, price or status'; end if;
  if p_product->>'listing_type'not in ('sale','both') and (
    nullif(p_product->>'available_from','') is null or nullif(p_product->>'available_until','') is null
    or (p_product->>'available_from')::date >= (p_product->>'available_until')::date)
    then raise exception 'Invalid availability dates'; end if;
  if (p_product->>'blocked_from' is null) <> (p_product->>'blocked_until' is null)
    or ((p_product->>'blocked_from')::date >= (p_product->>'blocked_until')::date)
    or ((p_product->>'blocked_from')::date < (p_product->>'available_from')::date)
    or ((p_product->>'blocked_until')::date > (p_product->>'available_until')::date)
    then raise exception 'Invalid blocked dates'; end if;
  foreach image_path in array p_paths loop
    if image_path is null or split_part(image_path,'/',1)<>owner::text or image_path ~ '(^|/)\.\.?(/|$)' then raise exception 'Invalid image ownership'; end if;
    if not exists (select 1 from storage.objects where bucket_id='product-images' and name=image_path and owner_id=owner::text) then raise exception 'Upload image first'; end if;
  end loop;
  -- Stable client UUID permits retry after a lost response without duplicate products.
  if p_create and not exists (select 1 from public.products where id=p_id and seller_id=owner) then
    insert into public.products (id,seller_id,title,description,category,listing_type,price,deposit,condition,area,status,available_from,available_until,blocked_from,blocked_until)
    values(p_id,owner,p_product->>'title',p_product->>'description',p_product->>'category',p_product->>'listing_type',
      (p_product->>'price')::numeric,(p_product->>'deposit')::numeric,p_product->>'condition',p_product->>'area',p_product->>'status',
      (p_product->>'available_from')::date,(p_product->>'available_until')::date,(p_product->>'blocked_from')::date,(p_product->>'blocked_until')::date)
    returning id into changed;
  else
    update public.products set title=p_product->>'title',description=p_product->>'description',category=p_product->>'category',
      listing_type=p_product->>'listing_type',price=(p_product->>'price')::numeric,deposit=(p_product->>'deposit')::numeric,
      condition=p_product->>'condition',area=p_product->>'area',status=p_product->>'status',
      available_from=(p_product->>'available_from')::date,available_until=(p_product->>'available_until')::date,
      blocked_from=(p_product->>'blocked_from')::date,blocked_until=(p_product->>'blocked_until')::date
    where id=p_id and seller_id=owner and deleted_at is null returning id into changed;
    if changed is null then raise exception 'Product unavailable or not owned'; end if;
  end if;
  delete from public.product_images where product_id=p_id;
  insert into public.product_images(product_id,storage_path,position)
    select p_id,path,ordinality-1 from unnest(p_paths) with ordinality as paths(path,ordinality);
  return changed;
end $$;

create or replace function public.dormmart_delete_product(p_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare removed uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Archive rather than deleting: existing conversation foreign keys and history remain intact.
  update public.products set deleted_at=coalesce(deleted_at,now()),status='inactive'
  where id=p_id and seller_id=auth.uid() returning id into removed;
  if removed is null then raise exception 'Product unavailable or not owned'; end if;
  return removed;
end $$;

create or replace function public.dormmart_start_conversation(p_product_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare seller uuid; conversation uuid; buyer uuid := auth.uid();
begin
  if buyer is null then raise exception 'Authentication required'; end if;
  select seller_id into seller from public.products where id=p_product_id and status='active' and deleted_at is null;
  if seller is null or seller=buyer then raise exception 'Invalid recipient'; end if;
  -- Requires UNIQUE(product_id,buyer_id,seller_id). Concurrent calls converge.
  insert into public.conversations(product_id,buyer_id,seller_id) values(p_product_id,buyer,seller)
    on conflict(product_id,buyer_id,seller_id) do nothing returning id into conversation;
  if conversation is null then
    select id into conversation from public.conversations where product_id=p_product_id and buyer_id=buyer and seller_id=seller;
  end if;
  if conversation is null then raise exception 'Conversation unavailable'; end if;
  return conversation;
end $$;

create or replace function public.dormmart_contract_version()
returns integer language sql stable security invoker set search_path='' as $$ select 2 $$;

revoke all on function public.dormmart_save_product(uuid,jsonb,text[],boolean) from public,anon;
revoke all on function public.dormmart_delete_product(uuid) from public,anon;
revoke all on function public.dormmart_start_conversation(uuid) from public,anon;
revoke all on function public.dormmart_contract_version() from public,anon;
grant execute on function public.dormmart_save_product(uuid,jsonb,text[],boolean) to authenticated;
grant execute on function public.dormmart_delete_product(uuid) to authenticated;
grant execute on function public.dormmart_start_conversation(uuid) to authenticated;
grant execute on function public.dormmart_contract_version() to authenticated;

commit;
select public.dormmart_contract_version() as contract_version;
