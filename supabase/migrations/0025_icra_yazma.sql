-- İcra dosyası yazma yolu: ekleme, düzenleme (yalnız gönderilen alanlar), silme ve geri alma.
-- Dosya numarası şifreli saklanır; bağlı borç kaydı (borclar) dosyayla birlikte açılır, bakiyesi icra_borc_esitle tetikleyicisiyle eşitlenir.
create or replace function public.icra_kaydet(p_id uuid, p_surum int, p_dosya_no text, p_alanlar jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  v_anahtar text := private.alan_anahtari();
  v_no text := nullif(btrim(coalesce(p_dosya_no, '')), '');
  a jsonb := coalesce(p_alanlar, '{}'::jsonb);
  v_id uuid;
  v_borc uuid;
  v_rol text;
  v_satir jsonb;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if v_no is not null and length(v_no) > 80 then raise exception 'dosya numarası geçersiz' using errcode = '22023'; end if;
  if a ? 'taraf_rolu' and nullif(a ->> 'taraf_rolu', '') is not null and (a ->> 'taraf_rolu') not in ('Borçlu', 'Alacaklı') then
    raise exception 'taraf rolü geçersiz' using errcode = '22023';
  end if;
  if a ? 'durum' and (a ->> 'durum') not in ('acik', 'kapandi') then raise exception 'durum geçersiz' using errcode = '22023'; end if;
  if a ->> 'alacakli_id' is not null and not exists (select 1 from public.kisiler k where k.id = (a ->> 'alacakli_id')::uuid and k.sahip_id = v_sahip and k.silindi_at is null) then
    raise exception 'alacaklı bulunamadı' using errcode = '23503';
  end if;
  if a ->> 'avukat_id' is not null and not exists (select 1 from public.kisiler k where k.id = (a ->> 'avukat_id')::uuid and k.sahip_id = v_sahip and k.silindi_at is null) then
    raise exception 'avukat bulunamadı' using errcode = '23503';
  end if;

  if p_id is null then
    if v_no is null then raise exception 'dosya numarası gerekli' using errcode = '22023'; end if;
    v_rol := coalesce(nullif(a ->> 'taraf_rolu', ''), 'Borçlu');
    insert into public.borclar (sahip_id, tur, ad, yon, alacakli_id, anapara, guncel_borc, durum)
    values (v_sahip, 'icra', left(coalesce(nullif(btrim(coalesce(a ->> 'karsi_taraf', '')), ''), 'İcra') || ' — ' || v_no, 160),
      case when v_rol = 'Alacaklı' then 'alacakli' else 'borclu' end, (a ->> 'alacakli_id')::uuid, coalesce((a ->> 'gercek_asil_alacak')::numeric, 0), 0, 'acik')
    returning id into v_borc;
    insert into public.icra_dosyalari (sahip_id, dosya_no_sifreli, dosya_no_hash, borc_id, taraf_rolu, durum)
    values (v_sahip, extensions.pgp_sym_encrypt(v_no, v_anahtar), encode(extensions.hmac(upper(v_no), v_anahtar, 'sha256'), 'hex'), v_borc, v_rol, 'acik')
    returning id into v_id;
  end if;

  update public.icra_dosyalari set
    dosya_no_sifreli = case when v_no is not null then extensions.pgp_sym_encrypt(v_no, v_anahtar) else dosya_no_sifreli end,
    dosya_no_hash = case when v_no is not null then encode(extensions.hmac(upper(v_no), v_anahtar, 'sha256'), 'hex') else dosya_no_hash end,
    icra_dairesi = case when a ? 'icra_dairesi' then nullif(btrim(a ->> 'icra_dairesi'), '') else icra_dairesi end,
    alacakli_id = case when a ? 'alacakli_id' then (a ->> 'alacakli_id')::uuid else alacakli_id end,
    avukat_id = case when a ? 'avukat_id' then (a ->> 'avukat_id')::uuid else avukat_id end,
    oncelik = case when a ? 'oncelik' then (a ->> 'oncelik')::smallint else oncelik end,
    taraf_rolu = case when a ? 'taraf_rolu' then nullif(a ->> 'taraf_rolu', '') else taraf_rolu end,
    takip_turu = case when a ? 'takip_turu' then nullif(btrim(a ->> 'takip_turu'), '') else takip_turu end,
    takip_yolu = case when a ? 'takip_yolu' then nullif(btrim(a ->> 'takip_yolu'), '') else takip_yolu end,
    ozel_durum = case when a ? 'ozel_durum' then nullif(btrim(a ->> 'ozel_durum'), '') else ozel_durum end,
    durum = case when a ? 'durum' then a ->> 'durum' else durum end,
    uyap_durum = case when a ? 'uyap_durum' then nullif(btrim(a ->> 'uyap_durum'), '') else uyap_durum end,
    karsi_taraf = case when a ? 'karsi_taraf' then nullif(btrim(a ->> 'karsi_taraf'), '') else karsi_taraf end,
    diger_haciz_sayisi = case when a ? 'diger_haciz_sayisi' then (a ->> 'diger_haciz_sayisi')::int else diger_haciz_sayisi end,
    ucuncu_sahislar = case when a ? 'ucuncu_sahislar' then coalesce(array(select jsonb_array_elements_text(a -> 'ucuncu_sahislar')), '{}') else ucuncu_sahislar end,
    son_islemler = case when a ? 'son_islemler' then coalesce(array(select jsonb_array_elements_text(a -> 'son_islemler')), '{}') else son_islemler end,
    faiz_orani = case when a ? 'faiz_orani' then (a ->> 'faiz_orani')::numeric else faiz_orani end,
    gercek_asil_alacak = case when a ? 'gercek_asil_alacak' then (a ->> 'gercek_asil_alacak')::numeric else gercek_asil_alacak end,
    guncel_toplam_borc = case when a ? 'guncel_toplam_borc' then (a ->> 'guncel_toplam_borc')::numeric else guncel_toplam_borc end,
    faiz_tutari = case when a ? 'faiz_tutari' then (a ->> 'faiz_tutari')::numeric else faiz_tutari end,
    vekalet_ucreti = case when a ? 'vekalet_ucreti' then (a ->> 'vekalet_ucreti')::numeric else vekalet_ucreti end,
    masraf = case when a ? 'masraf' then (a ->> 'masraf')::numeric else masraf end,
    vergi = case when a ? 'vergi' then (a ->> 'vergi')::numeric else vergi end,
    tahsil_harci = case when a ? 'tahsil_harci' then (a ->> 'tahsil_harci')::numeric else tahsil_harci end,
    toplam_alacak = case when a ? 'toplam_alacak' then (a ->> 'toplam_alacak')::numeric else toplam_alacak end,
    yatan_para = case when a ? 'yatan_para' then (a ->> 'yatan_para')::numeric else yatan_para end,
    tahsilat = case when a ? 'tahsilat' then (a ->> 'tahsilat')::numeric else tahsilat end,
    reddiyat = case when a ? 'reddiyat' then (a ->> 'reddiyat')::numeric else reddiyat end,
    acilis_tarihi = case when a ? 'acilis_tarihi' then (a ->> 'acilis_tarihi')::date else acilis_tarihi end,
    kapanis_tarihi = case when a ? 'kapanis_tarihi' then (a ->> 'kapanis_tarihi')::date else kapanis_tarihi end,
    son_islem_tarihi = case when a ? 'son_islem_tarihi' then (a ->> 'son_islem_tarihi')::date else son_islem_tarihi end,
    dogrulama_tarihi = case when a ? 'dogrulama_tarihi' then (a ->> 'dogrulama_tarihi')::date else dogrulama_tarihi end,
    tebligat_tarihi = case when a ? 'tebligat_tarihi' then (a ->> 'tebligat_tarihi')::date else tebligat_tarihi end,
    uyap_tarihi = case when a ? 'uyap_tarihi' then (a ->> 'uyap_tarihi')::date else uyap_tarihi end
  where sahip_id = v_sahip and silindi_at is null
    and id = coalesce(v_id, p_id)
    and (v_id is not null or surum = p_surum)
  returning id into v_id;
  if v_id is null then raise exception 'kayıt başka yerde değişmiş' using errcode = '40001'; end if;

  select (to_jsonb(i) - 'dosya_no_sifreli' - 'dosya_no_hash' - 'sahip_id' - 'ekstra' - 'cihaz')
         || jsonb_build_object('dosya_no', extensions.pgp_sym_decrypt(i.dosya_no_sifreli, v_anahtar))
    into v_satir from public.icra_dosyalari i where i.id = v_id;
  return v_satir;
end $$;

-- Silme ve geri alma: dosya ve bağlı borç kaydı birlikte gizlenir / geri gelir.
create or replace function public.icra_sil(p_id uuid, p_surum int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sahip uuid := auth.uid(); v_borc uuid; v_id uuid;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  update public.icra_dosyalari set silindi_at = now()
   where id = p_id and sahip_id = v_sahip and silindi_at is null and surum = p_surum returning id, borc_id into v_id, v_borc;
  if v_id is null then raise exception 'kayıt başka yerde değişmiş' using errcode = '40001'; end if;
  if v_borc is not null then update public.borclar set silindi_at = now() where id = v_borc and sahip_id = v_sahip and silindi_at is null; end if;
end $$;

create or replace function public.icra_geri_al(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sahip uuid := auth.uid(); v_borc uuid; v_id uuid;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  update public.icra_dosyalari set silindi_at = null where id = p_id and sahip_id = v_sahip and silindi_at is not null returning id, borc_id into v_id, v_borc;
  if v_id is null then raise exception 'kayıt bulunamadı' using errcode = '23503'; end if;
  if v_borc is not null then update public.borclar set silindi_at = null where id = v_borc and sahip_id = v_sahip; end if;
end $$;

revoke all on function public.icra_kaydet(uuid, int, text, jsonb), public.icra_sil(uuid, int), public.icra_geri_al(uuid) from public, anon;
grant execute on function public.icra_kaydet(uuid, int, text, jsonb), public.icra_sil(uuid, int), public.icra_geri_al(uuid) to authenticated;
