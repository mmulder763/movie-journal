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

-- ---------- Vriendschappen ----------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships enable row level security;

drop policy if exists "friendships: eigen relaties zien" on public.friendships;
create policy "friendships: eigen relaties zien" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "friendships: verzoek sturen" on public.friendships;
create policy "friendships: verzoek sturen" on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');

-- Alleen de ontvanger mag een verzoek accepteren
drop policy if exists "friendships: verzoek accepteren" on public.friendships;
create policy "friendships: verzoek accepteren" on public.friendships
  for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());

-- Beide kanten mogen een verzoek intrekken/weigeren of een vriendschap beëindigen
drop policy if exists "friendships: verwijderen" on public.friendships;
create policy "friendships: verwijderen" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ---------- Journals (één JSON-document per gebruiker, zelfde vorm als journal.json) ----------
create table if not exists public.journals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null default '{"entries": [], "skipped": [], "watchlist": []}'::jsonb,
  -- Optimistic concurrency: een update slaagt alleen als de versie nog klopt
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.journals enable row level security;

drop policy if exists "journals: eigen en van vrienden lezen" on public.journals;
create policy "journals: eigen en van vrienden lezen" on public.journals
  for select to authenticated using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

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

-- ---------- Realtime: wijzigingen in vriendschappen en journals live doorgeven (RLS blijft gelden) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'journals') then
    alter publication supabase_realtime add table public.journals;
  end if;
end $$;
