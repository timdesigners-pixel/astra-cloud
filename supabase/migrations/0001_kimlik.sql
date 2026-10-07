create table public.pin_giris (
  sahip_id uuid primary key references auth.users(id) on delete cascade,
  pin_etiketi text not null,
  deneme int not null default 0,
  kilit_bitis timestamptz,
  kilit_kat int not null default 0,
  guncelleme timestamptz not null default now()
);

create table public.denetim (
  id uuid primary key default gen_random_uuid(),
  zaman timestamptz not null default now(),
  olay text not null,
  basarili boolean not null,
  ip text,
  ayrinti jsonb not null default '{}'::jsonb
);

alter table public.pin_giris enable row level security;
alter table public.denetim enable row level security;

-- İstemci bu tablolara hiçbir koşulda erişemez; yalnız Edge Function (service_role) yazar.
revoke all on public.pin_giris from anon, authenticated;
revoke all on public.denetim from anon, authenticated;
