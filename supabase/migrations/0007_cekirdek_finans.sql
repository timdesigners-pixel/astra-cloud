-- Çekirdek finans tabloları: hesap, borç, ödeme, gelir, gider, vade, hareket, varlık, limit.

create table public.hesaplar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  banka_id uuid references public.kisiler(id) on delete restrict,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  tur text not null check (tur in ('vadesiz','kredi_karti','kredi','kmh','diger')),
  para_birimi text not null default 'TRY' check (length(para_birimi)=3),
  acilis_bakiyesi numeric(18,2) not null default 0,
  hesap_kesim_gunu smallint check (hesap_kesim_gunu between 1 and 31),
  son_odeme_gunu smallint check (son_odeme_gunu between 1 and 31),
  aktif boolean not null default true,
  notlar text check (length(notlar)<=2000)
);
create index hesaplar_sahip on public.hesaplar (sahip_id) where silindi_at is null;
create trigger hesaplar_hazirla before insert or update on public.hesaplar for each row execute function public.kayit_hazirla();
alter table public.hesaplar enable row level security;
create policy hesaplar_oku on public.hesaplar for select to authenticated using (sahip_id = (select auth.uid()));
create policy hesaplar_ekle on public.hesaplar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy hesaplar_guncelle on public.hesaplar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.hesaplar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, banka_id, ad, tur, para_birimi, acilis_bakiyesi, hesap_kesim_gunu, son_odeme_gunu, aktif, notlar) on public.hesaplar to authenticated;
grant insert (banka_id, ad, tur, para_birimi, acilis_bakiyesi, hesap_kesim_gunu, son_odeme_gunu, aktif, notlar, cihaz, ekstra) on public.hesaplar to authenticated;
grant update (banka_id, ad, tur, para_birimi, acilis_bakiyesi, hesap_kesim_gunu, son_odeme_gunu, aktif, notlar, silindi_at, cihaz, ekstra) on public.hesaplar to authenticated;

create table public.borclar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  tur text not null check (tur in ('kisi','banka','icra','vergi','sgk')),
  alt_tur text check (alt_tur in ('kredi','kredi_karti','kmh','kdv','gelir_vergisi','damga','mtv','diger','prim','yapilandirma')),
  ad text not null check (length(btrim(ad)) between 1 and 160),
  yon text not null default 'borclu' check (yon in ('borclu','alacakli')),
  alacakli_id uuid references public.kisiler(id) on delete restrict,
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  anapara numeric(18,2) not null default 0 check (anapara>=0),
  guncel_borc numeric(18,2) not null default 0,
  faiz_orani numeric(9,4),
  baslangic_tarihi date,
  bitis_tarihi date,
  durum text not null default 'acik' check (durum in ('acik','yapilandirma','kapandi')),
  notlar text check (length(notlar)<=4000)
);
create index borclar_sahip on public.borclar (sahip_id) where silindi_at is null;
create trigger borclar_hazirla before insert or update on public.borclar for each row execute function public.kayit_hazirla();
alter table public.borclar enable row level security;
create policy borclar_oku on public.borclar for select to authenticated using (sahip_id = (select auth.uid()));
create policy borclar_ekle on public.borclar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy borclar_guncelle on public.borclar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.borclar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, tur, alt_tur, ad, yon, alacakli_id, hesap_id, anapara, guncel_borc, faiz_orani, baslangic_tarihi, bitis_tarihi, durum, notlar) on public.borclar to authenticated;
grant insert (tur, alt_tur, ad, yon, alacakli_id, hesap_id, anapara, guncel_borc, faiz_orani, baslangic_tarihi, bitis_tarihi, durum, notlar, cihaz, ekstra) on public.borclar to authenticated;
grant update (tur, alt_tur, ad, yon, alacakli_id, hesap_id, anapara, guncel_borc, faiz_orani, baslangic_tarihi, bitis_tarihi, durum, notlar, silindi_at, cihaz, ekstra) on public.borclar to authenticated;

