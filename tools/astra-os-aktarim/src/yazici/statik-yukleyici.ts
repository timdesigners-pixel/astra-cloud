/* Storage yazımı için TEK ağ katmanı (`statik-yukle` komutu): servis anahtarlı Supabase istemcisi + genel adresten geri indirme.
   - Servis anahtarı yalnız bu dosyada istemciye verilir; veritabanı çağrısı YAPILMAZ (`.from(tablo)`/`.rpc` yok, yalnız `storage`).
   - Yalnız `apps` kovası ve beyaz listeli yollar (`statikYoluGecerliMi`); aksi halde ağa çıkmadan reddedilir.
   - `upsert:false`: mevcut nesne ASLA ezilmez (`NESNE_VAR`).
   - Her hata `hataGuvenli` ile süzülür (kod/durum/tablo); anahtar, URL ve yol hata nesnesine/mesaja girmez. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ayar } from '../ayar.ts';
import { STATIK_KOVA, STATIK_MIME, statikYoluGecerliMi } from '../donusum/statik-plan-hesap.ts';
import { hataGuvenli } from '../guvenlik/sir-koruma.ts';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { zamanAsimliFetch } from './supabase-yazici.ts';
import { YaziciHatasi } from './yazici-arayuzu.ts';

/* En büyük dosya 7,84 MB; yavaş hatlar için istek başına 2 dk. */
export const STATIK_ISTEK_ZAMAN_ASIMI_MS = 120_000;
const HATA_TABLOSU = 'storage_objects';

export type StatikYuklemeSonucu = 'YUKLENDI' | 'NESNE_VAR';
export type UzakNesneOzeti = { boyut: number; sha256: string };

/* Komut katmanının bildiği tek sözleşme (gerçek uygulama aşağıda, sahte: `bellek-statik-yukleyici.ts`). */
export type StatikYukleyici = {
  /* `upsert:false` ile yükler; hedefte nesne varsa YAZMAZ ve 'NESNE_VAR' döner. Yol beyaz liste dışıysa YaziciHatasi('YOL_IZINSIZ'). */
  yukle(yol: string, bayt: Uint8Array): Promise<StatikYuklemeSonucu>;
  /* Genel adresten geri indirir; boyut + sha256 döner (yüklemenin doğrulaması). */
  dogrula(yol: string): Promise<UzakNesneOzeti>;
};

export type StatikYukleyiciFabrikasi = () => StatikYukleyici;

function ozelHata(kod: string): YaziciHatasi {
  return new YaziciHatasi({ kod, durum: null, tablo: HATA_TABLOSU });
}

function yolDenetle(yol: string): void {
  if (!statikYoluGecerliMi(yol)) throw ozelHata('YOL_IZINSIZ');
}

function alanOku(nesne: unknown, ad: string): unknown {
  if (typeof nesne !== 'object' || nesne === null) return undefined;
  try {
    return (nesne as Record<string, unknown>)[ad];
  } catch {
    return undefined;
  }
}

/* Storage "zaten var" yanıtı: durum kodu 409 (eski sürümlerde gövdede statusCode:'409' ile HTTP 400). Yalnız durum alanları okunur, mesaj değil. */
function nesneVarMi(hata: unknown): boolean {
  return [alanOku(hata, 'statusCode'), alanOku(hata, 'status')].some((d) => d === 409 || d === '409');
}

function yolKodla(yol: string): string {
  return yol.split('/').map(encodeURIComponent).join('/');
}

/* Test dikişi: istemci ve genel adres tabanı dışarıdan verilir. */
export function statikYukleyiciOlustur(istemci: SupabaseClient, genelTaban: string, getir: typeof fetch = zamanAsimliFetch(STATIK_ISTEK_ZAMAN_ASIMI_MS)): StatikYukleyici {
  const taban = genelTaban.replace(/\/+$/, '');
  return {
    async yukle(yol: string, bayt: Uint8Array): Promise<StatikYuklemeSonucu> {
      yolDenetle(yol);
      try {
        const { error } = await istemci.storage.from(STATIK_KOVA).upload(yol, bayt, { contentType: STATIK_MIME, upsert: false, cacheControl: '86400' });
        if (error === null || error === undefined) return 'YUKLENDI';
        if (nesneVarMi(error)) return 'NESNE_VAR';
        throw new YaziciHatasi(hataGuvenli(error, HATA_TABLOSU));
      } catch (e) {
        if (e instanceof YaziciHatasi) throw e;
        throw new YaziciHatasi(hataGuvenli(e, HATA_TABLOSU));
      }
    },

    async dogrula(yol: string): Promise<UzakNesneOzeti> {
      yolDenetle(yol);
      try {
        /* Ara belleğe takılmamak için önbelleksiz istek. */
        const yanit = await getir(`${taban}/storage/v1/object/public/${STATIK_KOVA}/${yolKodla(yol)}`, { headers: { 'Cache-Control': 'no-cache' } });
        if (!yanit.ok) throw new YaziciHatasi(hataGuvenli({ kod: 'INDIRME_HATASI', durum: yanit.status }, HATA_TABLOSU));
        const bayt = new Uint8Array(await yanit.arrayBuffer());
        return { boyut: bayt.byteLength, sha256: sha256HexBayt(bayt) };
      } catch (e) {
        if (e instanceof YaziciHatasi) throw e;
        throw new YaziciHatasi(hataGuvenli(e, HATA_TABLOSU));
      }
    },
  };
}

/* Gerçek yükleyici: yalnız `statik-yukle --onay` doğrulandıktan SONRA çağrılır. Servis anahtarı yoksa ağa çıkılmaz. */
export function supabaseStatikYukleyiciAc(ayar: Ayar): StatikYukleyici {
  if (ayar.servisAnahtari === null) throw ozelHata('SERVIS_ANAHTARI_YOK');
  const istemci = createClient(ayar.supabaseUrl.ac(), ayar.servisAnahtari.ac(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: zamanAsimliFetch(STATIK_ISTEK_ZAMAN_ASIMI_MS) },
  });
  return statikYukleyiciOlustur(istemci, ayar.supabaseUrl.ac());
}
