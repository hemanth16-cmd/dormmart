-- Disposable test database only. Reconstructed from the user's exported columns/constraints.
create role anon; create role authenticated;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text,university text,avatar_url text,created_at timestamptz default now());
create table public.products(id uuid primary key default gen_random_uuid(),seller_id uuid not null references public.profiles,title text not null,description text,price numeric not null check(price>=0),category text,condition text,listing_type text not null default 'sale' constraint products_listing_type_check check(listing_type in ('sale','rent','both')),status text not null default 'active' check(status in ('active','reserved','sold','inactive')),created_at timestamptz default now());
create table public.product_images(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete cascade,storage_path text not null,created_at timestamptz default now());
create table public.conversations(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products,buyer_id uuid not null references auth.users,seller_id uuid not null references auth.users,created_at timestamptz not null default now(),constraint different_participants check(buyer_id<>seller_id),constraint unique_product_conversation unique(product_id,buyer_id,seller_id));
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations on delete cascade,sender_id uuid not null references auth.users,content text not null check(char_length(content) between 1 and 5000),created_at timestamptz not null default now());
-- Minimal storage metadata for RLS tests, not an emulation of the Storage HTTP API.
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,created_at timestamptz default now(),unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing;return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated;
grant truncate,references,trigger on all tables in schema public to anon,authenticated;
grant select on public.products,public.product_images to anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.products,public.product_images to authenticated;
grant select,insert on public.conversations,public.messages to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
