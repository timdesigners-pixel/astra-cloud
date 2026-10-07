// Sunucuda PIN doğrulama ve ilk kurulum.
//   { pin }                    giriş
//   { islem: 'durum' }         PIN kurulu mu?
//   { islem: 'kur', kod, pin } PIN kur / sıfırla (kurulum koduyla)
// Gizli ayarlar: ASTRA_PIN_BIBER, ASTRA_KURULUM_KODU (isteğe bağlı: ASTRA_CORS_IZIN)
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENV = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(ENV('SUPABASE_URL'), ENV('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const PEPPER = ENV('ASTRA_PIN_BIBER');
const KURULUM_KODU = ENV('ASTRA_KURULUM_KODU');
const IZIN = (ENV('ASTRA_CORS_IZIN') || '*').split(',');
const SAHIP_EPOSTA = 'sahip@astra-cloud.local';

const KILIT_ESIK = 5;
const KILIT_DK = 15;
const KILIT_TAVAN_DK = 24 * 60;
const KURULUM_ESIK = 5;
const KURULUM_PENCERE_DK = 15;
const ZAYIF = new Set(['111111', '123456', '000000', '654321', '12345678', '11111111', '00000000']);
const enc = new TextEncoder();

function cors(req: Request) {
  const o = req.headers.get('origin') ?? '';
  const izinli = IZIN.includes('*') || IZIN.includes(o);
  return {
    'Access-Control-Allow-Origin': izinli ? o || '*' : 'null',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
    'Vary': 'Origin',
  };
}
const yanit = (req: Request, durum: number, govde: unknown) =>
  new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });

const hex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

async function hmac(mesaj: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(PEPPER),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(mesaj))));
}

function esit(a: string, b: string) {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

async function denetimYaz(req: Request, olay: string, basarili: boolean) {
  await admin.from('denetim').insert({
    olay, basarili, ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  });
}

const sahipParolasi = () => hmac('sahip-parola');

async function oturumAc() {
  const anon = createClient(ENV('SUPABASE_URL'), ENV('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: SAHIP_EPOSTA, password: await sahipParolasi() });
  return error || !data.session ? null : data.session;
}

async function sahipBul(): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  return data?.users.find(u => u.email === SAHIP_EPOSTA)?.id ?? null;
}

async function sahipHazirla(): Promise<string | null> {
  const mevcut = await sahipBul();
  if (mevcut) return mevcut;
  const { data, error } = await admin.auth.admin.createUser({
    email: SAHIP_EPOSTA, password: await sahipParolasi(), email_confirm: true,
  });
  return error ? await sahipBul() : data.user.id;
}

async function kur(req: Request, kod: unknown, pin: unknown) {
  const pencere = new Date(Date.now() - KURULUM_PENCERE_DK * 60000).toISOString();
  const { count } = await admin.from('denetim').select('id', { count: 'exact', head: true })
    .eq('olay', 'kurulum_hata').gte('zaman', pencere);
  if ((count ?? 0) >= KURULUM_ESIK) return yanit(req, 423, { kilitBitis: new Date(Date.now() + KURULUM_PENCERE_DK * 60000).toISOString() });

  if (typeof kod !== 'string' || !esit(await hmac(kod), await hmac(KURULUM_KODU))) {
    await denetimYaz(req, 'kurulum_hata', false);
    return yanit(req, 401, { hata: 'kod' });
  }
  if (typeof pin !== 'string' || !/^[0-9]{6,8}$/.test(pin) || ZAYIF.has(pin) || /^(\d)\1+$/.test(pin)) {
    return yanit(req, 400, { hata: 'PIN 6–8 haneli olmalı; 123456, 111111 gibi kolay PIN olmaz' });
  }
  const sahip = await sahipHazirla();
  if (!sahip) return yanit(req, 500, { hata: 'kullanıcı' });

  const { error } = await admin.from('pin_giris').upsert({
    sahip_id: sahip, pin_etiketi: await hmac(`${sahip}:${pin}`),
    deneme: 0, kilit_bitis: null, kilit_kat: 0, guncelleme: new Date().toISOString(),
  }, { onConflict: 'sahip_id' });
  if (error) return yanit(req, 500, { hata: 'kayıt' });

  await denetimYaz(req, 'pin_kuruldu', true);
  const s = await oturumAc();
  if (!s) return yanit(req, 500, { hata: 'oturum' });
  return yanit(req, 200, { access_token: s.access_token, refresh_token: s.refresh_token });
}

async function giris(req: Request, pin: unknown) {
  if (typeof pin !== 'string' || !/^[0-9]{6,8}$/.test(pin)) return yanit(req, 400, { hata: 'PIN 6–8 haneli olmalı' });

  const { data: kayit } = await admin.from('pin_giris').select('*').limit(1).maybeSingle();
  if (!kayit) return yanit(req, 409, { hata: 'kurulmamış' });

  const simdi = Date.now();
  if (kayit.kilit_bitis && new Date(kayit.kilit_bitis).getTime() > simdi) {
    await denetimYaz(req, 'pin_kilitli', false);
    return yanit(req, 423, { kilitBitis: kayit.kilit_bitis });
  }

  if (!esit(await hmac(`${kayit.sahip_id}:${pin}`), kayit.pin_etiketi)) {
    const deneme = kayit.deneme + 1;
    let guncel: Record<string, unknown> = { deneme, guncelleme: new Date().toISOString() };
    let kalan = KILIT_ESIK - deneme;
    if (deneme >= KILIT_ESIK) {
      const dk = Math.min(KILIT_DK * 2 ** kayit.kilit_kat, KILIT_TAVAN_DK);
      guncel = { deneme: 0, kilit_kat: kayit.kilit_kat + 1,
        kilit_bitis: new Date(simdi + dk * 60000).toISOString(), guncelleme: new Date().toISOString() };
      kalan = 0;
    }
    await admin.from('pin_giris').update(guncel).eq('sahip_id', kayit.sahip_id);
    await denetimYaz(req, 'pin_yanlis', false);
    if (guncel.kilit_bitis) return yanit(req, 423, { kilitBitis: guncel.kilit_bitis });
    return yanit(req, 401, { kalan });
  }

  await admin.from('pin_giris').update({ deneme: 0, kilit_kat: 0, kilit_bitis: null }).eq('sahip_id', kayit.sahip_id);
  const s = await oturumAc();
  if (!s) return yanit(req, 500, { hata: 'oturum' });
  await denetimYaz(req, 'pin_giris', true);
  return yanit(req, 200, { access_token: s.access_token, refresh_token: s.refresh_token });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return yanit(req, 405, { hata: 'yöntem' });
  if (!PEPPER || !KURULUM_KODU) return yanit(req, 500, { hata: 'yapılandırma' });

  const g = await req.json().catch(() => ({}));
  if (g.islem === 'durum') {
    const { count } = await admin.from('pin_giris').select('sahip_id', { count: 'exact', head: true });
    return yanit(req, 200, { kurulu: (count ?? 0) > 0 });
  }
  if (g.islem === 'kur') return kur(req, g.kod, g.pin);
  return giris(req, g.pin);
});
