-- Zihin Sarayı blok düzenleyicisi: sayfa simgesi, blok içerik, öne çıkarma/önemli işareti ve dosya deposu.
alter table public.zihin_sayfalari
  add column ikon text check (length(ikon) <= 8),
  add column bloklar jsonb not null default '[]'::jsonb
    check (jsonb_typeof(bloklar) = 'array' and pg_column_size(bloklar) <= 2000000),
  add column one boolean not null default false,
  add column onemli boolean not null default false,
  add column onemli_not text check (length(onemli_not) <= 300),
  add column onemli_renk text check (onemli_renk in ('sari', 'yesil', 'mavi', 'kirmizi', 'mor', 'gri'));

grant select (ikon, bloklar, one, onemli, onemli_not, onemli_renk) on public.zihin_sayfalari to authenticated;
grant insert (ikon, bloklar, one, onemli, onemli_not, onemli_renk) on public.zihin_sayfalari to authenticated;
grant update (ikon, bloklar, one, onemli, onemli_not, onemli_renk) on public.zihin_sayfalari to authenticated;

-- Görseller ve belgeler özel bir depoda tutulur; herkes yalnız kendi klasöründeki dosyalara erişir (klasör adı = kullanıcı kimliği).
insert into storage.buckets (id, name, public, file_size_limit)
values ('zihin', 'zihin', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy zihin_dosya_oku on storage.objects for select to authenticated
  using (bucket_id = 'zihin' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zihin_dosya_ekle on storage.objects for insert to authenticated
  with check (bucket_id = 'zihin' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zihin_dosya_guncelle on storage.objects for update to authenticated
  using (bucket_id = 'zihin' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'zihin' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zihin_dosya_sil on storage.objects for delete to authenticated
  using (bucket_id = 'zihin' and (storage.foldername(name))[1] = (select auth.uid())::text);
