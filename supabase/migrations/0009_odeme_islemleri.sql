-- Ödendi işaretleme tek işlemde yapılır: hareket yazılır, ödeme kapanır, borç kalanı (ve icra dosyası) güncellenir.
create or replace function public.odeme_isaretle(p_odeme_id uuid, p_hesap_id uuid, p_tarih date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  o public.odemeler%rowtype;
  b public.borclar%rowtype;
  v_hareket uuid;
  v_kalan numeric(18, 2);
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  select * into o from public.odemeler where id = p_odeme_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found or o.durum <> 'bekliyor' then raise exception 'ödeme bulunamadı ya da zaten ödenmiş' using errcode = '22023'; end if;
  select * into b from public.borclar where id = o.borc_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found then raise exception 'borç bulunamadı' using errcode = '23503'; end if;
  if b.yon <> 'borclu' then raise exception 'alacak kaydına ödeme yapılamaz' using errcode = '22023'; end if;
  if not exists (select 1 from public.hesaplar h where h.id = p_hesap_id and h.sahip_id = v_sahip and h.silindi_at is null) then
    raise exception 'hesap bulunamadı' using errcode = '23503';
  end if;

  insert into public.hareketler (sahip_id, hesap_id, yon, tur, tutar, tarih, kategori, aciklama, odeme_id)
  values (v_sahip, p_hesap_id, 'cikis', 'odeme', o.tutar, p_tarih, 'Borç ödemesi', b.ad, o.id)
  returning id into v_hareket;

  update public.odemeler set durum = 'odendi', odeme_tarihi = p_tarih, hesap_id = p_hesap_id, hareket_id = v_hareket where id = o.id;

  v_kalan := greatest(0, b.guncel_borc - o.tutar);
  update public.borclar set guncel_borc = v_kalan, durum = case when v_kalan = 0 then 'kapandi' else durum end where id = b.id;

  if b.tur = 'icra' then
    update public.icra_dosyalari
       set yatan_para = coalesce(yatan_para, 0) + o.tutar,
           guncel_toplam_borc = greatest(0, coalesce(guncel_toplam_borc, 0) - o.tutar),
           durum = case when greatest(0, coalesce(guncel_toplam_borc, 0) - o.tutar) = 0 then 'kapandi' else durum end
     where borc_id = b.id and sahip_id = v_sahip;
  end if;
end $$;

-- Yanlış işaretlenen ödemeyi geri alır: hareket silinir (gizlenir), borç kalanı geri artar.
create or replace function public.odeme_geri_al(p_odeme_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  o public.odemeler%rowtype;
  b public.borclar%rowtype;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  select * into o from public.odemeler where id = p_odeme_id and sahip_id = v_sahip and silindi_at is null for update;
  if not found or o.durum <> 'odendi' then raise exception 'geri alınacak ödeme bulunamadı' using errcode = '22023'; end if;
  select * into b from public.borclar where id = o.borc_id and sahip_id = v_sahip for update;

  update public.odemeler set durum = 'bekliyor', odeme_tarihi = null, hareket_id = null where id = o.id;
  update public.hareketler set silindi_at = now() where id = o.hareket_id and sahip_id = v_sahip;
  update public.borclar set guncel_borc = b.guncel_borc + o.tutar, durum = case when durum = 'kapandi' then 'acik' else durum end where id = b.id;

  if b.tur = 'icra' then
    update public.icra_dosyalari
       set yatan_para = greatest(0, coalesce(yatan_para, 0) - o.tutar),
           guncel_toplam_borc = coalesce(guncel_toplam_borc, 0) + o.tutar,
           durum = case when durum = 'kapandi' then 'acik' else durum end
     where borc_id = b.id and sahip_id = v_sahip;
  end if;
end $$;

revoke all on function public.odeme_isaretle(uuid, uuid, date), public.odeme_geri_al(uuid) from public, anon;
grant execute on function public.odeme_isaretle(uuid, uuid, date), public.odeme_geri_al(uuid) to authenticated;
