-- İcra dosyasının durumu, dosya bakiyesinin sayılıp sayılmayacağını belirler:
-- kapalı, durdurulmuş, itiraz edilmiş, takipsiz, infaz edilmiş ya da iptal edilmiş dosyaların bakiyesi 0 kabul edilir.
-- Dosyanın kendi UYAP rakamı değişmez; bağlı borç kaydının güncel borcu bu kurala göre eşitlenir.
create or replace function public.icra_bakiye_gecerli(p_durum text, p_uyap_durum text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_durum, '') <> 'kapandi'
    and lower(translate(coalesce(p_uyap_durum, ''), 'İIı', 'iii')) !~ '(durdur|itiraz|kapal|takipsiz|infaz|iptal)'
$$;

create or replace function public.icra_borc_esitle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.borc_id is not null then
    update public.borclar
       set guncel_borc = case when public.icra_bakiye_gecerli(new.durum, new.uyap_durum) then coalesce(new.guncel_toplam_borc, 0) else 0 end
     where id = new.borc_id
       and guncel_borc is distinct from case when public.icra_bakiye_gecerli(new.durum, new.uyap_durum) then coalesce(new.guncel_toplam_borc, 0) else 0 end;
  end if;
  return null;
end $$;

create trigger icra_dosyalari_borc_esitle
  after insert or update of durum, uyap_durum, guncel_toplam_borc, borc_id on public.icra_dosyalari
  for each row execute function public.icra_borc_esitle();

-- Var olan kayıtlar
update public.borclar b
   set guncel_borc = 0
  from public.icra_dosyalari i
 where i.borc_id = b.id and i.silindi_at is null
   and not public.icra_bakiye_gecerli(i.durum, i.uyap_durum)
   and b.guncel_borc <> 0;
