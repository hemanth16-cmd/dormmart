-- PROPOSAL ONLY: not applied. Requires the verified contract in docs/SUPABASE.md.
-- Do not run against existing tables until audit.sql has been reviewed and column
-- mappings, constraints, foreign keys and RLS have been reconciled. No RLS bypass.
begin;

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
    or coalesce(p_product->>'mode','') not in ('buy','rent','share')
    or coalesce(p_product->>'status','') not in ('available','sold','rented')
    or coalesce((p_product->>'price')::numeric,-1) not between 0 and 1000000
    or coalesce((p_product->>'deposit')::numeric,-1) not between 0 and 1000000
    then raise exception 'Invalid product details'; end if;
  if (p_product->>'mode'='share' and (p_product->>'price')::numeric<>0)
    or (p_product->>'mode'<>'rent' and (p_product->>'deposit')::numeric<>0)
    or (p_product->>'mode'='buy' and p_product->>'status'='rented')
    or (p_product->>'mode'<>'buy' and p_product->>'status'='sold')
    then raise exception 'Invalid mode, price or status'; end if;
  if p_product->>'mode'<>'buy' and (
    nullif(p_product->>'available_from','') is null or nullif(p_product->>'available_until','') is null
    or (p_product->>'available_from')::date >= (p_product->>'available_until')::date)
    then raise exception 'Invalid availability dates'; end if;
  if (p_product->>'blocked_from' is null) <> (p_product->>'blocked_until' is null)
    or ((p_product->>'blocked_from')::date >= (p_product->>'blocked_until')::date)
    or ((p_product->>'blocked_from')::date < (p_product->>'available_from')::date)
    or ((p_product->>'blocked_until')::date > (p_product->>'available_until')::date)
    then raise exception 'Invalid blocked dates'; end if;
  foreach image_path in array p_paths loop
    if image_path is null or image_path !~ ('^'||owner::text||'/'||p_id::text||'/[a-f0-9-]{36}\.jpg$') then raise exception 'Invalid image ownership'; end if;
    if not exists (select 1 from storage.objects where bucket_id='product-images' and name=image_path) then raise exception 'Upload image first'; end if;
  end loop;
  -- Stable client UUID permits retry after a lost response without duplicate products.
  if p_create and not exists (select 1 from public.products where id=p_id and owner_id=owner) then
    insert into public.products (id,owner_id,title,description,category,mode,price,deposit,condition,area,status,available_from,available_until,blocked_from,blocked_until)
    values(p_id,owner,p_product->>'title',p_product->>'description',p_product->>'category',p_product->>'mode',
      (p_product->>'price')::numeric,(p_product->>'deposit')::numeric,p_product->>'condition',p_product->>'area',p_product->>'status',
      (p_product->>'available_from')::date,(p_product->>'available_until')::date,(p_product->>'blocked_from')::date,(p_product->>'blocked_until')::date)
    returning id into changed;
  else
    update public.products set title=p_product->>'title',description=p_product->>'description',category=p_product->>'category',
      mode=p_product->>'mode',price=(p_product->>'price')::numeric,deposit=(p_product->>'deposit')::numeric,
      condition=p_product->>'condition',area=p_product->>'area',status=p_product->>'status',
      available_from=(p_product->>'available_from')::date,available_until=(p_product->>'available_until')::date,
      blocked_from=(p_product->>'blocked_from')::date,blocked_until=(p_product->>'blocked_until')::date
    where id=p_id and owner_id=owner returning id into changed;
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
  -- Requires image FK ON DELETE CASCADE and conversation product FK ON DELETE SET NULL.
  delete from public.products where id=p_id and owner_id=auth.uid() returning id into removed;
  if removed is null then raise exception 'Product unavailable or not owned'; end if;
  return removed;
end $$;

create or replace function public.dormmart_start_conversation(p_product_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare seller uuid; conversation uuid; buyer uuid := auth.uid();
begin
  if buyer is null then raise exception 'Authentication required'; end if;
  select owner_id into seller from public.products where id=p_product_id for share;
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
returns integer language sql stable security invoker set search_path='' as $$ select 1 $$;

revoke all on function public.dormmart_save_product(uuid,jsonb,text[],boolean) from public,anon;
revoke all on function public.dormmart_delete_product(uuid) from public,anon;
revoke all on function public.dormmart_start_conversation(uuid) from public,anon;
revoke all on function public.dormmart_contract_version() from public,anon;
grant execute on function public.dormmart_save_product(uuid,jsonb,text[],boolean) to authenticated;
grant execute on function public.dormmart_delete_product(uuid) to authenticated;
grant execute on function public.dormmart_start_conversation(uuid) to authenticated;
grant execute on function public.dormmart_contract_version() to authenticated;
commit;
