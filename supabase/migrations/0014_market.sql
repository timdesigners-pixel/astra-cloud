-- Market: ürünler (stokla birlikte), fişler, fiş kalemleri ve alışveriş listesi.
create table public.urunler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 160),
  birim text not null default 'adet' check (length(birim) between 1 and 20),
  kategori text check (length(kategori) <= 60),
  stok_miktari numeric(12, 3) not null default 0 check (stok_miktari >= 0),
  asgari_stok numeric(12, 3) not null default 0 check (asgari_stok >= 0),
  son_kullanma date
);
create unique index urunler_ad on public.urunler (sahip_id, lower(ad)) where silindi_at is null;
create index urunler_sahip on public.urunler (sahip_id) where silindi_at is null;
create trigger urunler_hazirla before insert or update on public.urunler for each row execute function public.kayit_hazirla();
alter table public.urunler enable row level security;
create policy urunler_oku on public.urunler for select to authenticated using (sahip_id = (select auth.uid()));
create policy urunler_ekle on public.urunler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy urunler_guncelle on public.urunler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.urunler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, birim, kategori, stok_miktari, asgari_stok, son_kullanma) on public.urunler to authenticated;
grant insert (ad, birim, kategori, stok_miktari, asgari_stok, son_kullanma, cihaz, ekstra) on public.urunler to authenticated;
grant update (ad, birim, kategori, stok_miktari, asgari_stok, son_kullanma, silindi_at, cihaz, ekstra) on public.urunler to authenticated;

create table public.fisler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  market text not null check (length(btrim(market)) between 1 and 120),
  tarih date not null,
  toplam numeric(18, 2) not null default 0 check (toplam >= 0),
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  hareket_id uuid references public.hareketler(id) on delete restrict,
  notlar text check (length(notlar) <= 1000)
);
create index fisler_sahip on public.fisler (sahip_id, tarih) where silindi_at is null;
create trigger fisler_hazirla before update on public.fisler for each row execute function public.kayit_hazirla();
alter table public.fisler enable row level security;
create policy fisler_oku on public.fisler for select to authenticated using (sahip_id = (select auth.uid()));
revoke all on public.fisler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, market, tarih, toplam, hesap_id, hareket_id, notlar) on public.fisler to authenticated;

create table public.fis_kalemleri (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  fis_id uuid not null references public.fisler(id) on delete restrict,
  urun_id uuid not null references public.urunler(id) on delete restrict,
  miktar numeric(12, 3) not null check (miktar > 0),
  birim_fiyat numeric(18, 2) not null check (birim_fiyat >= 0),
  tutar numeric(18, 2) not null check (tutar >= 0)
);
create index fis_kalemleri_fis on public.fis_kalemleri (fis_id) where silindi_at is null;
create index fis_kalemleri_urun on public.fis_kalemleri (urun_id) where silindi_at is null;
create trigger fis_kalemleri_hazirla before update on public.fis_kalemleri for each row execute function public.kayit_hazirla();
alter table public.fis_kalemleri enable row level security;
create policy fis_kalemleri_oku on public.fis_kalemleri for select to authenticated using (sahip_id = (select auth.uid()));
revoke all on public.fis_kalemleri from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, fis_id, urun_id, miktar, birim_fiyat, tutar) on public.fis_kalemleri to authenticated;

create table public.alisveris_ogeleri (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 160),
  miktar numeric(12, 3) not null default 1 check (miktar > 0),
  birim text check (length(birim) <= 20),
  urun_id uuid references public.urunler(id) on delete restrict,
  alindi boolean not null default false
);
create index alisveris_ogeleri_sahip on public.alisveris_ogeleri (sahip_id) where silindi_at is null;
create trigger alisveris_ogeleri_hazirla before insert or update on public.alisveris_ogeleri for each row execute function public.kayit_hazirla();
alter table public.alisveris_ogeleri enable row level security;
create policy alisveris_ogeleri_oku on public.alisveris_ogeleri for select to authenticated using (sahip_id = (select auth.uid()));
create policy alisveris_ogeleri_ekle on public.alisveris_ogeleri for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy alisveris_ogeleri_guncelle on public.alisveris_ogeleri for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.alisveris_ogeleri from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, miktar, birim, urun_id, alindi) on public.alisveris_ogeleri to authenticated;
grant insert (ad, miktar, birim, urun_id, alindi, cihaz, ekstra) on public.alisveris_ogeleri to authenticated;
grant update (ad, miktar, birim, urun_id, alindi, silindi_at, cihaz, ekstra) on public.alisveris_ogeleri to authenticated;

