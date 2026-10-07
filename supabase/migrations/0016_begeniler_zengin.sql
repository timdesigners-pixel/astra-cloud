-- Beğenilen ürünler: kategori, resim, özellikler, bağlantılar, öncelik, favori, puan, hedef fiyat ve fiyat geçmişi.
alter table public.begeniler
  add column kod text check (length(kod) <= 80),
  add column sira int,
  add column kategori text not null default 'diger' check (length(kategori) <= 40),
  add column resim text check (length(resim) <= 1000),
  add column rozet jsonb check (rozet is null or jsonb_typeof(rozet) = 'object'),
  add column fiyat_etiketi text check (length(fiyat_etiketi) <= 120),
  add column ozellikler jsonb not null default '[]'::jsonb check (jsonb_typeof(ozellikler) = 'array'),
  add column baglantilar jsonb not null default '[]'::jsonb check (jsonb_typeof(baglantilar) = 'array'),
  add column oncelik text not null default 'medium' check (oncelik in ('low', 'medium', 'high')),
  add column favori boolean not null default false,
  add column puan smallint check (puan between 0 and 5),
  add column hedef_fiyat numeric(18, 2) check (hedef_fiyat >= 0),
  add column fiyat_gecmisi jsonb not null default '[]'::jsonb check (jsonb_typeof(fiyat_gecmisi) = 'array');
create unique index begeniler_kod on public.begeniler (sahip_id, kod) where kod is not null and silindi_at is null;

grant select (kod, sira, kategori, resim, rozet, fiyat_etiketi, ozellikler, baglantilar, oncelik, favori, puan, hedef_fiyat, fiyat_gecmisi) on public.begeniler to authenticated;
grant insert (kod, sira, kategori, resim, rozet, fiyat_etiketi, ozellikler, baglantilar, oncelik, favori, puan, hedef_fiyat, fiyat_gecmisi) on public.begeniler to authenticated;
grant update (sira, kategori, resim, rozet, fiyat_etiketi, ozellikler, baglantilar, oncelik, favori, puan, hedef_fiyat, fiyat_gecmisi) on public.begeniler to authenticated;
