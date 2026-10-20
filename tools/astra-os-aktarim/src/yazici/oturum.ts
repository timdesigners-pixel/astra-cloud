/* PIN → `pin-giris` Edge Function → authenticated JWT. Sözleşme CL ile aynıdır (apps/web/src/kapi/gate.ts, supabase/functions/pin-giris/index.ts):
   POST /functions/v1/pin-giris {pin}; başlıklar apikey + Authorization: Bearer <anon> (supabase-js functions.invoke bunları kendisi ekler);
   200 {access_token, refresh_token} · 401 {kalan} · 423 {kilitBitis} · 409 kurulmamış.
   R-1 (kilit riski): TEK deneme, otomatik yeniden deneme YOK; yanlış PIN'de kalan deneme sayısı hata nesnesinde döner.
   Jeton yalnız istemcinin belleğinde durur (persistSession kapalı); hiçbir yere yazılmaz, hata mesajına girmez. Ağ erişimi verilen istemci üzerindendir
   (ağ katmanı `supabase-yazici.ts`; burada `fetch` yok). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gizli } from '../ayar.ts';

export type OturumHataKodu =
  | 'PIN_YOK'
  | 'PIN_BICIMI'
  | 'PIN_HATALI'
  | 'KILITLI'
  | 'KURULMAMIS'
  | 'SUNUCU_HATASI'
  | 'BAGLANTI_YOK'
  | 'OTURUM_KURULAMADI';

/* Hata yalnız kod ve (yanlış PIN'de) sunucunun bildirdiği kalan deneme sayısını taşır; PIN/jeton asla. */
export class OturumHatasi extends Error {
  kod: OturumHataKodu;
  kalan: number | null;

  constructor(kod: OturumHataKodu, kalan: number | null = null) {
    super(`OTURUM_HATASI ${kod}${kalan !== null ? ` kalan=${kalan}` : ''}`);
    this.name = 'OturumHatasi';
    this.kod = kod;
    this.kalan = kalan;
  }
}

/* CL pin-giris ile aynı biçim: 6–8 rakam. Biçim bozuksa istek HİÇ atılmaz (boşuna deneme hakkı yakılmaz). */
const PIN_DESENI = /^[0-9]{6,8}$/;

type Gorunum = Record<string, unknown>;

function alan(nesne: unknown, ad: string): unknown {
  if (typeof nesne !== 'object' || nesne === null) return undefined;
  try {
    return (nesne as Gorunum)[ad];
  } catch {
    /* Özel erişimci hata fırlatabilir: yok sayılır. */
    return undefined;
  }
}

async function govdeOku(yanit: unknown): Promise<Gorunum> {
  try {
    const j: unknown = await (yanit as { json: () => Promise<unknown> }).json();
    return typeof j === 'object' && j !== null ? (j as Gorunum) : {};
  } catch {
    /* Gövde okunamazsa yalnız durum kodu kullanılır. */
    return {};
  }
}

/* Başarılıysa `istemci` oturumludur (kullanıcı JWT'si, servis rolü DEĞİL). */
export async function oturumAc(istemci: SupabaseClient, pin: Gizli): Promise<void> {
  const ham = pin.ac();
  if (!PIN_DESENI.test(ham)) throw new OturumHatasi('PIN_BICIMI');

  const { data, error } = await istemci.functions.invoke('pin-giris', { body: { pin: ham } });
  if (error) {
    const baglam = alan(error, 'context');
    const durum = alan(baglam, 'status');
    if (typeof durum !== 'number') throw new OturumHatasi('BAGLANTI_YOK');
    const govde = await govdeOku(baglam);
    if (durum === 401) {
      const kalan = govde.kalan;
      throw new OturumHatasi('PIN_HATALI', typeof kalan === 'number' && Number.isInteger(kalan) ? kalan : null);
    }
    if (durum === 423) throw new OturumHatasi('KILITLI');
    if (durum === 409) throw new OturumHatasi('KURULMAMIS');
    throw new OturumHatasi('SUNUCU_HATASI');
  }

  /* Sunucu içerik türünü JSON bildirmezse supabase-js gövdeyi metin döndürür (gate.ts de türe bakmadan json() okur). */
  let govde: unknown = data;
  if (typeof govde === 'string') {
    try {
      govde = JSON.parse(govde);
    } catch {
      throw new OturumHatasi('SUNUCU_HATASI');
    }
  }
  const erisim = alan(govde, 'access_token');
  const yenileme = alan(govde, 'refresh_token');
  if (typeof erisim !== 'string' || typeof yenileme !== 'string' || erisim === '' || yenileme === '') throw new OturumHatasi('SUNUCU_HATASI');

  const sonuc = await istemci.auth.setSession({ access_token: erisim, refresh_token: yenileme });
  if (sonuc.error || !sonuc.data.session) throw new OturumHatasi('OTURUM_KURULAMADI');
}
