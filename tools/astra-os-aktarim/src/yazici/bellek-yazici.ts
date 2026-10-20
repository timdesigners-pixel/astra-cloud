/* SAHTE YAZICI (testler ve çevrimdışı deneme): `Yazici` arayüzünün kalıcı bellek mağazalı uygulaması. Ağ/dosya/ortam yok.
   "Kalıcı": mağaza (`BellekDeposu`) yazıcıdan ayrıdır; aynı depo ile yeni yazıcı kurmak "ikinci çalıştırma" demektir.
   Gerçek veritabanı davranışlarını taklit eder: `begeniler.kod` tekil (23505), `aktarim_eslesme` tekil indeksi KISMİ DEĞİL (23505) ve CHECK'ler (23514),
   `uygulama_durumu` upsert (aynı anahtar yazılırsa EZİLİR; sınır denetimi 22023), soft delete, dalga b/c yöntemleri DALGA_YAZICI_YOK.
   Hata enjeksiyonu: N. çağrıda belirli kodla hata (23505, 22023, ...). Enjekte edilen ham hata `message/details/hint` içinde (test için) değer taşıyabilir;
   yine de `hataGuvenli` süzgecinden geçer, yani gerçek yazıcıyla aynı sızıntı yüzeyi test edilir. */
import { hataGuvenli } from '../guvenlik/sir-koruma.ts';
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
  type YaziciYontemi,
} from './yazici-arayuzu.ts';

export type BellekSatiri = Record<string, unknown> & { id: string; silindi_at: string | null };
export type BellekEslesme = EslesmeSatiri & { kaynak: string };

export type BellekDeposu = {
  begeniler: BellekSatiri[];
  eslesme: BellekEslesme[];
  /* uygulama → (anahtar → değer) */
  uygulamaDurumu: Map<string, Map<string, string>>;
  /* kimlik üreteci sayacı (depo paylaşımı çalıştırmalar arasında çakışmayı önler) */
  idSayaci: number;
};

