-- Repository data enters through an authenticated, atomic and idempotent import.
-- No source data is embedded in this migration or the public web bundle.
alter table public.borclar add column asgari_odeme numeric(18,2) not null default 0 check (asgari_odeme >= 0);
grant select (asgari_odeme) on public.borclar to authenticated;
grant insert (asgari_odeme) on public.borclar to authenticated;
grant update (asgari_odeme) on public.borclar to authenticated;

create table public.astra_aktarim_izleri (
  sahip_id uuid not null references auth.users(id) on delete cascade,
  kaynak text not null check (length(kaynak) <= 160),
  icerik_hash text not null,
  hedef_id uuid,
  olusturma timestamptz not null default now(),
  primary key (sahip_id, kaynak)
);
alter table public.astra_aktarim_izleri enable row level security;
create policy aktarim_izleri_oku on public.astra_aktarim_izleri for select to authenticated using (sahip_id = (select auth.uid()));
revoke all on public.astra_aktarim_izleri from public, anon, authenticated;
grant select on public.astra_aktarim_izleri to authenticated;

create or replace function public.astra_os_aktar(p_paket jsonb, p_onizleme boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  row_data jsonb; payload jsonb; kind text; source_key text; source_hash text;
  stored_hash text; target_id uuid; existing_payload jsonb; result jsonb;
  planned integer := 0; skipped integer := 0; conflicts integer := 0;
  keys_seen text[] := '{}'; all_rows jsonb; secret_key text;
begin
  if owner_id is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if p_onizleme is null or p_paket ->> 'format' is distinct from 'astra-os-transfer'
    or p_paket ->> 'version' is distinct from '1' or jsonb_typeof(p_paket -> 'records') is distinct from 'array'
    or jsonb_typeof(p_paket -> 'library') is distinct from 'array'
    or pg_column_size(p_paket) > 10000000 then raise exception 'aktarım paketi geçersiz' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':astra-os-import', 0));
  secret_key := private.alan_anahtari();
  all_rows := (p_paket -> 'records') || coalesce((select jsonb_agg(jsonb_build_object(
    'kind', 'library', 'key', 'library:' || (v ->> 'kind') || ':' || (v ->> 'id'), 'data', v))
    from jsonb_array_elements(p_paket -> 'library') v), '[]'::jsonb);
  if jsonb_array_length(all_rows) > 20000 then raise exception 'çok fazla kayıt' using errcode = '22023'; end if;
  for row_data in select value from jsonb_array_elements(all_rows) loop
    kind := row_data ->> 'kind'; payload := row_data -> 'data'; source_key := row_data ->> 'key';
    if kind is null or kind not in ('borc', 'icra', 'dava', 'gelir', 'gider', 'library')
      or source_key is null or length(source_key) not between 3 and 160 or jsonb_typeof(payload) is distinct from 'object'
      or source_key = any(keys_seen) then raise exception 'kayıt türü veya kimliği geçersiz' using errcode = '22023'; end if;
    keys_seen := array_append(keys_seen, source_key);
    source_hash := md5(payload::text);
    stored_hash := null; target_id := null; existing_payload := null;
    select i.icerik_hash into stored_hash from public.astra_aktarim_izleri i where i.sahip_id = owner_id and i.kaynak = source_key;
    if stored_hash is not null then
      if stored_hash = source_hash then skipped := skipped + 1; else conflicts := conflicts + 1; end if;
      continue;
    end if;
    if kind = 'borc' then
      select b.id, jsonb_build_object('anapara', b.anapara, 'faiz_orani', coalesce(b.faiz_orani,0)) into target_id, existing_payload
        from public.borclar b where b.sahip_id = owner_id and lower(b.ad) = lower(payload ->> 'ad') and b.tur = payload ->> 'tur' limit 1;
      if target_id is not null and existing_payload <> jsonb_build_object('anapara', (payload ->> 'anapara')::numeric, 'faiz_orani', coalesce((payload ->> 'faiz_orani')::numeric,0)) then conflicts := conflicts + 1; continue; end if;
      if target_id is null and not p_onizleme then
        insert into public.borclar(sahip_id, ad, tur, anapara, guncel_borc, faiz_orani, asgari_odeme, notlar)
        values(owner_id, payload ->> 'ad', payload ->> 'tur', (payload ->> 'anapara')::numeric, (payload ->> 'anapara')::numeric,
          (payload ->> 'faiz_orani')::numeric, coalesce((payload ->> 'asgari')::numeric,0), payload ->> 'notlar') returning id into target_id;
      end if;
    elsif kind = 'icra' then
      select i.id, jsonb_build_object('total', coalesce(i.guncel_toplam_borc,0), 'court', coalesce(i.icra_dairesi,'')) into target_id, existing_payload
        from public.icra_dosyalari i where i.sahip_id = owner_id and i.dosya_no_hash = encode(extensions.hmac(upper(btrim(payload ->> 'dosya_no')), secret_key, 'sha256'),'hex') limit 1;
      if target_id is not null and existing_payload <> jsonb_build_object('total', coalesce((payload ->> 'guncel_toplam_borc')::numeric,0), 'court', coalesce(payload ->> 'icra_dairesi','')) then conflicts := conflicts + 1; continue; end if;
      if target_id is null and not p_onizleme then
        result := public.icra_kaydet(null, null, payload ->> 'dosya_no', payload - 'dosya_no');
        target_id := (result ->> 'id')::uuid;
      end if;
    elsif kind = 'dava' then
      select d.id, jsonb_build_object('court', coalesce(d.mahkeme,''), 'kind', d.tur) into target_id, existing_payload
        from public.davalar d where d.sahip_id = owner_id and d.dosya_no_hash = encode(extensions.hmac(upper(btrim(payload ->> 'dosya_no')), secret_key, 'sha256'),'hex') limit 1;
      if target_id is not null and existing_payload <> jsonb_build_object('court', coalesce(payload ->> 'mahkeme',''), 'kind', payload ->> 'tur') then conflicts := conflicts + 1; continue; end if;
      if target_id is null and not p_onizleme then
        result := public.dava_kaydet(null, null, payload ->> 'tur', payload ->> 'dosya_no', payload - 'dosya_no' - 'tur');
        target_id := (result ->> 'id')::uuid;
      end if;
    elsif kind = 'gelir' then
      select g.id, to_jsonb(g.tutar) into target_id, existing_payload from public.gelirler g where g.sahip_id = owner_id and lower(g.ad) = lower(payload ->> 'ad') limit 1;
      if target_id is not null and existing_payload <> to_jsonb((payload ->> 'tutar')::numeric) then conflicts := conflicts + 1; continue; end if;
      if target_id is null and not p_onizleme then
        insert into public.gelirler(sahip_id, ad, tur, tutar, gun, baslangic, bitis, notlar)
          values(owner_id, payload ->> 'ad', 'diger', (payload ->> 'tutar')::numeric, (payload ->> 'gun')::smallint,
            (payload ->> 'baslangic')::date, (payload ->> 'bitis')::date, payload ->> 'notlar') returning id into target_id;
      end if;
    elsif kind = 'gider' then
      select g.id, to_jsonb(g.tutar) into target_id, existing_payload from public.giderler g where g.sahip_id = owner_id and lower(g.ad) = lower(payload ->> 'ad') limit 1;
      if target_id is not null and existing_payload <> to_jsonb((payload ->> 'tutar')::numeric) then conflicts := conflicts + 1; continue; end if;
      if target_id is null and not p_onizleme then
        insert into public.giderler(sahip_id, ad, tur, tutar, gun, notlar)
          values(owner_id, payload ->> 'ad', payload ->> 'tur', (payload ->> 'tutar')::numeric, (payload ->> 'gun')::smallint, payload ->> 'notlar') returning id into target_id;
      end if;
    elsif kind = 'library' then
      if coalesce(payload ->> 'kind','') not in ('pinterest','youtube','instagram','files') or coalesce(payload ->> 'url','') !~ '^https?://' then raise exception 'kütüphane bağlantısı geçersiz' using errcode = '22023'; end if;
      select z.id into target_id from public.zihin_sayfalari z where z.sahip_id = owner_id and z.alan = 'kutuphane' and z.icerik = payload ->> 'url' limit 1;
      if target_id is not null then existing_payload := '{}'::jsonb; end if;
      if target_id is null and not p_onizleme then
        insert into public.zihin_sayfalari(sahip_id, baslik, alan, kategori, icerik, etiketler)
          values(owner_id, left(payload ->> 'title',200), 'kutuphane', payload ->> 'kind', payload ->> 'url',
            array(select left(value,60) from jsonb_array_elements_text(coalesce(payload -> 'collections','[]'::jsonb)) limit 20)) returning id into target_id;
      end if;
    end if;
    if existing_payload is not null or (kind = 'library' and target_id is not null and p_onizleme) then skipped := skipped + 1; else planned := planned + 1; end if;
    if not p_onizleme then
      insert into public.astra_aktarim_izleri(sahip_id,kaynak,icerik_hash,hedef_id) values(owner_id,source_key,source_hash,target_id);
    end if;
  end loop;
  if not p_onizleme then
    if conflicts > 0 then raise exception '% çakışma var; aktarım tamamen geri alındı', conflicts using errcode = '40001'; end if;
    -- Preserve unmapped historical seed data in the existing encrypted app store.
    -- Keep source passwords out of the public bundle; archive is owner-only.
    if p_paket ? 'archive' then
      perform public.uygulama_durumu_yaz('eskiarsiv', 'astra-os-' || md5((p_paket -> 'archive')::text), (p_paket -> 'archive')::text);
    end if;
  end if;
  return jsonb_build_object('onizleme',p_onizleme,'yeni',planned,'atlanacak',skipped,'cakisma',conflicts,'toplam',jsonb_array_length(all_rows));
end $$;
revoke all on function public.astra_os_aktar(jsonb,boolean) from public, anon;
grant execute on function public.astra_os_aktar(jsonb,boolean) to authenticated;
