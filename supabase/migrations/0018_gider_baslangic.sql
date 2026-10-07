-- Giderler: yıllık, 3 aylık ve tek seferlik kalemlerin hangi aya düştüğünü bilmek için başlangıç (ilk ödeme) tarihi.
alter table public.giderler add column baslangic date;
grant select (baslangic) on public.giderler to authenticated;
grant insert (baslangic) on public.giderler to authenticated;
grant update (baslangic) on public.giderler to authenticated;