-- Fiş girişi tek işlemde: fiş ve kalemleri yazılır, ürün stokları artar, hesap seçildiyse market hareketi oluşur.
create or replace function public.fis_kaydet(p_market text, p_tarih date, p_hesap_id uuid, p_notlar text, p_kalemler jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  v_fis uuid; v_hareket uuid; v_toplam numeric(18, 2) := 0;
  k jsonb; v_urun uuid; v_ad text; v_miktar numeric; v_fiyat numeric; v_tutar numeric(18, 2); v_birim text;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if btrim(coalesce(p_market, '')) = '' or p_tarih is null then raise exception 'market ve tarih gerekli' using errcode = '22023'; end if;
  if jsonb_typeof(p_kalemler) <> 'array' or jsonb_array_length(p_kalemler) not between 1 and 200 then raise exception 'fişte en az bir kalem olmalı' using errcode = '22023'; end if;
  if p_hesap_id is not null and not exists (select 1 from public.hesaplar h where h.id = p_hesap_id and h.sahip_id = v_sahip and h.silindi_at is null) then
    raise exception 'hesap bulunamadı' using errcode = '23503';
  end if;
  insert into public.fisler (sahip_id, market, tarih, hesap_id, notlar)
  values (v_sahip, btrim(p_market), p_tarih, p_hesap_id, nullif(btrim(coalesce(p_notlar, '')), '')) returning id into v_fis;

  for k in select * from jsonb_array_elements(p_kalemler) loop
    v_ad := btrim(coalesce(k ->> 'ad', ''));
    v_miktar := (k ->> 'miktar')::numeric; v_fiyat := (k ->> 'birim_fiyat')::numeric;
    v_birim := coalesce(nullif(btrim(coalesce(k ->> 'birim', '')), ''), 'adet');
    if v_ad = '' or v_miktar is null or v_miktar <= 0 or v_fiyat is null or v_fiyat < 0 then raise exception 'kalem geçersiz' using errcode = '22023'; end if;
    v_urun := nullif(k ->> 'urun_id', '')::uuid;
    if v_urun is not null then
      if not exists (select 1 from public.urunler u where u.id = v_urun and u.sahip_id = v_sahip and u.silindi_at is null) then raise exception 'ürün bulunamadı' using errcode = '23503'; end if;
    else
      select u.id into v_urun from public.urunler u where u.sahip_id = v_sahip and u.silindi_at is null and lower(u.ad) = lower(v_ad) limit 1;
      if v_urun is null then
        insert into public.urunler (sahip_id, ad, birim) values (v_sahip, v_ad, v_birim) returning id into v_urun;
      end if;
    end if;
    v_tutar := round(v_miktar * v_fiyat, 2);
    insert into public.fis_kalemleri (sahip_id, fis_id, urun_id, miktar, birim_fiyat, tutar) values (v_sahip, v_fis, v_urun, v_miktar, v_fiyat, v_tutar);
    update public.urunler set stok_miktari = stok_miktari + v_miktar where id = v_urun;
    v_toplam := v_toplam + v_tutar;
  end loop;

  update public.fisler set toplam = v_toplam where id = v_fis;
  if p_hesap_id is not null and v_toplam > 0 then
    insert into public.hareketler (sahip_id, hesap_id, yon, tur, tutar, tarih, kategori, aciklama)
    values (v_sahip, p_hesap_id, 'cikis', 'market', v_toplam, p_tarih, 'Market', btrim(p_market)) returning id into v_hareket;
    update public.fisler set hareket_id = v_hareket where id = v_fis;
  end if;
  return v_fis;
end $$;

-- Fişi siler: stoklar geri düşer, market hareketi de gizlenir.
create or replace function public.fis_sil(p_fis_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sahip uuid := auth.uid(); f public.fisler%rowtype; k record;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  select * into f from public.fisler where id = p_fis_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found then raise exception 'fiş bulunamadı' using errcode = '22023'; end if;
  for k in select urun_id, miktar from public.fis_kalemleri where fis_id = f.id and silindi_at is null loop
    update public.urunler set stok_miktari = greatest(0, stok_miktari - k.miktar) where id = k.urun_id;
  end loop;
  update public.fis_kalemleri set silindi_at = now() where fis_id = f.id and silindi_at is null;
  update public.fisler set silindi_at = now() where id = f.id;
  if f.hareket_id is not null then update public.hareketler set silindi_at = now() where id = f.hareket_id and sahip_id = v_sahip; end if;
end $$;

revoke all on function public.fis_kaydet(text, date, uuid, text, jsonb), public.fis_sil(uuid) from public, anon;
grant execute on function public.fis_kaydet(text, date, uuid, text, jsonb), public.fis_sil(uuid) to authenticated;