export type DepoBaslangici = {
  begeniler?: ReadonlyArray<Record<string, unknown>>;
  uygulamaDurumu?: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

export function bellekDeposuKur(baslangic: DepoBaslangici = {}): BellekDeposu {
  const depo: BellekDeposu = { begeniler: [], eslesme: [], uygulamaDurumu: new Map(), idSayaci: 0 };
  for (const b of baslangic.begeniler ?? []) {
    depo.begeniler.push({ ...b, id: idUret(depo), silindi_at: null, olusturma: '2026-01-01T00:00:00.000Z' });
  }
  for (const [uygulama, anahtarlar] of Object.entries(baslangic.uygulamaDurumu ?? {})) {
    depo.uygulamaDurumu.set(uygulama, new Map(Object.entries(anahtarlar)));
  }
  return depo;
}

function idUret(depo: BellekDeposu): string {
  depo.idSayaci += 1;
  return `00000000-0000-4000-8000-${depo.idSayaci.toString(16).padStart(12, '0')}`;
}

export type HataEnjeksiyonu = {
  /* 1 tabanlı: eşleşen çağrıların N.'sinde hata fırlatılır (bir kez). */
  n: number;
  /* Verilmezse tüm yazıcı çağrıları sayılır. */
  yontem?: YaziciYontemi;
  kod: string;
  /* Ham hata nesnesinin message/details/hint alanına konur (sızıntı testi için); çıktıya GİRMEMELİ. */
  ayrinti?: string;
};

export type BellekYazici = Yazici & {
  depo: BellekDeposu;
  cagriSayisi(yontem?: YaziciYontemi): number;
  hataEnjekte(h: HataEnjeksiyonu): void;
  kapatildiMi(): boolean;
};

export type BellekYaziciSecenegi = { saat?: () => Date };

const KOLEKSIYON_DESENI = /^[a-z_]{2,40}$/;
const KAYNAK_DESENI = /^[a-z0-9-]{2,24}$/;
const UYGULAMA_DESENI = /^[a-z]{2,24}$/;
const IZINLI_GUNCELLEME: ReadonlyArray<keyof EslesmeGuncellemesi> = ['hedef_id', 'hedef_ref', 'aktarim_id', 'dalga', 'silindi_at', 'ekstra'];

function kopya<T>(v: T): T {
  return structuredClone(v);
}

export function bellekYaziciKur(depo: BellekDeposu = bellekDeposuKur(), secenek: BellekYaziciSecenegi = {}): BellekYazici {
  const saat = secenek.saat ?? (() => new Date());
  const sayilar = new Map<YaziciYontemi, number>();
  let toplam = 0;
  let kapali = false;
  const kurallar: { h: HataEnjeksiyonu; sayi: number; kullanildi: boolean }[] = [];

  function hata(kod: string, tablo?: string): YaziciHatasi {
    return new YaziciHatasi({ kod, durum: null, tablo: tablo ?? null });
  }

  /* Her genel yöntem tam bir kez sayılır; enjekte edilen hata işlemden ÖNCE fırlar (yan etki yok). */
  async function cagri<T>(yontem: YaziciYontemi, tablo: string | undefined, is: () => T | Promise<T>): Promise<T> {
    toplam += 1;
    sayilar.set(yontem, (sayilar.get(yontem) ?? 0) + 1);
    for (const k of kurallar) {
      if (k.kullanildi || (k.h.yontem !== undefined && k.h.yontem !== yontem)) continue;
      k.sayi += 1;
      if (k.sayi === k.h.n) {
        k.kullanildi = true;
        const ayrinti = k.h.ayrinti ?? 'sahte hata';
        throw new YaziciHatasi(hataGuvenli({ code: k.h.kod, message: ayrinti, details: ayrinti, hint: ayrinti }, tablo));
      }
    }
    return is();
  }

  function eslesmeKontrol(g: EslesmeGirdisi): void {
    const t = 'aktarim_eslesme';
    if (!KAYNAK_DESENI.test(KAYNAK_ADI) || !KOLEKSIYON_DESENI.test(g.koleksiyon)) throw hata('23514', t);
    if (g.kaynak_id.length < 1 || g.kaynak_id.length > 200) throw hata('23514', t);
    if (!KOLEKSIYON_DESENI.test(g.hedef_tablo)) throw hata('23514', t);
    if (g.hedef_id === null && g.hedef_ref === null) throw hata('23514', t);
    if (g.hedef_ref !== null && g.hedef_ref.length > 260) throw hata('23514', t);
    if (g.dalga !== 'a' && g.dalga !== 'b' && g.dalga !== 'c') throw hata('23514', t);
  }

  function rpcIc(ad: RpcAdi, p: Readonly<Record<string, unknown>>): unknown {
    if ((BEKLEYEN_RPC_ADLARI as readonly string[]).includes(ad)) throw hata(DALGA_YAZICI_YOK);
    if (!(CANLI_RPC_ADLARI as readonly string[]).includes(ad)) throw hata('RPC_IZINSIZ');
    const uygulama = p.p_uygulama;
    if (typeof uygulama !== 'string' || !UYGULAMA_DESENI.test(uygulama)) throw hata('22023');
    if (ad === 'uygulama_durumu_oku') return Object.fromEntries(depo.uygulamaDurumu.get(uygulama) ?? []);
    const anahtar = p.p_anahtar;
    if (ad === 'uygulama_durumu_yaz') {
      const deger = p.p_deger;
      if (typeof anahtar !== 'string' || anahtar.length < 1 || anahtar.length > 200) throw hata('22023');
      if (typeof deger !== 'string' || deger.length > 8388608) throw hata('22023');
      let m = depo.uygulamaDurumu.get(uygulama);
      if (!m) depo.uygulamaDurumu.set(uygulama, (m = new Map()));
      m.set(anahtar, deger);
      return null;
    }
    /* uygulama_durumu_sil: boş/null anahtar tüm uygulamayı siler (gerçek RPC davranışı; yazıcı katmanı bunu önler). */
    if (anahtar === null || anahtar === undefined || anahtar === '') depo.uygulamaDurumu.delete(uygulama);
    else depo.uygulamaDurumu.get(uygulama)?.delete(String(anahtar));
    return null;
  }

  return {
    depo,

    cagriSayisi: (yontem) => (yontem === undefined ? toplam : (sayilar.get(yontem) ?? 0)),
    hataEnjekte: (h) => void kurallar.push({ h, sayi: 0, kullanildi: false }),
    kapatildiMi: () => kapali,

    eslesmeOku: (sorgu?: EslesmeSorgusu) =>
      cagri('eslesmeOku', 'aktarim_eslesme', () =>
        depo.eslesme
          .filter((e) => e.kaynak === KAYNAK_ADI && (sorgu?.aktarim_id === undefined || e.aktarim_id === sorgu.aktarim_id) && (sorgu?.dalga === undefined || e.dalga === sorgu.dalga))
          .map((e): EslesmeSatiri => {
            const { kaynak: _kaynak, ...satir } = kopya(e);
            return satir;
          }),
      ),

    eslesmeEkle: (satirlar: readonly EslesmeGirdisi[]) =>
      cagri('eslesmeEkle', 'aktarim_eslesme', () => {
        /* Tek istek = tek işlem: biri bozuksa hiçbiri eklenmez. */
        const yeni: BellekEslesme[] = [];
        for (const g of satirlar) {
          eslesmeKontrol(g);
          const var_ = [...depo.eslesme, ...yeni].some((e) => e.kaynak === KAYNAK_ADI && e.koleksiyon === g.koleksiyon && e.kaynak_id === g.kaynak_id);
          if (var_) throw hata('23505', 'aktarim_eslesme');
          yeni.push({ ...kopya(g), id: idUret(depo), kaynak: KAYNAK_ADI, silindi_at: null });
        }
        depo.eslesme.push(...yeni);
      }),

    eslesmeGuncelle: (id: string, degisiklik: EslesmeGuncellemesi) =>
      cagri('eslesmeGuncelle', 'aktarim_eslesme', () => {
        const e = depo.eslesme.find((x) => x.id === id);
        if (!e) throw hata('ESLESME_YOK', 'aktarim_eslesme');
        for (const k of IZINLI_GUNCELLEME) {
          if (Object.hasOwn(degisiklik, k)) Object.assign(e, { [k]: kopya(degisiklik[k]) });
        }
      }),

    satirEkle: (tablo: EklemeTablosu, satirlar: readonly BegeniEkleSatiri[]) =>
      cagri('satirEkle', tablo, (): EklenenSatir[] => {
        if (tablo !== 'begeniler') throw hata(DALGA_YAZICI_YOK);
        const yeni: BellekSatiri[] = [];
        for (const s of satirlar) {
          if (typeof s.ad !== 'string' || s.ad === '') throw hata('23502', tablo);
          const kodVar = [...depo.begeniler, ...yeni].some((b) => b.silindi_at === null && b.kod === s.kod);
          if (kodVar) throw hata('23505', tablo);
          yeni.push({ ...kopya(s), id: idUret(depo), silindi_at: null, olusturma: saat().toISOString() });
        }
        depo.begeniler.push(...yeni);
        return yeni.map((b) => ({ id: b.id, kod: String(b.kod) }));
      }),

    satirGizle: (tablo: EklemeTablosu, idler: readonly string[]) =>
      cagri('satirGizle', tablo, () => {
        if (tablo !== 'begeniler') throw hata(DALGA_YAZICI_YOK);
        const damga = saat().toISOString();
        for (const b of depo.begeniler) if (idler.includes(b.id) && b.silindi_at === null) b.silindi_at = damga;
      }),

    begeniKodlariOku: () =>
      cagri('begeniKodlariOku', 'begeniler', (): BegeniKaydi[] =>
        depo.begeniler
          .filter((b) => b.silindi_at === null && typeof b.kod === 'string')
          .map((b) => ({ id: b.id, kod: String(b.kod), olusturma: typeof b.olusturma === 'string' ? b.olusturma : null })),
      ),

    begeniFiyatlariOku: (idler: readonly string[]) =>
      cagri('begeniFiyatlariOku', 'begeniler', (): BegeniFiyati[] =>
        depo.begeniler.filter((b) => b.silindi_at === null && idler.includes(b.id)).map((b) => ({ id: b.id, fiyat: typeof b.fiyat === 'number' ? b.fiyat : null })),
      ),

    uygulamaAnahtarlariOku: (uygulama: string) =>
      cagri('uygulamaAnahtarlariOku', undefined, () => Object.keys(rpcIc('uygulama_durumu_oku', { p_uygulama: uygulama }) as Record<string, string>)),

    uygulamaDurumuYaz: (uygulama: string, anahtar: string, deger: string) =>
      cagri('uygulamaDurumuYaz', undefined, () => void rpcIc('uygulama_durumu_yaz', { p_uygulama: uygulama, p_anahtar: anahtar, p_deger: deger })),

    uygulamaDurumuSil: (uygulama: string, anahtar: string) =>
      cagri('uygulamaDurumuSil', undefined, () => {
        if (typeof anahtar !== 'string' || anahtar === '') throw hata('ANAHTAR_BOS');
        rpcIc('uygulama_durumu_sil', { p_uygulama: uygulama, p_anahtar: anahtar });
      }),

    rpcCagir: (ad: RpcAdi, parametre: Readonly<Record<string, unknown>>) => cagri('rpcCagir', undefined, () => rpcIc(ad, parametre)),

    kapat: () =>
      cagri('kapat', undefined, () => {
        kapali = true;
      }),
  };
}