create table public.odemeler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  borc_id uuid not null references public.borclar(id) on delete restrict,
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  vade_tarihi date not null,
  tutar numeric(18,2) not null check (tutar>0),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','odendi','iptal')),
  odeme_tarihi date,
  hareket_id uuid,
  notlar text check (length(notlar)<=1000)
);
create index odemeler_sahip on public.odemeler (sahip_id) where silindi_at is null;
create trigger odemeler_hazirla before insert or update on public.odemeler for each row execute function public.kayit_hazirla();
alter table public.odemeler enable row level security;
create policy odemeler_oku on public.odemeler for select to authenticated using (sahip_id = (select auth.uid()));
create policy odemeler_ekle on public.odemeler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy odemeler_guncelle on public.odemeler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.odemeler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, borc_id, hesap_id, vade_tarihi, tutar, durum, odeme_tarihi, hareket_id, notlar) on public.odemeler to authenticated;
grant insert (borc_id, hesap_id, vade_tarihi, tutar, durum, odeme_tarihi, hareket_id, notlar, cihaz, ekstra) on public.odemeler to authenticated;
grant update (borc_id, hesap_id, vade_tarihi, tutar, durum, odeme_tarihi, hareket_id, notlar, silindi_at, cihaz, ekstra) on public.odemeler to authenticated;

create table public.gelirler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  tur text not null check (tur in ('maas','kira','faiz','tarla','ek_is','bahis','alinan_borc','diger')),
  sabit boolean not null default true,
  periyot text not null default 'aylik' check (periyot in ('aylik','uc_aylik','yillik','tek_sefer')),
  tutar numeric(18,2) not null check (tutar>=0),
  gun smallint check (gun between 1 and 31),
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  borc_id uuid references public.borclar(id) on delete restrict,
  baslangic date,
  bitis date,
  aktif boolean not null default true,
  gelir_sayilir boolean not null default true,
  notlar text check (length(notlar)<=2000)
);
create index gelirler_sahip on public.gelirler (sahip_id) where silindi_at is null;
create trigger gelirler_hazirla before insert or update on public.gelirler for each row execute function public.kayit_hazirla();
alter table public.gelirler enable row level security;
create policy gelirler_oku on public.gelirler for select to authenticated using (sahip_id = (select auth.uid()));
create policy gelirler_ekle on public.gelirler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy gelirler_guncelle on public.gelirler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.gelirler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, tur, sabit, periyot, tutar, gun, hesap_id, borc_id, baslangic, bitis, aktif, gelir_sayilir, notlar) on public.gelirler to authenticated;
grant insert (ad, tur, sabit, periyot, tutar, gun, hesap_id, borc_id, baslangic, bitis, aktif, gelir_sayilir, notlar, cihaz, ekstra) on public.gelirler to authenticated;
grant update (ad, tur, sabit, periyot, tutar, gun, hesap_id, borc_id, baslangic, bitis, aktif, gelir_sayilir, notlar, silindi_at, cihaz, ekstra) on public.gelirler to authenticated;

create table public.giderler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  tur text not null check (tur in ('fatura','abonelik','sabit','tek_sefer')),
  periyot text not null default 'aylik' check (periyot in ('aylik','uc_aylik','yillik','tek_sefer')),
  tutar numeric(18,2) not null check (tutar>=0),
  para_birimi text not null default 'TRY' check (length(para_birimi)=3),
  gun smallint check (gun between 1 and 31),
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  taksit_toplam int check (taksit_toplam>0),
  taksit_kalan int check (taksit_kalan>=0),
  bitis date,
  abone_no_sifreli bytea,
  aktif boolean not null default true,
  notlar text check (length(notlar)<=2000)
);
create index giderler_sahip on public.giderler (sahip_id) where silindi_at is null;
create trigger giderler_hazirla before insert or update on public.giderler for each row execute function public.kayit_hazirla();
alter table public.giderler enable row level security;
create policy giderler_oku on public.giderler for select to authenticated using (sahip_id = (select auth.uid()));
create policy giderler_ekle on public.giderler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy giderler_guncelle on public.giderler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.giderler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, tur, periyot, tutar, para_birimi, gun, hesap_id, taksit_toplam, taksit_kalan, bitis, aktif, notlar) on public.giderler to authenticated;
grant insert (ad, tur, periyot, tutar, para_birimi, gun, hesap_id, taksit_toplam, taksit_kalan, bitis, aktif, notlar, cihaz, ekstra) on public.giderler to authenticated;
grant update (ad, tur, periyot, tutar, para_birimi, gun, hesap_id, taksit_toplam, taksit_kalan, bitis, aktif, notlar, silindi_at, cihaz, ekstra) on public.giderler to authenticated;

