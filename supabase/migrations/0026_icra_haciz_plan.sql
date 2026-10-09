-- İcra dosyası başına haciz kayıtları ve anlaşılan ödeme planı (taksit takibi).
create table public.icra_hacizler (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  icra_id uuid not null references public.icra_dosyalari(id) on delete cascade,
  tur text not null default 'banka' check (tur in ('maas', 'banka', 'kira', 'arac', 'tasinmaz', 'ucuncu', 'menkul')),
  hedef text check (length(hedef) <= 300),
  tutar numeric(14, 2) not null default 0 check (tutar >= 0),
  tarih date not null default current_date,
  durum text not null default 'aktif' check (durum in ('aktif', 'kalkti')),
  notlar text check (length(notlar) <= 2000)
);
create index icra_hacizler_sahip on public.icra_hacizler (sahip_id, icra_id) where silindi_at is null;
create trigger icra_hacizler_hazirla before insert or update on public.icra_hacizler for each row execute function public.kayit_hazirla();
alter table public.icra_hacizler enable row level security;
create policy icra_hacizler_oku on public.icra_hacizler for select to authenticated using (sahip_id = (select auth.uid()));
create policy icra_hacizler_ekle on public.icra_hacizler for insert to authenticated
  with check (sahip_id = (select auth.uid()) and exists (select 1 from public.icra_dosyalari d where d.id = icra_id and d.sahip_id = (select auth.uid())));
create policy icra_hacizler_guncelle on public.icra_hacizler for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.icra_hacizler from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, icra_id, tur, hedef, tutar, tarih, durum, notlar) on public.icra_hacizler to authenticated;
grant insert (icra_id, tur, hedef, tutar, tarih, durum, notlar, cihaz, ekstra) on public.icra_hacizler to authenticated;
grant update (tur, hedef, tutar, tarih, durum, notlar, silindi_at, cihaz, ekstra) on public.icra_hacizler to authenticated;

create table public.icra_planlari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  icra_id uuid not null references public.icra_dosyalari(id) on delete cascade,
  taksit numeric(14, 2) not null check (taksit > 0),
  adet int not null check (adet between 1 and 600),
  baslangic date not null default current_date,
  odemeler jsonb not null default '[]'::jsonb check (jsonb_typeof(odemeler) = 'array' and jsonb_array_length(odemeler) <= 1200)
);
create unique index icra_planlari_dosya on public.icra_planlari (icra_id) where silindi_at is null;
create trigger icra_planlari_hazirla before insert or update on public.icra_planlari for each row execute function public.kayit_hazirla();
alter table public.icra_planlari enable row level security;
create policy icra_planlari_oku on public.icra_planlari for select to authenticated using (sahip_id = (select auth.uid()));
create policy icra_planlari_ekle on public.icra_planlari for insert to authenticated
  with check (sahip_id = (select auth.uid()) and exists (select 1 from public.icra_dosyalari d where d.id = icra_id and d.sahip_id = (select auth.uid())));
create policy icra_planlari_guncelle on public.icra_planlari for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.icra_planlari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, icra_id, taksit, adet, baslangic, odemeler) on public.icra_planlari to authenticated;
grant insert (icra_id, taksit, adet, baslangic, odemeler, cihaz, ekstra) on public.icra_planlari to authenticated;
grant update (taksit, adet, baslangic, odemeler, silindi_at, cihaz, ekstra) on public.icra_planlari to authenticated;
