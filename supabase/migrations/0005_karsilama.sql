-- Ayarlar: anahtar başına tek satır (profil, sağlık hedefleri...)
create table public.ayarlar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  anahtar text not null check (length(anahtar) between 1 and 60),
  deger jsonb not null default '{}'::jsonb,
  unique (sahip_id, anahtar)
);
create trigger ayarlar_hazirla before insert or update on public.ayarlar
  for each row execute function public.kayit_hazirla();

-- Hızlı notlar
create table public.hizli_notlar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  metin text not null check (length(btrim(metin)) between 1 and 2000)
);
create index hizli_notlar_sahip on public.hizli_notlar (sahip_id, olusturma desc) where silindi_at is null;
create trigger hizli_notlar_hazirla before insert or update on public.hizli_notlar
  for each row execute function public.kayit_hazirla();

-- Günlük sağlık kaydı: gün başına tek satır (Europe/Istanbul gününe göre istemci yazar)
create table public.saglik_gunluk (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  gun date not null,
  adim int check (adim between 0 and 200000),
  kalori int check (kalori between 0 and 20000),
  su_ml int check (su_ml between 0 and 20000),
  uyku text check (length(uyku) <= 20),
  tansiyon text check (length(tansiyon) <= 20),
  nabiz int check (nabiz between 0 and 300),
  unique (sahip_id, gun)
);
create trigger saglik_gunluk_hazirla before insert or update on public.saglik_gunluk
  for each row execute function public.kayit_hazirla();

alter table public.ayarlar enable row level security;
alter table public.hizli_notlar enable row level security;
alter table public.saglik_gunluk enable row level security;

create policy ayarlar_oku on public.ayarlar for select to authenticated using (sahip_id = (select auth.uid()));
create policy ayarlar_ekle on public.ayarlar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy ayarlar_guncelle on public.ayarlar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
create policy notlar_oku on public.hizli_notlar for select to authenticated using (sahip_id = (select auth.uid()));
create policy notlar_ekle on public.hizli_notlar for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy notlar_guncelle on public.hizli_notlar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
create policy saglik_oku on public.saglik_gunluk for select to authenticated using (sahip_id = (select auth.uid()));
create policy saglik_ekle on public.saglik_gunluk for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy saglik_guncelle on public.saglik_gunluk for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));

revoke all on public.ayarlar, public.hizli_notlar, public.saglik_gunluk from anon, authenticated;
grant select on public.ayarlar, public.hizli_notlar, public.saglik_gunluk to authenticated;
grant insert (anahtar, deger, cihaz) on public.ayarlar to authenticated;
grant update (deger, cihaz) on public.ayarlar to authenticated;
grant insert (metin, cihaz) on public.hizli_notlar to authenticated;
grant update (metin, silindi_at, cihaz) on public.hizli_notlar to authenticated;
grant insert (gun, adim, kalori, su_ml, uyku, tansiyon, nabiz, cihaz) on public.saglik_gunluk to authenticated;
grant update (adim, kalori, su_ml, uyku, tansiyon, nabiz, cihaz) on public.saglik_gunluk to authenticated;
