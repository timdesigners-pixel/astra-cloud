// Sunucuda PIN doğrulama: HMAC-SHA256(PEPPER, sahip + pin), sabit zamanlı karşılaştırma,
// 5 yanlışta kilit (15 dk, her seride x2, en çok 24 saat).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENV = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(ENV('SUPABASE_URL'), ENV('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const SAHIP_EPOSTA = ENV('ASTRA_SAHIP_EPOSTA');
const SAHIP_PAROLA = ENV('ASTRA_SAHIP_PAROLA');
const PEPPER = ENV('ASTRA_PIN_BIBER');
const IZIN = (ENV('ASTRA_CORS_IZIN') || '*').split(',');

const KILIT_ESIK = 5;
const KILIT_DK = 15;
const KILIT_TAVAN_DK = 24 * 60;
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

async function etiket(sahip: string, pin: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(PEPPER),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${sahip}:${pin}`)));
}
const hex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return yanit(req, 405, { hata: 'yöntem' });
  if (!PEPPER || !SAHIP_EPOSTA || !SAHIP_PAROLA) return yanit(req, 500, { hata: 'yapılandırma' });

  const { pin } = await req.json().catch(() => ({ pin: '' }));
  if (typeof pin !== 'string' || !/^[0-9]{6,8}$/.test(pin)) return yanit(req, 400, { hata: 'PIN 6–8 haneli olmalı' });

  const { data: kayit } = await admin.from('pin_giris').select('*').limit(1).maybeSingle();
  if (!kayit) return yanit(req, 401, { hata: 'pin' });

  const simdi = Date.now();
  if (kayit.kilit_bitis && new Date(kayit.kilit_bitis).getTime() > simdi) {
    await denetimYaz(req, 'pin_kilitli', false);
    return yanit(req, 423, { kilitBitis: kayit.kilit_bitis });
  }

  const dogru = esit(hex(await etiket(kayit.sahip_id, pin)), kayit.pin_etiketi);
  if (!dogru) {
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
  const anon = createClient(ENV('SUPABASE_URL'), ENV('SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: SAHIP_EPOSTA, password: SAHIP_PAROLA });
  if (error || !data.session) return yanit(req, 500, { hata: 'oturum' });
  await denetimYaz(req, 'pin_giris', true);
  return yanit(req, 200, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
