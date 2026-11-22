-- DormMart migration 002. Run once in the Supabase SQL Editor AFTER 001 (contract_version = 2).
-- Transactional and additive: no tables, columns, rows, policies or files are removed.
--
-- 1. Server-owned timestamps. Clients could previously send their own created_at on
--    INSERT through the REST API (e.g. back-dating a chat message or forcing a listing to
--    the top of "newest"). Triggers now overwrite created_at with now() on insert and
--    keep the original value on update. Existing rows are not touched.
-- 2. Abandoned-upload report. A read-only function, callable only from the SQL Editor or
--    with the service role, lists product-image files that no listing references and that
--    are older than a grace period. It never deletes anything.
-- 3. contract_version becomes 3. The frontend accepts 2 or 3.
begin;

do $$begin
  if public.dormmart_contract_version() <> 2 then
    raise exception 'Expected contract_version 2 (migration 001). Nothing was changed.';
  end if;
end$$;

create function public.dormmart_server_created_at()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then new.created_at := now();
  else new.created_at := old.created_at;
  end if;
  return new;
end $$;
revoke all on function public.dormmart_server_created_at() from public,anon,authenticated;

create trigger dormmart_messages_created_at before insert on public.messages
  for each row execute function public.dormmart_server_created_at();
create trigger dormmart_conversations_created_at before insert on public.conversations
  for each row execute function public.dormmart_server_created_at();
create trigger dormmart_products_created_at before insert or update on public.products
  for each row execute function public.dormmart_server_created_at();
create trigger dormmart_product_images_created_at before insert on public.product_images
  for each row execute function public.dormmart_server_created_at();

-- Files in product-images that no product_images row references, older than p_grace.
-- Archived listings keep their image rows, so their files are never reported.
create function public.dormmart_unreferenced_uploads(p_grace interval default interval '24 hours')
returns table(name text, owner_id text, created_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select o.name, o.owner_id, o.created_at
  from storage.objects o
  where o.bucket_id='product-images'
    and o.created_at < now() - greatest(p_grace, interval '1 hour')
    and not exists (select 1 from public.product_images i where i.storage_path=o.name)
  order by o.created_at
$$;
revoke all on function public.dormmart_unreferenced_uploads(interval) from public,anon,authenticated;
do $$begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    execute 'grant execute on function public.dormmart_unreferenced_uploads(interval) to service_role';
  end if;
end$$;

create or replace function public.dormmart_contract_version()
returns integer language sql stable security invoker set search_path='' as $$ select 3 $$;

commit;
select public.dormmart_contract_version() as contract_version;
