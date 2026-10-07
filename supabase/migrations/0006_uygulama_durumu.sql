-- Modül Merkezi uygulamalarının kayıtları: her (uygulama, anahtar) için tek satır, değer şifreli.
-- İstemci tabloya doğrudan erişemez; yalnız aşağıdaki işlevlerle okur/yazar.
create table public.uygulama_durumu (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  uygulama text not null check (uygulama ~ '^[a-z]{2,24}$'),
  anahtar text not null check (length(anahtar) between 1 and 200),
  deger_sifreli bytea not null,
  unique (sahip_id, uygulama, anahtar)
);
alter table public.uygulama_durumu enable row level security;
revoke all on public.uygulama_durumu from anon, authenticated;

create or replace function public.uygulama_durumu_oku(p_uygulama text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_object_agg(u.anahtar, extensions.pgp_sym_decrypt(u.deger_sifreli, v_anahtar))
    from public.uygulama_durumu u
    where u.sahip_id = auth.uid() and u.uygulama = p_uygulama
  ), '{}'::jsonb);
end $$;

create or replace function public.uygulama_durumu_yaz(p_uygulama text, p_anahtar text, p_deger text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_anahtar text := private.alan_anahtari();
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  if p_uygulama !~ '^[a-z]{2,24}$' then raise exception 'uygulama adı geçersiz' using errcode = '22023'; end if;
  if p_anahtar is null or length(p_anahtar) not between 1 and 200 then raise exception 'anahtar geçersiz' using errcode = '22023'; end if;
  if p_deger is null or length(p_deger) > 8388608 then raise exception 'değer geçersiz' using errcode = '22023'; end if;
  insert into public.uygulama_durumu (sahip_id, uygulama, anahtar, deger_sifreli)
  values (auth.uid(), p_uygulama, p_anahtar, extensions.pgp_sym_encrypt(p_deger, v_anahtar))
  on conflict (sahip_id, uygulama, anahtar)
  do update set deger_sifreli = excluded.deger_sifreli, guncelleme = now();
end $$;

-- p_anahtar boşsa uygulamanın tüm kayıtları silinir.
create or replace function public.uygulama_durumu_sil(p_uygulama text, p_anahtar text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'oturum yok' using errcode = '28000'; end if;
  delete from public.uygulama_durumu
  where sahip_id = auth.uid() and uygulama = p_uygulama and (p_anahtar is null or anahtar = p_anahtar);
end $$;

revoke all on function public.uygulama_durumu_oku(text), public.uygulama_durumu_yaz(text, text, text),
  public.uygulama_durumu_sil(text, text) from public, anon;
grant execute on function public.uygulama_durumu_oku(text), public.uygulama_durumu_yaz(text, text, text),
  public.uygulama_durumu_sil(text, text) to authenticated;
