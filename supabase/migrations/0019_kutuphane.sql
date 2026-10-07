-- Bilgi Kütüphanesi: Zihin Sarayı ile aynı blok düzenleyiciyi kullanır; sayfalar "alan" ile ayrılır.
alter table public.zihin_sayfalari
  add column alan text not null default 'zihin' check (alan in ('zihin', 'kutuphane')),
  add column kategori text check (length(kategori) <= 60),
  add column etiketler text[] not null default '{}' check (cardinality(etiketler) <= 20);

grant select (alan, kategori, etiketler) on public.zihin_sayfalari to authenticated;
grant insert (alan, kategori, etiketler) on public.zihin_sayfalari to authenticated;
grant update (kategori, etiketler) on public.zihin_sayfalari to authenticated;
