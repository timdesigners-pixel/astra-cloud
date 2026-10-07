-- Ortak: her UPDATE'te sürüm +1 ve güncelleme damgası; sahip ve oluşturma zamanı değişmez.
create or replace function public.kayit_hazirla() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.surum := old.surum + 1;
    new.sahip_id := old.sahip_id;
    new.olusturma := old.olusturma;
  end if;
  new.guncelleme := now();
  return new;
end $$;

-- Şifreleme anahtarı yalnız sunucu işlevlerinin okuyabildiği "private" şemada.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.alan_anahtari() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'astra_alan_anahtari'
$$;
revoke all on function private.alan_anahtari() from public, anon, authenticated;

-- TR IBAN doğrulama (26 hane, mod 97)
create or replace function public.iban_gecerli_mi(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  s text := upper(regexp_replace(coalesce(p, ''), '\s', '', 'g'));
  r text;
  k bigint := 0;
  i int := 1;
begin
  if s !~ '^TR[0-9]{24}$' then return false; end if;
  r := substr(s, 5) || '2927' || substr(s, 3, 2);
  while i <= length(r) loop
    k := ((k::text) || substr(r, i, 7))::bigint % 97;
    i := i + 7;
  end loop;
  return k = 1;
end $$;

-- Kişiler & Kurumlar
create table public.kisiler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  tur text not null default 'kisi' check (tur in ('kisi', 'kurum', 'firma')),
  alt_tur text check (alt_tur in ('banka', 'vergi_dairesi', 'sgk', 'icra_dairesi', 'avukat', 'mahkeme', 'diger')),
  takma_adlar text[] not null default '{}',
  telefon text check (length(telefon) <= 40),
  notlar text check (length(notlar) <= 4000)
);
create index kisiler_sahip on public.kisiler (sahip_id) where silindi_at is null;
create trigger kisiler_hazirla before insert or update on public.kisiler
  for each row execute function public.kayit_hazirla();

alter table public.kisiler enable row level security;
create policy kisiler_oku on public.kisiler for select to authenticated using (sahip_id = (select auth.uid()));
create policy kisiler_ekle on public.kisiler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy kisiler_guncelle on public.kisiler for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));

revoke all on public.kisiler from anon, authenticated;
grant select on public.kisiler to authenticated;
grant insert (ad, tur, alt_tur, takma_adlar, telefon, notlar, cihaz, ekstra) on public.kisiler to authenticated;
grant update (ad, tur, alt_tur, takma_adlar, telefon, notlar, silindi_at, cihaz, ekstra) on public.kisiler to authenticated;

-- IBAN Rehberi: IBAN şifreli saklanır; istemci şifreli sütunları okuyamaz.
create table public.ibanlar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  sahip_turu text not null default 'kisi' check (sahip_turu in ('kendim', 'kisi')),
  kisi_id uuid references public.kisiler(id) on delete restrict,
  hesap_id uuid,
  etiket text check (length(etiket) <= 120),
  banka text check (length(banka) <= 120),
  iban_sifreli bytea not null,
  iban_hash text not null,
  iban_son4 text not null,
  check ((sahip_turu = 'kendim' and kisi_id is null) or (sahip_turu = 'kisi' and kisi_id is not null))
);
create unique index ibanlar_tekil on public.ibanlar (sahip_id, iban_hash) where silindi_at is null;
create index ibanlar_kisi on public.ibanlar (kisi_id) where silindi_at is null;
create trigger ibanlar_hazirla before update on public.ibanlar
  for each row execute function public.kayit_hazirla();

alter table public.ibanlar enable row level security;
create policy ibanlar_oku on public.ibanlar for select to authenticated using (sahip_id = (select auth.uid()));
create policy ibanlar_guncelle on public.ibanlar for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));

revoke all on public.ibanlar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, sahip_turu, kisi_id, hesap_id, etiket, banka, iban_son4)
  on public.ibanlar to authenticated;
grant update (etiket, banka, silindi_at, cihaz) on public.ibanlar to authenticated;

create or replace function public.iban_ekle(p_sahip_turu text, p_kisi_id uuid, p_etiket text, p_banka text, p_iban text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_iban text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  v_sahip uuid := auth.uid();
  v_anahtar text := private.alan_anahtari();
  v_id uuid;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if not public.iban_gecerli_mi(v_iban) then raise exception 'IBAN geçersiz' using errcode = '22023'; end if;
  if p_kisi_id is not null and not exists (
    select 1 from public.kisiler k where k.id = p_kisi_id and k.sahip_id = v_sahip and k.silindi_at is null
  ) then raise exception 'kişi bulunamadı' using errcode = '23503'; end if;
  insert into public.ibanlar (sahip_id, sahip_turu, kisi_id, etiket, banka, iban_sifreli, iban_hash, iban_son4)
  values (v_sahip, p_sahip_turu, p_kisi_id, nullif(btrim(p_etiket), ''), nullif(btrim(p_banka), ''),
          extensions.pgp_sym_encrypt(v_iban, v_anahtar),
          encode(extensions.hmac(v_iban, v_anahtar, 'sha256'), 'hex'),
          right(v_iban, 4))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.iban_listele()
returns table (id uuid, sahip_turu text, kisi_id uuid, etiket text, banka text, iban text, surum int)
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  return query
    select i.id, i.sahip_turu, i.kisi_id, i.etiket, i.banka,
           extensions.pgp_sym_decrypt(i.iban_sifreli, v_anahtar), i.surum
    from public.ibanlar i
    where i.sahip_id = auth.uid() and i.silindi_at is null
    order by i.olusturma;
end $$;

revoke all on function public.iban_ekle(text, uuid, text, text, text) from public, anon;
revoke all on function public.iban_listele() from public, anon;
grant execute on function public.iban_ekle(text, uuid, text, text, text) to authenticated;
grant execute on function public.iban_listele() to authenticated;