create table public.vadeler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  yon text not null check (yon in ('giris','cikis')),
  gelir_id uuid references public.gelirler(id) on delete restrict,
  gider_id uuid references public.giderler(id) on delete restrict,
  tarih date not null,
  tutar numeric(18,2) not null check (tutar>=0),
  durum text not null default 'bekliyor' check (durum in ('bekliyor','gerceklesti','iptal')),
  hareket_id uuid,
  check ((gelir_id is not null and gider_id is null and yon = 'giris') or (gider_id is not null and gelir_id is null and yon = 'cikis'))
);
create index vadeler_sahip on public.vadeler (sahip_id) where silindi_at is null;
create trigger vadeler_hazirla before insert or update on public.vadeler for each row execute function public.kayit_hazirla();
alter table public.vadeler enable row level security;
create policy vadeler_oku on public.vadeler for select to authenticated using (sahip_id = (select auth.uid()));
create policy vadeler_ekle on public.vadeler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy vadeler_guncelle on public.vadeler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.vadeler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, yon, gelir_id, gider_id, tarih, tutar, durum, hareket_id) on public.vadeler to authenticated;
grant insert (yon, gelir_id, gider_id, tarih, tutar, durum, hareket_id, cihaz, ekstra) on public.vadeler to authenticated;
grant update (yon, gelir_id, gider_id, tarih, tutar, durum, hareket_id, silindi_at, cihaz, ekstra) on public.vadeler to authenticated;

create table public.varliklar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  tur text not null check (tur in ('bes','mevduat','altin')),
  ad text not null check (length(btrim(ad)) between 1 and 120),
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  miktar numeric(18,4),
  birim text check (length(birim)<=20),
  anapara numeric(18,2),
  faiz_orani numeric(9,4),
  vade_tarihi date,
  guncel_deger numeric(18,2),
  bilgi jsonb not null default '{}'::jsonb
);
create index varliklar_sahip on public.varliklar (sahip_id) where silindi_at is null;
create trigger varliklar_hazirla before insert or update on public.varliklar for each row execute function public.kayit_hazirla();
alter table public.varliklar enable row level security;
create policy varliklar_oku on public.varliklar for select to authenticated using (sahip_id = (select auth.uid()));
create policy varliklar_ekle on public.varliklar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy varliklar_guncelle on public.varliklar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.varliklar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, tur, ad, hesap_id, miktar, birim, anapara, faiz_orani, vade_tarihi, guncel_deger, bilgi) on public.varliklar to authenticated;
grant insert (tur, ad, hesap_id, miktar, birim, anapara, faiz_orani, vade_tarihi, guncel_deger, bilgi, cihaz, ekstra) on public.varliklar to authenticated;
grant update (tur, ad, hesap_id, miktar, birim, anapara, faiz_orani, vade_tarihi, guncel_deger, bilgi, silindi_at, cihaz, ekstra) on public.varliklar to authenticated;

create table public.limitler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  kisi_id uuid references public.kisiler(id) on delete restrict,
  hesap_id uuid references public.hesaplar(id) on delete restrict,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  limit_tutari numeric(18,2) not null check (limit_tutari>=0),
  kullanilan numeric(18,2) not null default 0 check (kullanilan>=0),
  notlar text check (length(notlar)<=1000),
  check ((kisi_id is not null) <> (hesap_id is not null))
);
create index limitler_sahip on public.limitler (sahip_id) where silindi_at is null;
create trigger limitler_hazirla before insert or update on public.limitler for each row execute function public.kayit_hazirla();
alter table public.limitler enable row level security;
create policy limitler_oku on public.limitler for select to authenticated using (sahip_id = (select auth.uid()));
create policy limitler_ekle on public.limitler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy limitler_guncelle on public.limitler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.limitler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, kisi_id, hesap_id, ad, limit_tutari, kullanilan, notlar) on public.limitler to authenticated;
grant insert (kisi_id, hesap_id, ad, limit_tutari, kullanilan, notlar, cihaz, ekstra) on public.limitler to authenticated;
grant update (kisi_id, hesap_id, ad, limit_tutari, kullanilan, notlar, silindi_at, cihaz, ekstra) on public.limitler to authenticated;

