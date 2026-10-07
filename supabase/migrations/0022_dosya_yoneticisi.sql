-- Dosya Yöneticisi: kullanıcıya özel klasör ağacı ve belgeler. Dosyalar özel "belgeler" kovasında, kayıtlar bu tabloda tutulur.
-- Klasör bir dava ya da icra dosyasına bağlanabilir (bag_tur + bag_id); klasör adı o kayıttan canlı gösterilir.
create table public.dosya_kayitlari (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb,
  tur text not null check (tur in ('klasor', 'dosya')),
  ad text not null check (length(btrim(ad)) between 1 and 200),
  ust_id uuid references public.dosya_kayitlari(id) on delete restrict,
  yol text unique check (length(yol) <= 400),
  mime text check (length(mime) <= 120),
  boyut bigint check (boyut >= 0),
  yildiz boolean not null default false,
  bag_tur text check (bag_tur in ('dava', 'icra')),
  bag_id uuid,
  check ((tur = 'dosya' and yol is not null and bag_tur is null and yol like sahip_id::text || '/%') or (tur = 'klasor' and yol is null)),
  check ((bag_tur is null) = (bag_id is null))
);
create index dosya_kayitlari_sahip on public.dosya_kayitlari (sahip_id, ust_id) where silindi_at is null;
create index dosya_kayitlari_silinen on public.dosya_kayitlari (sahip_id) where silindi_at is not null;
create unique index dosya_kayitlari_bag on public.dosya_kayitlari (sahip_id, bag_tur, bag_id) where bag_tur is not null and silindi_at is null;
create trigger dosya_kayitlari_hazirla before insert or update on public.dosya_kayitlari for each row execute function public.kayit_hazirla();

-- Üst kayıt aynı sahibin klasörü olmalı; bir klasör kendi alt dalına taşınamaz.
create or replace function public.dosya_ust_denetle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ust_id is null then return new; end if;
  if not exists (select 1 from public.dosya_kayitlari u where u.id = new.ust_id and u.sahip_id = new.sahip_id and u.tur = 'klasor') then
    raise exception 'üst klasör geçersiz' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.ust_id is distinct from old.ust_id and exists (
    with recursive z as (
      select id, ust_id from public.dosya_kayitlari where id = new.ust_id
      union all
      select k.id, k.ust_id from public.dosya_kayitlari k join z on k.id = z.ust_id
    ) select 1 from z where id = new.id
  ) then
    raise exception 'klasör kendi içine taşınamaz' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger dosya_kayitlari_ust before insert or update of ust_id on public.dosya_kayitlari for each row execute function public.dosya_ust_denetle();

alter table public.dosya_kayitlari enable row level security;
create policy dosya_kayitlari_oku on public.dosya_kayitlari for select to authenticated using (sahip_id = (select auth.uid()));
create policy dosya_kayitlari_ekle on public.dosya_kayitlari for insert to authenticated with check (sahip_id = (select auth.uid()));
create policy dosya_kayitlari_guncelle on public.dosya_kayitlari for update to authenticated
  using (sahip_id = (select auth.uid())) with check (sahip_id = (select auth.uid()));
-- Kalıcı silme yalnız çöp kutusundaki (önce silinmiş) kayıtlar için.
create policy dosya_kayitlari_sil on public.dosya_kayitlari for delete to authenticated
  using (sahip_id = (select auth.uid()) and silindi_at is not null);

revoke all on public.dosya_kayitlari from anon, authenticated;
grant select (id, sahip_id, olusturma, guncelleme, surum, silindi_at, tur, ad, ust_id, yol, mime, boyut, yildiz, bag_tur, bag_id) on public.dosya_kayitlari to authenticated;
grant insert (tur, ad, ust_id, yol, mime, boyut, bag_tur, bag_id, cihaz, ekstra) on public.dosya_kayitlari to authenticated;
grant update (ad, ust_id, yildiz, silindi_at, cihaz, ekstra) on public.dosya_kayitlari to authenticated;
grant delete on public.dosya_kayitlari to authenticated;

-- Özel kova: herkes yalnız kendi klasöründeki (klasör adı = kullanıcı kimliği) dosyalara erişir.
insert into storage.buckets (id, name, public, file_size_limit)
values ('belgeler', 'belgeler', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy belgeler_oku on storage.objects for select to authenticated
  using (bucket_id = 'belgeler' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy belgeler_ekle on storage.objects for insert to authenticated
  with check (bucket_id = 'belgeler' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy belgeler_sil on storage.objects for delete to authenticated
  using (bucket_id = 'belgeler' and (storage.foldername(name))[1] = (select auth.uid())::text);
