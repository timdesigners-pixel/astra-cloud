-- Sağlık: günlük ölçümler (elle, akıllı saat/telefon, dosya), cihaz senkron anahtarları ve tahlil takibi.

-- Günlük ölçüm: gün + tür + kaynak başına tek satır; senkron aynı günü tekrar gönderirse üzerine yazılır.
create table public.saglik_olcumleri (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  cihaz text,
  gun date not null,
  tur text not null check (tur in ('adim', 'mesafe_m', 'kalori_aktif', 'egzersiz_dk', 'nabiz', 'dinlenme_nabzi', 'hrv', 'uyku_dk', 'su_ml',
    'kilo', 'yag_orani', 'spo2', 'tansiyon_sis', 'tansiyon_dia', 'glukoz', 'ates')),
  kaynak text not null check (kaynak in ('elle', 'saat', 'telefon', 'dosya')),
  deger numeric(12, 2) not null check (deger >= 0),
  en_az numeric(12, 2) check (en_az >= 0),
  en_cok numeric(12, 2) check (en_cok >= 0),
  ornek int check (ornek >= 0),
  unique (sahip_id, gun, tur, kaynak)
);
create index saglik_olcumleri_sahip on public.saglik_olcumleri (sahip_id, tur, gun desc);
create trigger saglik_olcumleri_hazirla before insert or update on public.saglik_olcumleri for each row execute function public.kayit_hazirla();
alter table public.saglik_olcumleri enable row level security;
create policy saglik_olcumleri_oku on public.saglik_olcumleri for select to authenticated using (sahip_id = (select auth.uid()));
create policy saglik_olcumleri_ekle on public.saglik_olcumleri for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy saglik_olcumleri_guncelle on public.saglik_olcumleri for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
create policy saglik_olcumleri_sil on public.saglik_olcumleri for delete to authenticated using (sahip_id = (select auth.uid()));
revoke all on public.saglik_olcumleri from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, gun, tur, kaynak, deger, en_az, en_cok, ornek) on public.saglik_olcumleri to authenticated;
grant insert (gun, tur, kaynak, deger, en_az, en_cok, ornek, cihaz) on public.saglik_olcumleri to authenticated;
grant update (deger, en_az, en_cok, ornek, cihaz) on public.saglik_olcumleri to authenticated;
grant delete on public.saglik_olcumleri to authenticated;

-- Senkron anahtarı: telefon / saat uygulaması bu anahtarla veri gönderir. Anahtarın kendisi saklanmaz, yalnız özeti (SHA-256).
create table public.saglik_anahtarlari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  ad text not null check (length(btrim(ad)) between 1 and 80),
  belirtec_ozeti text not null unique check (belirtec_ozeti ~ '^[0-9a-f]{64}$'),
  son_kullanim timestamptz,
  son_sonuc text check (length(son_sonuc) <= 300),
  kullanim_sayisi int not null default 0,
  iptal_at timestamptz
);
create trigger saglik_anahtarlari_hazirla before insert or update on public.saglik_anahtarlari for each row execute function public.kayit_hazirla();
alter table public.saglik_anahtarlari enable row level security;
create policy saglik_anahtarlari_oku on public.saglik_anahtarlari for select to authenticated using (sahip_id = (select auth.uid()));
create policy saglik_anahtarlari_ekle on public.saglik_anahtarlari for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy saglik_anahtarlari_guncelle on public.saglik_anahtarlari for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.saglik_anahtarlari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, ad, son_kullanim, son_sonuc, kullanim_sayisi, iptal_at) on public.saglik_anahtarlari to authenticated;
grant insert (ad, belirtec_ozeti) on public.saglik_anahtarlari to authenticated;
grant update (iptal_at) on public.saglik_anahtarlari to authenticated;