create table public.hareketler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  hesap_id uuid not null references public.hesaplar(id) on delete restrict,
  yon text not null check (yon in ('giris','cikis')),
  tur text not null check (tur in ('gelir','gider','odeme','market','birikim','transfer','alinan_borc')),
  tutar numeric(18,2) not null check (tutar>0),
  tarih date not null,
  kategori text check (length(kategori)<=60),
  aciklama text check (length(aciklama)<=500),
  gelir_sayilir boolean not null default true,
  odeme_id uuid references public.odemeler(id) on delete restrict,
  vade_id uuid references public.vadeler(id) on delete restrict,
  varlik_id uuid references public.varliklar(id) on delete restrict
);
create index hareketler_sahip on public.hareketler (sahip_id) where silindi_at is null;
create trigger hareketler_hazirla before insert or update on public.hareketler for each row execute function public.kayit_hazirla();
alter table public.hareketler enable row level security;
create policy hareketler_oku on public.hareketler for select to authenticated using (sahip_id = (select auth.uid()));
create policy hareketler_ekle on public.hareketler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy hareketler_guncelle on public.hareketler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.hareketler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, hesap_id, yon, tur, tutar, tarih, kategori, aciklama, gelir_sayilir, odeme_id, vade_id, varlik_id) on public.hareketler to authenticated;
grant insert (hesap_id, yon, tur, tutar, tarih, kategori, aciklama, gelir_sayilir, odeme_id, vade_id, varlik_id, cihaz, ekstra) on public.hareketler to authenticated;
grant update (hesap_id, yon, tur, tutar, tarih, kategori, aciklama, gelir_sayilir, odeme_id, vade_id, varlik_id, silindi_at, cihaz, ekstra) on public.hareketler to authenticated;

-- Önceki tablolarla bağlantılar
alter table public.ibanlar add constraint ibanlar_hesap_fk foreign key (hesap_id) references public.hesaplar(id) on delete restrict;
alter table public.icra_dosyalari add constraint icra_borc_fk foreign key (borc_id) references public.borclar(id) on delete restrict;
alter table public.odemeler add constraint odemeler_hareket_fk foreign key (hareket_id) references public.hareketler(id) on delete restrict;
alter table public.vadeler add constraint vadeler_hareket_fk foreign key (hareket_id) references public.hareketler(id) on delete restrict;

-- Mevcut icra dosyaları için borç kaydı: her dosya bir borç satırı olur ve dosyaya bağlanır.
do $$
declare r record; v_id uuid;
begin
  for r in select i.id, i.sahip_id, i.dosya_no_hash, i.icra_dairesi, i.alacakli_id, i.taraf_rolu, i.durum,
                  i.gercek_asil_alacak, i.guncel_toplam_borc, i.faiz_orani, i.acilis_tarihi, i.kapanis_tarihi
           from public.icra_dosyalari i where i.borc_id is null and i.silindi_at is null loop
    insert into public.borclar (sahip_id, tur, ad, yon, alacakli_id, anapara, guncel_borc, faiz_orani, baslangic_tarihi, bitis_tarihi, durum)
    values (r.sahip_id, 'icra', 'İcra dosyası · ' || coalesce(r.icra_dairesi, '—'),
            case when r.taraf_rolu = 'Alacaklı' then 'alacakli' else 'borclu' end, r.alacakli_id,
            coalesce(r.gercek_asil_alacak, 0), coalesce(r.guncel_toplam_borc, 0), r.faiz_orani, r.acilis_tarihi, r.kapanis_tarihi,
            case when r.durum = 'acik' then 'acik' else 'kapandi' end)
    returning id into v_id;
    update public.icra_dosyalari set borc_id = v_id where id = r.id;
  end loop;
end $$;
