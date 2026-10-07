-- Hayaller ve Hedefler: hedefler, istekler, beğenilen ürünler; Giderler > Alınacaklar.

create table public.hedefler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  grup text not null default 'diger' check (grup in ('bakim','alisveris','diger')),
  hedef_tutar numeric(18,2) not null default 0 check (hedef_tutar>=0),
  biriken numeric(18,2) not null default 0 check (biriken>=0),
  hedef_tarihi date,
  durum text not null default 'aktif' check (durum in ('aktif','tamamlandi')),
  notlar text check (length(notlar)<=2000)
);
create index hedefler_sahip on public.hedefler (sahip_id) where silindi_at is null;
create trigger hedefler_hazirla before insert or update on public.hedefler for each row execute function public.kayit_hazirla();
alter table public.hedefler enable row level security;
create policy hedefler_oku on public.hedefler for select to authenticated using (sahip_id = (select auth.uid()));
create policy hedefler_ekle on public.hedefler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy hedefler_guncelle on public.hedefler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.hedefler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, grup, hedef_tutar, biriken, hedef_tarihi, durum, notlar) on public.hedefler to authenticated;
grant insert (ad, grup, hedef_tutar, biriken, hedef_tarihi, durum, notlar, cihaz, ekstra) on public.hedefler to authenticated;
grant update (ad, grup, hedef_tutar, biriken, hedef_tarihi, durum, notlar, silindi_at, cihaz, ekstra) on public.hedefler to authenticated;

create table public.istekler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 160),
  hedef_id uuid references public.hedefler(id) on delete restrict,
  tahmini_tutar numeric(18,2) check (tahmini_tutar>=0),
  oncelik text not null default 'orta' check (oncelik in ('yuksek','orta','dusuk')),
  baglanti text check (length(baglanti)<=500),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','vazgecildi')),
  notlar text check (length(notlar)<=2000)
);
create index istekler_sahip on public.istekler (sahip_id) where silindi_at is null;
create trigger istekler_hazirla before insert or update on public.istekler for each row execute function public.kayit_hazirla();
alter table public.istekler enable row level security;
create policy istekler_oku on public.istekler for select to authenticated using (sahip_id = (select auth.uid()));
create policy istekler_ekle on public.istekler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy istekler_guncelle on public.istekler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.istekler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, hedef_id, tahmini_tutar, oncelik, baglanti, durum, notlar) on public.istekler to authenticated;
grant insert (ad, hedef_id, tahmini_tutar, oncelik, baglanti, durum, notlar, cihaz, ekstra) on public.istekler to authenticated;
grant update (ad, hedef_id, tahmini_tutar, oncelik, baglanti, durum, notlar, silindi_at, cihaz, ekstra) on public.istekler to authenticated;

create table public.begeniler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 160),
  baglanti text check (length(baglanti)<=500),
  fiyat numeric(18,2) check (fiyat>=0),
  ilk_fiyat numeric(18,2) check (ilk_fiyat>=0),
  notlar text check (length(notlar)<=2000)
);
create index begeniler_sahip on public.begeniler (sahip_id) where silindi_at is null;
create trigger begeniler_hazirla before insert or update on public.begeniler for each row execute function public.kayit_hazirla();
alter table public.begeniler enable row level security;
create policy begeniler_oku on public.begeniler for select to authenticated using (sahip_id = (select auth.uid()));
create policy begeniler_ekle on public.begeniler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy begeniler_guncelle on public.begeniler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.begeniler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, baglanti, fiyat, ilk_fiyat, notlar) on public.begeniler to authenticated;
grant insert (ad, baglanti, fiyat, ilk_fiyat, notlar, cihaz, ekstra) on public.begeniler to authenticated;
grant update (ad, baglanti, fiyat, ilk_fiyat, notlar, silindi_at, cihaz, ekstra) on public.begeniler to authenticated;

create table public.alinacaklar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 160),
  hedef_id uuid references public.hedefler(id) on delete restrict,
  tahmini_tutar numeric(18,2) check (tahmini_tutar>=0),
  hedef_tarih date,
  durum text not null default 'karar' check (durum in ('karar','alindi')),
  alindi_tarihi date,
  hareket_id uuid references public.hareketler(id) on delete restrict,
  notlar text check (length(notlar)<=2000)
);
create index alinacaklar_sahip on public.alinacaklar (sahip_id) where silindi_at is null;
create trigger alinacaklar_hazirla before insert or update on public.alinacaklar for each row execute function public.kayit_hazirla();
alter table public.alinacaklar enable row level security;
create policy alinacaklar_oku on public.alinacaklar for select to authenticated using (sahip_id = (select auth.uid()));
create policy alinacaklar_ekle on public.alinacaklar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy alinacaklar_guncelle on public.alinacaklar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.alinacaklar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, hedef_id, tahmini_tutar, hedef_tarih, durum, alindi_tarihi, hareket_id, notlar) on public.alinacaklar to authenticated;
grant insert (ad, hedef_id, tahmini_tutar, hedef_tarih, notlar, cihaz, ekstra) on public.alinacaklar to authenticated;
grant update (ad, hedef_id, tahmini_tutar, hedef_tarih, notlar, silindi_at, cihaz, ekstra) on public.alinacaklar to authenticated;

-- Alındı işaretleme tek işlemde: gider hareketi yazılır, alınacak kapanır.
create or replace function public.alinacak_alindi(p_id uuid, p_hesap_id uuid, p_tutar numeric, p_tarih date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  a public.alinacaklar%rowtype;
  v_hareket uuid;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if p_tutar is null or p_tutar <= 0 then raise exception 'tutar sıfırdan büyük olmalı' using errcode = '22023'; end if;
  select * into a from public.alinacaklar where id = p_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found or a.durum <> 'karar' then raise exception 'kayıt bulunamadı ya da zaten alınmış' using errcode = '22023'; end if;
  if not exists (select 1 from public.hesaplar h where h.id = p_hesap_id and h.sahip_id = v_sahip and h.silindi_at is null) then
    raise exception 'hesap bulunamadı' using errcode = '23503';
  end if;
  insert into public.hareketler (sahip_id, hesap_id, yon, tur, tutar, tarih, kategori, aciklama)
  values (v_sahip, p_hesap_id, 'cikis', 'gider', p_tutar, p_tarih, 'Alınacak', a.ad)
  returning id into v_hareket;
  update public.alinacaklar set durum = 'alindi', alindi_tarihi = p_tarih, hareket_id = v_hareket, tahmini_tutar = p_tutar where id = a.id;
end $$;

create or replace function public.alinacak_geri_al(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  a public.alinacaklar%rowtype;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  select * into a from public.alinacaklar where id = p_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found or a.durum <> 'alindi' then raise exception 'geri alınacak kayıt bulunamadı' using errcode = '22023'; end if;
  update public.alinacaklar set durum = 'karar', alindi_tarihi = null, hareket_id = null where id = a.id;
  update public.hareketler set silindi_at = now() where id = a.hareket_id and sahip_id = v_sahip;
end $$;

revoke all on function public.alinacak_alindi(uuid, uuid, numeric, date), public.alinacak_geri_al(uuid) from public, anon;
grant execute on function public.alinacak_alindi(uuid, uuid, numeric, date), public.alinacak_geri_al(uuid) to authenticated;