-- Tahlil raporu (yüklenen dosya + tarih) ve içindeki değerler.
create table public.tahlil_raporlari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  tarih date not null,
  ad text not null check (length(btrim(ad)) between 1 and 200),
  kurum text check (length(kurum) <= 200),
  notlar text check (length(notlar) <= 4000),
  dosya_yol text unique check (length(dosya_yol) <= 400 and dosya_yol like sahip_id::text || '/%'),
  dosya_ad text check (length(dosya_ad) <= 200),
  mime text check (length(mime) <= 120),
  boyut bigint check (boyut >= 0)
);
create index tahlil_raporlari_sahip on public.tahlil_raporlari (sahip_id, tarih desc) where silindi_at is null;
create trigger tahlil_raporlari_hazirla before insert or update on public.tahlil_raporlari for each row execute function public.kayit_hazirla();
alter table public.tahlil_raporlari enable row level security;
create policy tahlil_raporlari_oku on public.tahlil_raporlari for select to authenticated using (sahip_id = (select auth.uid()));
create policy tahlil_raporlari_ekle on public.tahlil_raporlari for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy tahlil_raporlari_guncelle on public.tahlil_raporlari for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
create policy tahlil_raporlari_sil on public.tahlil_raporlari for delete to authenticated
  using (sahip_id = (select auth.uid()) and silindi_at is not null);
revoke all on public.tahlil_raporlari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, tarih, ad, kurum, notlar, dosya_yol, dosya_ad, mime, boyut) on public.tahlil_raporlari to authenticated;
grant insert (tarih, ad, kurum, notlar, dosya_yol, dosya_ad, mime, boyut, cihaz, ekstra) on public.tahlil_raporlari to authenticated;
grant update (tarih, ad, kurum, notlar, silindi_at, cihaz, ekstra) on public.tahlil_raporlari to authenticated;
grant delete on public.tahlil_raporlari to authenticated;

create table public.tahlil_degerleri (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  rapor_id uuid not null references public.tahlil_raporlari(id) on delete cascade,
  tarih date not null,
  test text not null check (length(btrim(test)) between 1 and 80),
  ad text not null check (length(btrim(ad)) between 1 and 120),
  deger numeric(14, 4),
  metin text check (length(metin) <= 120),
  birim text check (length(birim) <= 30),
  ref_alt numeric(14, 4),
  ref_ust numeric(14, 4),
  check (deger is not null or metin is not null)
);
create index tahlil_degerleri_sahip on public.tahlil_degerleri (sahip_id, test, tarih desc) where silindi_at is null;
create index tahlil_degerleri_rapor on public.tahlil_degerleri (rapor_id) where silindi_at is null;
create trigger tahlil_degerleri_hazirla before insert or update on public.tahlil_degerleri for each row execute function public.kayit_hazirla();
alter table public.tahlil_degerleri enable row level security;
create policy tahlil_degerleri_oku on public.tahlil_degerleri for select to authenticated using (sahip_id = (select auth.uid()));
create policy tahlil_degerleri_ekle on public.tahlil_degerleri for insert to authenticated with check (
  sahip_id = (select auth.uid()) and exists (select 1 from public.tahlil_raporlari r where r.id = rapor_id and r.sahip_id = (select auth.uid())));
create policy tahlil_degerleri_guncelle on public.tahlil_degerleri for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
create policy tahlil_degerleri_sil on public.tahlil_degerleri for delete to authenticated
  using (sahip_id = (select auth.uid()) and silindi_at is not null);
revoke all on public.tahlil_degerleri from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, rapor_id, tarih, test, ad, deger, metin, birim, ref_alt, ref_ust) on public.tahlil_degerleri to authenticated;
grant insert (rapor_id, tarih, test, ad, deger, metin, birim, ref_alt, ref_ust, cihaz, ekstra) on public.tahlil_degerleri to authenticated;
grant update (tarih, test, ad, deger, metin, birim, ref_alt, ref_ust, silindi_at, cihaz, ekstra) on public.tahlil_degerleri to authenticated;
grant delete on public.tahlil_degerleri to authenticated;

-- Tahlil dosyaları özel kovada; herkes yalnız kendi klasöründekilere erişir.
insert into storage.buckets (id, name, public, file_size_limit)
values ('saglik', 'saglik', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;
create policy saglik_dosya_oku on storage.objects for select to authenticated
  using (bucket_id = 'saglik' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy saglik_dosya_ekle on storage.objects for insert to authenticated
  with check (bucket_id = 'saglik' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy saglik_dosya_sil on storage.objects for delete to authenticated
  using (bucket_id = 'saglik' and (storage.foldername(name))[1] = (select auth.uid())::text);
