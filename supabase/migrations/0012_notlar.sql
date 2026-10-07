-- Notlar ve Yapılacaklar: görevler, Zihin Sarayı sayfaları, kaydedilen listeler.

create table public.todolar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  baslik text not null check (length(btrim(baslik)) between 1 and 300),
  tarih date,
  oncelik text not null default 'orta' check (oncelik in ('yuksek','orta','dusuk')),
  etiket text check (length(etiket)<=40),
  tekrar text not null default 'yok' check (tekrar in ('yok','gunluk','haftalik','aylik')),
  tamamlandi boolean not null default false,
  tamamlanma timestamptz,
  notlar text check (length(notlar)<=4000)
);
create index todolar_sahip on public.todolar (sahip_id) where silindi_at is null;
create trigger todolar_hazirla before insert or update on public.todolar for each row execute function public.kayit_hazirla();
alter table public.todolar enable row level security;
create policy todolar_oku on public.todolar for select to authenticated using (sahip_id = (select auth.uid()));
create policy todolar_ekle on public.todolar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy todolar_guncelle on public.todolar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.todolar from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, baslik, tarih, oncelik, etiket, tekrar, tamamlandi, tamamlanma, notlar) on public.todolar to authenticated;
grant insert (baslik, tarih, oncelik, etiket, tekrar, tamamlandi, tamamlanma, notlar, cihaz, ekstra) on public.todolar to authenticated;
grant update (baslik, tarih, oncelik, etiket, tekrar, tamamlandi, tamamlanma, notlar, silindi_at, cihaz, ekstra) on public.todolar to authenticated;

create table public.zihin_sayfalari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  baslik text not null check (length(btrim(baslik)) between 1 and 200),
  ust_id uuid references public.zihin_sayfalari(id) on delete restrict,
  icerik text not null default '' check (length(icerik)<=200000),
  sira int not null default 0
);
create index zihin_sayfalari_sahip on public.zihin_sayfalari (sahip_id) where silindi_at is null;
create trigger zihin_sayfalari_hazirla before insert or update on public.zihin_sayfalari for each row execute function public.kayit_hazirla();
alter table public.zihin_sayfalari enable row level security;
create policy zihin_sayfalari_oku on public.zihin_sayfalari for select to authenticated using (sahip_id = (select auth.uid()));
create policy zihin_sayfalari_ekle on public.zihin_sayfalari for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy zihin_sayfalari_guncelle on public.zihin_sayfalari for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.zihin_sayfalari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, baslik, ust_id, icerik, sira) on public.zihin_sayfalari to authenticated;
grant insert (baslik, ust_id, icerik, sira, cihaz, ekstra) on public.zihin_sayfalari to authenticated;
grant update (baslik, ust_id, icerik, sira, silindi_at, cihaz, ekstra) on public.zihin_sayfalari to authenticated;

create table public.listeler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  ad text not null check (length(btrim(ad)) between 1 and 120),
  kaynak text not null default 'diger' check (kaynak in ('youtube','pinterest','instagram','diger')),
  notlar text check (length(notlar)<=2000)
);
create index listeler_sahip on public.listeler (sahip_id) where silindi_at is null;
create trigger listeler_hazirla before insert or update on public.listeler for each row execute function public.kayit_hazirla();
alter table public.listeler enable row level security;
create policy listeler_oku on public.listeler for select to authenticated using (sahip_id = (select auth.uid()));
create policy listeler_ekle on public.listeler for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy listeler_guncelle on public.listeler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.listeler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, ad, kaynak, notlar) on public.listeler to authenticated;
grant insert (ad, kaynak, notlar, cihaz, ekstra) on public.listeler to authenticated;
grant update (ad, kaynak, notlar, silindi_at, cihaz, ekstra) on public.listeler to authenticated;

create table public.liste_ogeleri (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  liste_id uuid not null references public.listeler(id) on delete restrict,
  baslik text not null check (length(btrim(baslik)) between 1 and 300),
  baglanti text check (length(baglanti)<=1000),
  etiket text check (length(etiket)<=40),
  okundu boolean not null default false
);
create index liste_ogeleri_sahip on public.liste_ogeleri (sahip_id) where silindi_at is null;
create trigger liste_ogeleri_hazirla before insert or update on public.liste_ogeleri for each row execute function public.kayit_hazirla();
alter table public.liste_ogeleri enable row level security;
create policy liste_ogeleri_oku on public.liste_ogeleri for select to authenticated using (sahip_id = (select auth.uid()));
create policy liste_ogeleri_ekle on public.liste_ogeleri for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy liste_ogeleri_guncelle on public.liste_ogeleri for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.liste_ogeleri from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, liste_id, baslik, baglanti, etiket, okundu) on public.liste_ogeleri to authenticated;
grant insert (liste_id, baslik, baglanti, etiket, okundu, cihaz, ekstra) on public.liste_ogeleri to authenticated;
grant update (liste_id, baslik, baglanti, etiket, okundu, silindi_at, cihaz, ekstra) on public.liste_ogeleri to authenticated;
