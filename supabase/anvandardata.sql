-- Finanskollen: egen tabell för varje användares bevakning, larm och portföljer.
-- Klistra in allt i Supabase → SQL Editor → Run. Går att köra flera gånger.

create table if not exists public.anvandardata (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  veckobrev boolean not null default false,
  uppdaterad timestamptz not null default now()
);

alter table public.anvandardata enable row level security;

-- Varje inloggad användare ser och ändrar bara sin egen rad
drop policy if exists "egen rad läsa" on public.anvandardata;
drop policy if exists "egen rad skapa" on public.anvandardata;
drop policy if exists "egen rad ändra" on public.anvandardata;
drop policy if exists "egen rad radera" on public.anvandardata;
create policy "egen rad läsa" on public.anvandardata for select to authenticated using (auth.uid() = user_id);
create policy "egen rad skapa" on public.anvandardata for insert to authenticated with check (auth.uid() = user_id);
create policy "egen rad ändra" on public.anvandardata for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "egen rad radera" on public.anvandardata for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.anvandardata to authenticated;
revoke all on public.anvandardata from anon;

-- Veckobrevet: en hemlig nyckel som bara Netlify känner till, och en funktion som
-- med den nyckeln får e-post och data för de som har valt att få veckobrevet.
create schema if not exists privat;
revoke all on schema privat from public, anon, authenticated;
create table if not exists privat.installning (namn text primary key, varde text not null);
insert into privat.installning (namn, varde)
  values ('veckobrev_nyckel', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (namn) do nothing;

create or replace function public.veckobrev_mottagare(nyckel text)
returns table (email text, namn text, data jsonb)
language plpgsql
security definer
set search_path = public, privat, auth
as $$
begin
  if nyckel is null or nyckel <> (select varde from privat.installning where installning.namn = 'veckobrev_nyckel') then
    raise exception 'fel nyckel';
  end if;
  return query
    select u.email::text, coalesce(u.raw_user_meta_data->>'full_name', '')::text, a.data
    from public.anvandardata a join auth.users u on u.id = a.user_id
    where a.veckobrev = true and u.email is not null;
end;
$$;
revoke all on function public.veckobrev_mottagare(text) from public, anon, authenticated;
grant execute on function public.veckobrev_mottagare(text) to anon;

-- Visar nyckeln som ska in i Netlify som VECKOBREV_NYCKEL
select varde as veckobrev_nyckel from privat.installning where namn = 'veckobrev_nyckel';
