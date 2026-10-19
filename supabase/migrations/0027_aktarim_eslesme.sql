-- Aktarım eşleşmesi: eski sistem (astra-os) kaydı ↔ bu projedeki yeni satır.
-- Amaç: aktarımın idempotent olması (ikinci çalıştırmada yeni satır yok) ve toplu geri alma (silindi_at).
-- Kayıt DEĞERİ içermez: yalnız opak kimlikler, tablo adı, dalga ve çalışma kimliği tutulur.
-- Şablondan farklar: yok; standart sütunların hepsi (sahip_id, surum, silindi_at, cihaz, ekstra) korunur.
-- silindi_at burada "geri alma damgası"dır; satır hiçbir zaman fiziksel silinmez (DELETE politikası yok).
-- Tekil indeks kısmi DEĞİLDİR: geri alınmış eşleşme yeniden aktarımda aynı satırın güncellenmesiyle canlanır.

create table public.aktarim_eslesme (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  kaynak text not null default 'astra-os' check (kaynak ~ '^[a-z0-9-]{2,24}$'),
  koleksiyon text not null check (koleksiyon ~ '^[a-z_]{2,40}$'),
  kaynak_id text not null check (length(kaynak_id) between 1 and 200),
  -- tablo adı listesi uygulama katmanında denetlenir; yeni hedef tablo için yeni migration gerekmesin diye yalnız biçim denetlenir
  hedef_tablo text not null check (hedef_tablo ~ '^[a-z_]{2,40}$'),
  hedef_id uuid,
  hedef_ref text check (length(hedef_ref) <= 260),
  aktarim_id uuid not null,
  dalga text not null check (dalga in ('a', 'b', 'c')),
  check (hedef_id is not null or hedef_ref is not null)
);

create unique index aktarim_eslesme_tekil on public.aktarim_eslesme (sahip_id, kaynak, koleksiyon, kaynak_id);
create index aktarim_eslesme_calisma on public.aktarim_eslesme (sahip_id, aktarim_id) where silindi_at is null;
create index aktarim_eslesme_hedef on public.aktarim_eslesme (sahip_id, hedef_tablo, hedef_id) where hedef_id is not null;

create trigger aktarim_eslesme_hazirla before insert or update on public.aktarim_eslesme
  for each row execute function public.kayit_hazirla();

alter table public.aktarim_eslesme enable row level security;
create policy aktarim_eslesme_oku on public.aktarim_eslesme for select to authenticated using (sahip_id = (select auth.uid()));
create policy aktarim_eslesme_ekle on public.aktarim_eslesme for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy aktarim_eslesme_guncelle on public.aktarim_eslesme for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
-- DELETE politikası yok: geri alma silindi_at ile yapılır.

revoke all on public.aktarim_eslesme from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, cihaz, ekstra, kaynak, koleksiyon, kaynak_id, hedef_tablo, hedef_id, hedef_ref, aktarim_id, dalga)
  on public.aktarim_eslesme to authenticated;
grant insert (kaynak, koleksiyon, kaynak_id, hedef_tablo, hedef_id, hedef_ref, aktarim_id, dalga, cihaz, ekstra)
  on public.aktarim_eslesme to authenticated;
grant update (hedef_tablo, hedef_id, hedef_ref, aktarim_id, dalga, silindi_at, cihaz, ekstra)
  on public.aktarim_eslesme to authenticated;
