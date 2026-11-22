-- READ ONLY. Run in the Supabase SQL editor and export every result set.
-- No user rows, auth credentials or private messages are selected.
select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in ('profiles','products','product_images','conversations','messages')
order by table_name,ordinal_position;

select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','products','product_images','conversations','messages');

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where (schemaname='public' and tablename in ('profiles','products','product_images','conversations','messages'))
or (schemaname='storage' and tablename='objects');

select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in ('public.profiles'::regclass,'public.products'::regclass,'public.product_images'::regclass,'public.conversations'::regclass,'public.messages'::regclass);

select event_object_schema,event_object_table,trigger_name,action_statement
from information_schema.triggers where event_object_schema in ('auth','public');

select n.nspname,p.proname,p.prosecdef,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.oid in (select tgfoid from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal);

select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='product-images';
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('profiles','products','product_images','conversations','messages')
and grantee in ('anon','authenticated');
