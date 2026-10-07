-- Rehber: Hesaplar ve Şifreler. Kullanıcı adı, şifre ve not şifreli saklanır; şifre yalnız istenince çözülür.
create table public.sifre_hesaplari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  hizmet text not null check (length(btrim(hizmet)) between 1 and 120),
  kategori text check (length(kategori) <= 40),
  adres text check (length(adres) <= 500),
  kullanici_sifreli bytea,
  sifre_sifreli bytea,
  not_sifreli bytea
);
create index sifre_hesaplari_sahip on public.sifre_hesaplari (sahip_id) where silindi_at is null;
create trigger sifre_hesaplari_hazirla before update on public.sifre_hesaplari for each row execute function public.kayit_hazirla();
alter table public.sifre_hesaplari enable row level security;
create policy sifre_hesaplari_oku on public.sifre_hesaplari for select to authenticated using (sahip_id = (select auth.uid()));
create policy sifre_hesaplari_guncelle on public.sifre_hesaplari for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
revoke all on public.sifre_hesaplari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, hizmet, kategori, adres) on public.sifre_hesaplari to authenticated;
grant update (silindi_at) on public.sifre_hesaplari to authenticated;

-- Liste: şifre dışındaki alanlar çözülür.
create or replace function public.sifre_listele() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'surum', s.surum, 'hizmet', s.hizmet, 'kategori', s.kategori, 'adres', s.adres,
      'kullanici', case when s.kullanici_sifreli is null then null else extensions.pgp_sym_decrypt(s.kullanici_sifreli, v_anahtar) end,
      'notlar', case when s.not_sifreli is null then null else extensions.pgp_sym_decrypt(s.not_sifreli, v_anahtar) end,
      'sifre_var', s.sifre_sifreli is not null
    ) order by lower(s.hizmet), s.olusturma)
    from public.sifre_hesaplari s
    where s.sahip_id = auth.uid() and s.silindi_at is null
  ), '[]'::jsonb);
end $$;

-- Şifreyi yalnız tek kayıt için, istenince çözer.
create or replace function public.sifre_goster(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari(); v_sifre text;
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  select case when s.sifre_sifreli is null then null else extensions.pgp_sym_decrypt(s.sifre_sifreli, v_anahtar) end
    into v_sifre from public.sifre_hesaplari s
    where s.id = p_id and s.sahip_id = auth.uid() and s.silindi_at is null;
  return v_sifre;
end $$;

-- Ekler (p_id boş) ya da günceller. Güncellemede şifre boş gelirse eski şifre korunur; sürüm uyuşmazsa 40001.
create or replace function public.sifre_kaydet(p_id uuid, p_surum int, p_hizmet text, p_kategori text, p_adres text, p_kullanici text, p_sifre text, p_not text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sahip uuid := auth.uid();
  v_anahtar text := private.alan_anahtari();
  v_hizmet text := btrim(coalesce(p_hizmet, ''));
  v_kul text := nullif(btrim(coalesce(p_kullanici, '')), '');
  v_not text := nullif(btrim(coalesce(p_not, '')), '');
  v_sifre text := nullif(coalesce(p_sifre, ''), '');
  v_id uuid;
  v_satir jsonb;
begin
  if v_sahip is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if v_hizmet = '' or length(v_hizmet) > 120 then raise exception 'hizmet adı geçersiz' using errcode = '22023'; end if;
  if length(coalesce(p_kullanici, '')) > 300 or length(coalesce(p_sifre, '')) > 300 or length(coalesce(p_not, '')) > 4000 then
    raise exception 'alan çok uzun' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.sifre_hesaplari (sahip_id, hizmet, kategori, adres, kullanici_sifreli, sifre_sifreli, not_sifreli)
    values (v_sahip, v_hizmet, nullif(btrim(coalesce(p_kategori, '')), ''), nullif(btrim(coalesce(p_adres, '')), ''),
      case when v_kul is null then null else extensions.pgp_sym_encrypt(v_kul, v_anahtar) end,
      case when v_sifre is null then null else extensions.pgp_sym_encrypt(v_sifre, v_anahtar) end,
      case when v_not is null then null else extensions.pgp_sym_encrypt(v_not, v_anahtar) end)
    returning id into v_id;
  else
    update public.sifre_hesaplari set
      hizmet = v_hizmet, kategori = nullif(btrim(coalesce(p_kategori, '')), ''), adres = nullif(btrim(coalesce(p_adres, '')), ''),
      kullanici_sifreli = case when v_kul is null then null else extensions.pgp_sym_encrypt(v_kul, v_anahtar) end,
      sifre_sifreli = case when v_sifre is null then sifre_sifreli else extensions.pgp_sym_encrypt(v_sifre, v_anahtar) end,
      not_sifreli = case when v_not is null then null else extensions.pgp_sym_encrypt(v_not, v_anahtar) end
    where id = p_id and sahip_id = v_sahip and silindi_at is null and surum = p_surum
    returning id into v_id;
    if v_id is null then raise exception 'kayıt başka yerde değişmiş' using errcode = '40001'; end if;
  end if;
  select jsonb_build_object('id', s.id, 'surum', s.surum, 'hizmet', s.hizmet, 'kategori', s.kategori, 'adres', s.adres,
    'kullanici', v_kul, 'notlar', v_not, 'sifre_var', s.sifre_sifreli is not null)
    into v_satir from public.sifre_hesaplari s where s.id = v_id;
  return v_satir;
end $$;

revoke all on function public.sifre_listele(), public.sifre_goster(uuid), public.sifre_kaydet(uuid, int, text, text, text, text, text, text) from public, anon;
grant execute on function public.sifre_listele(), public.sifre_goster(uuid), public.sifre_kaydet(uuid, int, text, text, text, text, text, text) to authenticated;
