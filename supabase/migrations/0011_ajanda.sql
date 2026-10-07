-- Ajanda: kendi etkinlikleri ve hatırlatmaları. Ödeme, gelir, gider, hedef ve alınacak tarihleri ilgili tablolardan okunur.
create table public.ajanda_olaylari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  baslik text not null check (length(btrim(baslik)) between 1 and 160),
  tarih date not null,
  saat text check (saat ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notlar text check (length(notlar) <= 2000),
  tamamlandi boolean not null default false
);
create index ajanda_olaylari_sahip on public.ajanda_olaylari (sahip_id, tarih) where silindi_at is null;
create trigger ajanda_olaylari_hazirla before insert or update on public.ajanda_olaylari for each row execute function public.kayit_hazirla();
alter table public.ajanda_olaylari enable row level security;
create policy ajanda_olaylari_oku on public.ajanda_olaylari for select to authenticated using (sahip_id = (select auth.uid()));
create policy ajanda_olaylari_ekle on public.ajanda_olaylari for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy ajanda_olaylari_guncelle on public.ajanda_olaylari for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.ajanda_olaylari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, baslik, tarih, saat, notlar, tamamlandi) on public.ajanda_olaylari to authenticated;
grant insert (baslik, tarih, saat, notlar, tamamlandi, cihaz, ekstra) on public.ajanda_olaylari to authenticated;
grant update (baslik, tarih, saat, notlar, tamamlandi, silindi_at, cihaz, ekstra) on public.ajanda_olaylari to authenticated;
