-- Repair the save RPC on projects where storage.objects also has an owner column.
-- Apply after 003. No row changes, grants changes, or RLS changes. Safe to rerun.
begin;
do $$ begin
  if public.dormmart_contract_version() <> 4 then
    raise exception 'Expected contract_version 4; apply migrations 001-003 first';
  end if;
end $$;

create or replace function public.dormmart_save_product(p_id uuid,p_product jsonb,p_paths text[],p_create boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_actor_id uuid := auth.uid(); changed uuid; image_path text;
begin
  if v_actor_id is null then raise exception 'Authentication required'; end if;
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
    if image_path is null or split_part(image_path,'/',1)<>v_actor_id::text or image_path ~ '(^|/)\.\.?(/|$)' then raise exception 'Invalid image ownership'; end if;
    if not exists (select 1 from storage.objects where bucket_id='product-images' and name=image_path and owner_id=v_actor_id::text) then raise exception 'Upload image first'; end if;
  end loop;
  -- Stable client UUID permits retry after a lost response without duplicate products.
  if p_create and not exists (select 1 from public.products where id=p_id and seller_id=v_actor_id) then
    insert into public.products (id,seller_id,title,description,category,listing_type,price,deposit,condition,area,status,available_from,available_until,blocked_from,blocked_until)
    values(p_id,v_actor_id,p_product->>'title',p_product->>'description',p_product->>'category',p_product->>'listing_type',
      (p_product->>'price')::numeric,(p_product->>'deposit')::numeric,p_product->>'condition',p_product->>'area',p_product->>'status',
      (p_product->>'available_from')::date,(p_product->>'available_until')::date,(p_product->>'blocked_from')::date,(p_product->>'blocked_until')::date)
    returning id into changed;
  else
    update public.products set title=p_product->>'title',description=p_product->>'description',category=p_product->>'category',
      listing_type=p_product->>'listing_type',price=(p_product->>'price')::numeric,deposit=(p_product->>'deposit')::numeric,
      condition=p_product->>'condition',area=p_product->>'area',status=p_product->>'status',
      available_from=(p_product->>'available_from')::date,available_until=(p_product->>'available_until')::date,
      blocked_from=(p_product->>'blocked_from')::date,blocked_until=(p_product->>'blocked_until')::date
    where id=p_id and seller_id=v_actor_id and deleted_at is null returning id into changed;
    if changed is null then raise exception 'Product unavailable or not owned'; end if;
  end if;
  delete from public.product_images where product_id=p_id;
  insert into public.product_images(product_id,storage_path,position)
    select p_id,path,ordinality-1 from unnest(p_paths) with ordinality as paths(path,ordinality);
  return changed;
end $$;

-- This repair preserves the version-4 API contract.
notify pgrst, 'reload schema';
commit;
select public.dormmart_contract_version() as contract_version;
