-- Finanskollen: besöksstatistik utan cookies.
-- Sparar bara sammanräknade siffror per dag: sida, källa (t.ex. google.com eller tiktok) och mobil eller dator.
-- Unika besökare räknas med en hash av IP-adress och webbläsare som bara sparas i högst två dygn.
-- Ingen IP-adress sparas i klartext, och inget sparas i besökarens webbläsare.
-- Bara kontot med id 58911bfa-5fbd-4179-8e61-0ee24b77ac42 (sidans ägare) kan läsa statistiken.

create schema if not exists privat;
revoke all on schema privat from public, anon, authenticated;
create table if not exists privat.installning (namn text primary key, varde text not null);

create table if not exists privat.besok_dag (
  dag date not null, sida text not null, kalla text not null, enhet text not null,
  visningar integer not null default 0,
  primary key (dag, sida, kalla, enhet)
);
create table if not exists privat.besok_unika (dag date not null, h text not null, primary key (dag, h));
create table if not exists privat.besok_unik_dag (dag date primary key, antal integer not null default 0);

-- Räknar en sidvisning. Anropas från sidan utan inloggning.
create or replace function public.rakna_besok(p_sida text, p_kalla text default null, p_enhet text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'Europe/Stockholm')::date;
  hdrs json; ip text; ua text; salt text; ny integer;
begin
  if p_sida is null or p_sida !~ '^/[A-Za-z0-9/._^=%-]{0,100}$' then return; end if;
  p_kalla := left(coalesce(nullif(lower(trim(p_kalla)), ''), 'direkt'), 60);
  p_enhet := case when p_enhet in ('mobil', 'dator') then p_enhet else 'dator' end;
  insert into privat.besok_dag (dag, sida, kalla, enhet, visningar) values (d, p_sida, p_kalla, p_enhet, 1)
    on conflict (dag, sida, kalla, enhet) do update set visningar = privat.besok_dag.visningar + 1;
  begin hdrs := nullif(current_setting('request.headers', true), '')::json; exception when others then hdrs := null; end;
  ip := trim(split_part(coalesce(hdrs->>'x-forwarded-for', hdrs->>'x-real-ip', ''), ',', 1));
  ua := coalesce(hdrs->>'user-agent', '');
  select varde into salt from privat.installning where namn = 'besok_salt';
  if salt is null then
    salt := md5(random()::text || clock_timestamp()::text) || md5(random()::text);
    insert into privat.installning (namn, varde) values ('besok_salt', salt) on conflict (namn) do nothing;
    select varde into salt from privat.installning where namn = 'besok_salt';
  end if;
  insert into privat.besok_unika (dag, h) values (d, md5(salt || d::text || ip || ua)) on conflict do nothing;
  get diagnostics ny = row_count;
  if ny > 0 then
    insert into privat.besok_unik_dag (dag, antal) values (d, 1) on conflict (dag) do update set antal = privat.besok_unik_dag.antal + 1;
  end if;
  delete from privat.besok_unika where dag < d - 1;
end $$;

-- Statistiken. Bara sidans ägare får läsa den.
create or replace function public.besok_statistik(p_dagar integer default 30)
returns json language plpgsql security definer set search_path = '' as $$
declare fran date := (now() at time zone 'Europe/Stockholm')::date - greatest(1, least(p_dagar, 365)) + 1;
begin
  if auth.uid() is distinct from '58911bfa-5fbd-4179-8e61-0ee24b77ac42'::uuid then
    raise exception 'Ingen behörighet' using errcode = '42501';
  end if;
  return json_build_object(
    'dagar', (select coalesce(json_agg(x order by x.dag), '[]'::json) from (
      select g.dag::date as dag, coalesce(v.visningar, 0) as visningar, coalesce(u.antal, 0) as besokare
      from generate_series(fran, (now() at time zone 'Europe/Stockholm')::date, interval '1 day') g(dag)
      left join (select dag, sum(visningar)::int as visningar from privat.besok_dag where dag >= fran group by dag) v on v.dag = g.dag::date
      left join privat.besok_unik_dag u on u.dag = g.dag::date) x),
    'sidor', (select coalesce(json_agg(x), '[]'::json) from (select sida, sum(visningar)::int as visningar from privat.besok_dag where dag >= fran group by sida order by 2 desc limit 15) x),
    'kallor', (select coalesce(json_agg(x), '[]'::json) from (select kalla, sum(visningar)::int as visningar from privat.besok_dag where dag >= fran and kalla <> 'intern' group by kalla order by 2 desc limit 10) x),
    'enheter', (select coalesce(json_agg(x), '[]'::json) from (select enhet, sum(visningar)::int as visningar from privat.besok_dag where dag >= fran group by enhet order by 2 desc) x)
  );
end $$;

revoke all on function public.rakna_besok(text, text, text) from public;
revoke all on function public.besok_statistik(integer) from public;
grant execute on function public.rakna_besok(text, text, text) to anon, authenticated;
grant execute on function public.besok_statistik(integer) to authenticated;
