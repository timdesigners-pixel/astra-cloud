-- Hukuk: ceza davaları, hukuk davaları ve CBS (soruşturma) dosyaları. Dosya numarası şifreli saklanır.
create table public.davalar (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  tur text not null check (tur in ('ceza', 'hukuk', 'cbs')),
  dosya_no_sifreli bytea not null,
  dosya_no_hash text not null,
  mahkeme text check (length(mahkeme) <= 160),
  konu text check (length(konu) <= 300),
  asama text check (length(asama) <= 40),
  durum text not null default 'acik' check (durum in ('acik', 'kapandi')),
  dava_degeri numeric(18, 2) check (dava_degeri >= 0),
  sonraki_durusma date,
  avukat_id uuid references public.kisiler(id) on delete restrict,
  karsi_taraf text check (length(karsi_taraf) <= 300),
  icra_id uuid references public.icra_dosyalari(id) on delete restrict,
  acilis_tarihi date,
  notlar text check (length(notlar) <= 4000)
);
create unique index davalar_tekil on public.davalar (sahip_id, dosya_no_hash) where silindi_at is null;
create index davalar_sahip on public.davalar (sahip_id, tur) where silindi_at is null;
create trigger davalar_hazirla before update on public.davalar for each row execute function public.kayit_hazirla();
alter table public.davalar enable row level security;
create policy davalar_oku on public.davalar for select to authenticated using (sahip_id = (select auth.uid()));
revoke all on public.davalar from anon, authenticated;
-- İstemci yalnız okur ve siler/geri alır; şifreli sütunlar kapalı. Yazma işlevlerle yapılır.
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, tur, mahkeme, konu, asama, durum, dava_degeri, sonraki_durusma,
  avukat_id, karsi_taraf, icra_id, acilis_tarihi, notlar) on public.davalar to authenticated;
grant update (silindi_at) on public.davalar to authenticated;
create policy davalar_guncelle on public.davalar for update to authenticated using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));

-- Dosya numarası çözülmüş liste (yalnız sahibinin kayıtları).
create or replace function public.davalar_listele(p_tur text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(
      (to_jsonb(d) - 'dosya_no_sifreli' - 'dosya_no_hash' - 'sahip_id' - 'ekstra' - 'cihaz')
      || jsonb_build_object('dosya_no', extensions.pgp_sym_decrypt(d.dosya_no_sifreli, v_anahtar))
      order by d.sonraki_durusma nulls last, d.olusturma)
    from public.davalar d
    where d.sahip_id = auth.uid() and d.silindi_at is null and d.tur = p_tur
  ), '[]'::jsonb);
end $$;

-- Ekler (p_id boş) ya da günceller. Güncellemede görülen sürüm hâlâ güncel olmalıdır; değilse 40001 hatası verir.
create or replace function public.dava_kaydet(p_id uuid, p_surum int, p_tur text, p_dosya_no text, p_alanlar jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  v_anahtar text := private.alan_anahtari();
  v_no text := btrim(coalesce(p_dosya_no, ''));
  v_mahkeme text := nullif(btrim(coalesce(p_alanlar ->> 'mahkeme', '')), '');
  v_hash text;
  v_id uuid;
  v_satir jsonb;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if p_tur not in ('ceza', 'hukuk', 'cbs') then raise exception 'tür geçersiz' using errcode = '22023'; end if;
  if v_no = '' or length(v_no) > 80 then raise exception 'dosya numarası geçersiz' using errcode = '22023'; end if;
  if p_alanlar ->> 'avukat_id' is not null and not exists (
    select 1 from public.kisiler k where k.id = (p_alanlar ->> 'avukat_id')::uuid and k.sahip_id = v_sahip and k.silindi_at is null
  ) then raise exception 'avukat bulunamadı' using errcode = '23503'; end if;
  if p_alanlar ->> 'icra_id' is not null and not exists (
    select 1 from public.icra_dosyalari i where i.id = (p_alanlar ->> 'icra_id')::uuid and i.sahip_id = v_sahip and i.silindi_at is null
  ) then raise exception 'icra dosyası bulunamadı' using errcode = '23503'; end if;
  v_hash := encode(extensions.hmac(p_tur || '|' || coalesce(v_mahkeme, '') || '|' || upper(v_no), v_anahtar, 'sha256'), 'hex');

  if p_id is null then
    insert into public.davalar (sahip_id, tur, dosya_no_sifreli, dosya_no_hash, mahkeme, konu, asama, durum, dava_degeri, sonraki_durusma,
      avukat_id, karsi_taraf, icra_id, acilis_tarihi, notlar)
    values (v_sahip, p_tur, extensions.pgp_sym_encrypt(v_no, v_anahtar), v_hash, v_mahkeme,
      nullif(btrim(coalesce(p_alanlar ->> 'konu', '')), ''), nullif(btrim(coalesce(p_alanlar ->> 'asama', '')), ''),
      coalesce(nullif(p_alanlar ->> 'durum', ''), 'acik'), (p_alanlar ->> 'dava_degeri')::numeric, (p_alanlar ->> 'sonraki_durusma')::date,
      (p_alanlar ->> 'avukat_id')::uuid, nullif(btrim(coalesce(p_alanlar ->> 'karsi_taraf', '')), ''), (p_alanlar ->> 'icra_id')::uuid,
      (p_alanlar ->> 'acilis_tarihi')::date, nullif(btrim(coalesce(p_alanlar ->> 'notlar', '')), ''))
    returning id into v_id;
  else
    update public.davalar set
      dosya_no_sifreli = extensions.pgp_sym_encrypt(v_no, v_anahtar), dosya_no_hash = v_hash, mahkeme = v_mahkeme,
      konu = nullif(btrim(coalesce(p_alanlar ->> 'konu', '')), ''), asama = nullif(btrim(coalesce(p_alanlar ->> 'asama', '')), ''),
      durum = coalesce(nullif(p_alanlar ->> 'durum', ''), 'acik'), dava_degeri = (p_alanlar ->> 'dava_degeri')::numeric,
      sonraki_durusma = (p_alanlar ->> 'sonraki_durusma')::date, avukat_id = (p_alanlar ->> 'avukat_id')::uuid,
      karsi_taraf = nullif(btrim(coalesce(p_alanlar ->> 'karsi_taraf', '')), ''), icra_id = (p_alanlar ->> 'icra_id')::uuid,
      acilis_tarihi = (p_alanlar ->> 'acilis_tarihi')::date, notlar = nullif(btrim(coalesce(p_alanlar ->> 'notlar', '')), '')
    where id = p_id and sahip_id = v_sahip and silindi_at is null and surum = p_surum and tur = p_tur
    returning id into v_id;
    if v_id is null then raise exception 'kayıt başka yerde değişmiş' using errcode = '40001'; end if;
  end if;

  select (to_jsonb(d) - 'dosya_no_sifreli' - 'dosya_no_hash' - 'sahip_id' - 'ekstra' - 'cihaz') || jsonb_build_object('dosya_no', v_no)
    into v_satir from public.davalar d where d.id = v_id;
  return v_satir;
end $$;

revoke all on function public.davalar_listele(text), public.dava_kaydet(uuid, int, text, text, jsonb) from public, anon;
grant execute on function public.davalar_listele(text), public.dava_kaydet(uuid, int, text, text, jsonb) to authenticated;
