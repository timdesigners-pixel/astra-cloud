/* TEK AĞ KATMANI: `@supabase/supabase-js` yalnız bu pakette (yazici/) kullanılır. Kullanıcı oturumu (authenticated JWT) ile çalışır, servis rolü DEĞİL
   (plan §2.1: sır taşıyan RPC'ler `auth.uid()` ister). Her istek 30 sn zaman aşımıyla sınırlıdır. Tüm hata yolları `hataGuvenli` ile süzülür:
   PostgREST `message/details/hint` (kayıt değeri taşıyabilir) hiçbir hata nesnesine girmez.
   Hedefteki MEVCUT satır asla güncellenmez: yalnız insert, eşleşme güncellemesi ve soft delete (`silindi_at`). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ayar, Gizli } from '../ayar.ts';
import { hataGuvenli } from '../guvenlik/sir-koruma.ts';
import { oturumAc } from './oturum.ts';
import {
  BEKLEYEN_RPC_ADLARI,
  CANLI_RPC_ADLARI,
  DALGA_YAZICI_YOK,
  KAYNAK_ADI,
  YaziciHatasi,
  type BegeniEkleSatiri,
  type BegeniFiyati,
  type BegeniKaydi,
  type EklenenSatir,
  type EklemeTablosu,
  type EslesmeGirdisi,
  type EslesmeGuncellemesi,
  type EslesmeSatiri,
  type EslesmeSorgusu,
  type RpcAdi,
  type Yazici,
} from './yazici-arayuzu.ts';

export const ISTEK_ZAMAN_ASIMI_MS = 30_000;
const SAYFA = 1000; /* PostgREST varsayılan üst sınırı */
const YIGIN = 100; /* .in() sorgularında kimlik yığını */

const ESLESME_KOLON = 'id,koleksiyon,kaynak_id,hedef_tablo,hedef_id,hedef_ref,aktarim_id,dalga,silindi_at,ekstra';
/* begeniler insert GRANT'i (0010 + 0016): bunun dışındaki alan gönderilmez. */
const BEGENI_EKLE_KOLONLARI = [
  'kod', 'sira', 'kategori', 'ad', 'resim', 'rozet', 'fiyat', 'fiyat_etiketi', 'ozellikler', 'notlar', 'baglantilar',
  'oncelik', 'favori', 'puan', 'hedef_fiyat', 'fiyat_gecmisi', 'ilk_fiyat', 'ekstra',
] as const;

/* Zaman aşımlı fetch: her istek 30 sn'de iptal edilir; iptal `ZAMAN_ASIMI` koduyla (postgrest `cause.code` yolu) görünür. */
export function zamanAsimliFetch(sureMs: number = ISTEK_ZAMAN_ASIMI_MS, temel: typeof fetch = fetch): typeof fetch {
  return async (girdi, init) => {
    const zaman = AbortSignal.timeout(sureMs);
    const sinyal = init?.signal ? AbortSignal.any([init.signal, zaman]) : zaman;
    try {
      return await temel(girdi, { ...init, signal: sinyal });
    } catch (e) {
      if (zaman.aborted) throw new Error('zaman asimi', { cause: { code: 'ZAMAN_ASIMI' } });
      throw e;
    }
  };
}

function hataCevir(e: unknown, tablo?: string): YaziciHatasi {
  if (e instanceof YaziciHatasi) return e;
  return new YaziciHatasi(hataGuvenli(e, tablo));
}

function ozelHata(kod: string, tablo?: string): YaziciHatasi {
  return new YaziciHatasi({ kod, durum: null, tablo: tablo ?? null });
}

type Sonuc = { data: unknown; error: unknown };

/* Tek istek: hem fırlatılan hem dönen hata süzülür. */
async function calistir(tablo: string | undefined, is: () => PromiseLike<Sonuc>): Promise<unknown> {
  let sonuc: Sonuc;
  try {
    sonuc = await is();
  } catch (e) {
    throw hataCevir(e, tablo);
  }
  if (sonuc.error) throw hataCevir(sonuc.error, tablo);
  return sonuc.data;
}

