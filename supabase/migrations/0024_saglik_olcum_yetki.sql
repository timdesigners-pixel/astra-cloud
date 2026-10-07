-- Ölçüm yükleme "yoksa ekle, varsa güncelle" (upsert) ile yapılır; çakışma güncellemesi anahtar sütunlarını da yazdığı için bunlara güncelleme yetkisi gerekir.
grant update (gun, tur, kaynak) on public.saglik_olcumleri to authenticated;
