-- Bahis net sonucu zarar ise eksi tutarlı satır olarak yazılır; diğer gelir türleri eksi olamaz.
alter table public.gelirler drop constraint gelirler_tutar_check;
alter table public.gelirler add constraint gelirler_tutar_check check (tutar >= 0 or tur = 'bahis');
