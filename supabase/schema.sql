-- Movie Journal: database-schema voor Supabase.
-- Idempotent: kan opnieuw gedraaid worden zonder data te verliezen.

-- ---------- Profielen ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Iedere ingelogde gebruiker mag profielen zien (nodig om vrienden te zoeken op gebruikersnaam)
drop policy if exists "profiles: lezen als ingelogd" on public.profiles;
create policy "profiles: lezen als ingelogd" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: eigen profiel aanpassen" on public.profiles;
create policy "profiles: eigen profiel aanpassen" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Vriendschappen: niet meer nodig, iedereen met een account ziet iedereen ----------
drop function if exists public.are_friends(uuid, uuid) cascade;
drop table if exists public.friendships cascade;

-- ---------- Journals (één JSON-document per gebruiker, zelfde vorm als journal.json) ----------
create table if not exists public.journals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null default '{"entries": [], "skipped": [], "watchlist": []}'::jsonb,
  -- Optimistic concurrency: een update slaagt alleen als de versie nog klopt
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.journals enable row level security;

-- Iedereen met een account ziet alle journals (de app is voor een vriendengroep); schrijven alleen het eigen journal
drop policy if exists "journals: eigen en van vrienden lezen" on public.journals;
drop policy if exists "journals: lezen als ingelogd" on public.journals;
create policy "journals: lezen als ingelogd" on public.journals
  for select to authenticated using (true);

drop policy if exists "journals: eigen journal schrijven" on public.journals;
create policy "journals: eigen journal schrijven" on public.journals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- App-config (API-keys voor TMDB/OMDb; alleen voor ingelogde gebruikers) ----------
create table if not exists public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;

drop policy if exists "app_config: lezen als ingelogd" on public.app_config;
create policy "app_config: lezen als ingelogd" on public.app_config
  for select to authenticated using (true);

-- ---------- Nieuwe gebruiker: profiel + leeg journal aanmaken ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into profiles (id, username, display_name)
  values (new.id, wanted, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), wanted));
  insert into journals (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vóór het aanmaken van een account controleren of een gebruikersnaam nog vrij is
create or replace function public.username_available(name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Realtime: wijzigingen in journals en nieuwe profielen live doorgeven (RLS blijft gelden) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'journals') then
    alter publication supabase_realtime add table public.journals;
  end if;
end $$;

-- ---------- Avatars (Supabase Storage, publiek leesbaar; iedereen schrijft alleen in de eigen map) ----------
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: eigen map uploaden" on storage.objects;
create policy "avatars: eigen map uploaden" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: eigen map aanpassen" on storage.objects;
create policy "avatars: eigen map aanpassen" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: eigen map opruimen" on storage.objects;
create policy "avatars: eigen map opruimen" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
