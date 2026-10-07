-- Kişiler: adres ve baro sicil numarası (avukatlar için)
alter table public.kisiler
  add column adres text check (length(adres) <= 500),
  add column baro_no text check (length(baro_no) <= 40);
grant insert (adres, baro_no) on public.kisiler to authenticated;
grant update (adres, baro_no) on public.kisiler to authenticated;

-- IBAN: biçimi geçersiz olsa da kayıt kaybolmasın (eski veriden gelenler işaretlenir)
alter table public.ibanlar add column gecerli boolean not null default true;
grant select (gecerli) on public.ibanlar to authenticated;

-- İcra dosyaları: dosya numarası şifreli, diğer alanlar sorgulanabilir.
create table public.icra_dosyalari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  eski_id bigint,
  oncelik smallint,
  dosya_no_sifreli bytea,
  dosya_no_hash text,
  icra_dairesi text,
  alacakli_id uuid references public.kisiler(id) on delete restrict,
  avukat_id uuid references public.kisiler(id) on delete restrict,
  borc_id uuid,
  taraf_rolu text,
  takip_turu text,
  takip_yolu text,
  ozel_durum text,
  durum text,
  uyap_durum text,
  karsi_taraf text,
  ucuncu_sahislar text[] not null default '{}',
  son_islemler text[] not null default '{}',
  diger_haciz_sayisi int,
  faiz_orani numeric(9, 4),
  gercek_asil_alacak numeric(18, 2),
  guncel_toplam_borc numeric(18, 2),
  faiz_tutari numeric(18, 2),
  vekalet_ucreti numeric(18, 2),
  masraf numeric(18, 2),
  vergi numeric(18, 2),
  tahsil_harci numeric(18, 2),
  toplam_alacak numeric(18, 2),
  yatan_para numeric(18, 2),
  tahsilat numeric(18, 2),
  reddiyat numeric(18, 2),
  acilis_tarihi date,
  kapanis_tarihi date,
  son_islem_tarihi date,
  dogrulama_tarihi date,
  tebligat_tarihi date,
  uyap_tarihi date
);
create unique index icra_dosyalari_eski on public.icra_dosyalari (sahip_id, eski_id) where eski_id is not null;
create index icra_dosyalari_sahip on public.icra_dosyalari (sahip_id) where silindi_at is null;
create index icra_dosyalari_alacakli on public.icra_dosyalari (alacakli_id) where silindi_at is null;
create trigger icra_dosyalari_hazirla before update on public.icra_dosyalari
  for each row execute function public.kayit_hazirla();

alter table public.icra_dosyalari enable row level security;
create policy icra_oku on public.icra_dosyalari for select to authenticated using (sahip_id = (select auth.uid()));

revoke all on public.icra_dosyalari from anon, authenticated;
-- İstemci yalnız okur; şifreli sütunlar kapalı. Yazma sonraki adımda, ekranla birlikte açılır.
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, eski_id, oncelik, icra_dairesi, alacakli_id,
  avukat_id, borc_id, taraf_rolu, takip_turu, takip_yolu, ozel_durum, durum, uyap_durum, karsi_taraf, ucuncu_sahislar,
  son_islemler, diger_haciz_sayisi, faiz_orani, gercek_asil_alacak, guncel_toplam_borc, faiz_tutari, vekalet_ucreti,
  masraf, vergi, tahsil_harci, toplam_alacak, yatan_para, tahsilat, reddiyat, acilis_tarihi, kapanis_tarihi,
  son_islem_tarihi, dogrulama_tarihi, tebligat_tarihi, uyap_tarihi)
  on public.icra_dosyalari to authenticated;

-- Dosya numarası çözülmüş liste (yalnız sahibinin kayıtları).
create or replace function public.icra_dosyalari_listele() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(
      (to_jsonb(i) - 'dosya_no_sifreli' - 'dosya_no_hash' - 'sahip_id' - 'ekstra' - 'cihaz')
      || jsonb_build_object('dosya_no',
           case when i.dosya_no_sifreli is null then null
                else extensions.pgp_sym_decrypt(i.dosya_no_sifreli, v_anahtar) end)
      order by i.oncelik, i.olusturma)
    from public.icra_dosyalari i
    where i.sahip_id = auth.uid() and i.silindi_at is null
  ), '[]'::jsonb);
end $$;
revoke all on function public.icra_dosyalari_listele() from public, anon;
grant execute on function public.icra_dosyalari_listele() to authenticated;