function diziAl(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function yiginla<T>(dizi: readonly T[], boyut: number): T[][] {
  const sonuc: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) sonuc.push(dizi.slice(i, i + boyut));
  return sonuc;
}

/* Hedef istemciye bağlı yazıcı. `istemci` oturumlu olmalıdır (bkz. `supabaseYaziciAc`). */
export function supabaseYaziciOlustur(istemci: SupabaseClient): Yazici {
  const c = istemci;

  async function sayfaSayfa(tablo: string, sorguKur: (bas: number, son: number) => PromiseLike<Sonuc>): Promise<Record<string, unknown>[]> {
    const hepsi: Record<string, unknown>[] = [];
    for (let bas = 0; ; bas += SAYFA) {
      const sayfa = diziAl(await calistir(tablo, () => sorguKur(bas, bas + SAYFA - 1)));
      hepsi.push(...sayfa);
      if (sayfa.length < SAYFA) return hepsi;
    }
  }

  async function rpcCagir(ad: RpcAdi, parametre: Readonly<Record<string, unknown>>): Promise<unknown> {
    if ((BEKLEYEN_RPC_ADLARI as readonly string[]).includes(ad)) throw ozelHata(DALGA_YAZICI_YOK);
    if (!(CANLI_RPC_ADLARI as readonly string[]).includes(ad)) throw ozelHata('RPC_IZINSIZ');
    return calistir(undefined, () => c.rpc(ad, { ...parametre }));
  }

  return {
    async eslesmeOku(sorgu?: EslesmeSorgusu): Promise<EslesmeSatiri[]> {
      const satirlar = await sayfaSayfa('aktarim_eslesme', (bas, son) => {
        let q = c.from('aktarim_eslesme').select(ESLESME_KOLON).eq('kaynak', KAYNAK_ADI);
        if (sorgu?.aktarim_id !== undefined) q = q.eq('aktarim_id', sorgu.aktarim_id);
        if (sorgu?.dalga !== undefined) q = q.eq('dalga', sorgu.dalga);
        return q.order('id').range(bas, son);
      });
      return satirlar as unknown as EslesmeSatiri[];
    },

    async eslesmeEkle(satirlar: readonly EslesmeGirdisi[]): Promise<void> {
      if (satirlar.length === 0) return;
      await calistir('aktarim_eslesme', () => c.from('aktarim_eslesme').insert(satirlar.map((s) => ({ ...s, ekstra: { ...s.ekstra } }))));
    },

    async eslesmeGuncelle(id: string, degisiklik: EslesmeGuncellemesi): Promise<void> {
      const donen = diziAl(await calistir('aktarim_eslesme', () => c.from('aktarim_eslesme').update({ ...degisiklik }).eq('id', id).select('id')));
      if (donen.length === 0) throw ozelHata('ESLESME_YOK', 'aktarim_eslesme');
    },

    async satirEkle(tablo: EklemeTablosu, satirlar: readonly BegeniEkleSatiri[]): Promise<EklenenSatir[]> {
      if (tablo !== 'begeniler') throw ozelHata(DALGA_YAZICI_YOK);
      if (satirlar.length === 0) return [];
      const govde = satirlar.map((s) => {
        const o: Record<string, unknown> = {};
        for (const k of BEGENI_EKLE_KOLONLARI) if (Object.hasOwn(s, k)) o[k] = s[k];
        return o;
      });
      const donen = diziAl(await calistir(tablo, () => c.from('begeniler').insert(govde).select('id,kod')));
      /* Yanıt sırası varsayılmaz (plan §11.8): kimlikler `kod` ile eşlenir; sayı tutmazsa yarım kalma riski olarak hata. */
      const sonuc: EklenenSatir[] = [];
      for (const d of donen) if (typeof d.id === 'string' && typeof d.kod === 'string') sonuc.push({ id: d.id, kod: d.kod });
      if (sonuc.length !== satirlar.length) throw ozelHata('SATIR_SAYISI_UYUSMADI', tablo);
      return sonuc;
    },

    async satirGizle(tablo: EklemeTablosu, idler: readonly string[]): Promise<void> {
      if (tablo !== 'begeniler') throw ozelHata(DALGA_YAZICI_YOK);
      const damga = new Date().toISOString();
      for (const grup of yiginla(idler, YIGIN)) {
        await calistir(tablo, () => c.from('begeniler').update({ silindi_at: damga }).in('id', grup).is('silindi_at', null));
      }
    },

    async begeniKodlariOku(): Promise<BegeniKaydi[]> {
      const satirlar = await sayfaSayfa('begeniler', (bas, son) =>
        c.from('begeniler').select('id,kod,olusturma').is('silindi_at', null).not('kod', 'is', null).order('id').range(bas, son),
      );
      const sonuc: BegeniKaydi[] = [];
      for (const s of satirlar) {
        if (typeof s.id === 'string' && typeof s.kod === 'string') sonuc.push({ id: s.id, kod: s.kod, olusturma: typeof s.olusturma === 'string' ? s.olusturma : null });
      }
      return sonuc;
    },

    async begeniFiyatlariOku(idler: readonly string[]): Promise<BegeniFiyati[]> {
      const sonuc: BegeniFiyati[] = [];
      for (const grup of yiginla(idler, YIGIN)) {
        const satirlar = diziAl(await calistir('begeniler', () => c.from('begeniler').select('id,fiyat').in('id', grup).is('silindi_at', null)));
        for (const s of satirlar) {
          if (typeof s.id !== 'string') continue;
          const f = typeof s.fiyat === 'number' ? s.fiyat : typeof s.fiyat === 'string' && s.fiyat !== '' ? Number(s.fiyat) : null;
          sonuc.push({ id: s.id, fiyat: f !== null && Number.isFinite(f) ? f : null });
        }
      }
      return sonuc;
    },

    async uygulamaAnahtarlariOku(uygulama: string): Promise<string[]> {
      const veri = await rpcCagir('uygulama_durumu_oku', { p_uygulama: uygulama });
      /* RPC çözülmüş değerleri döndürür; yalnız anahtar adları alınır, değerler hemen atılır. */
      return typeof veri === 'object' && veri !== null && !Array.isArray(veri) ? Object.keys(veri) : [];
    },

    async uygulamaDurumuYaz(uygulama: string, anahtar: string, deger: string): Promise<void> {
      await rpcCagir('uygulama_durumu_yaz', { p_uygulama: uygulama, p_anahtar: anahtar, p_deger: deger });
    },

    async uygulamaDurumuSil(uygulama: string, anahtar: string): Promise<void> {
      /* Sunucu tarafında boş anahtar uygulamanın TÜM kayıtlarını siler: burada kesin engellenir. */
      if (typeof anahtar !== 'string' || anahtar === '') throw ozelHata('ANAHTAR_BOS');
      await rpcCagir('uygulama_durumu_sil', { p_uygulama: uygulama, p_anahtar: anahtar });
    },

    rpcCagir,

    async kapat(): Promise<void> {
      try {
        await c.auth.stopAutoRefresh();
      } catch {
        /* Best-effort: zamanlayıcıyı durdurma hatası işi bozmaz. */
      }
    },
  };
}

/* Zaman aşımlı, oturumu bellekte tutan istemci (persistSession kapalı: jeton diske yazılmaz). */
export function istemciKur(ayar: Ayar): SupabaseClient {
  return createClient(ayar.supabaseUrl.ac(), ayar.anonAnahtar.ac(), {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: zamanAsimliFetch() },
  });
}

/* Gerçek yazıcı: istemci kur → PIN ile TEK deneme → oturumlu yazıcı. */
export async function supabaseYaziciAc(ayar: Ayar, pin: Gizli): Promise<Yazici> {
  const istemci = istemciKur(ayar);
  try {
    await oturumAc(istemci, pin);
  } catch (e) {
    await istemci.auth.stopAutoRefresh().catch(() => undefined);
    throw e;
  }
  return supabaseYaziciOlustur(istemci);
}
