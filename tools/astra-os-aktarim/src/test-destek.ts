/* Test yardımcıları (yalnız *.test.ts dosyaları içe aktarır; üretim kodu bunu kullanmaz). Gerçek veri/ağ/ortam yok: tüm veri `@astra/ortak-test` sentetik üretecinden. */
import { CANARY_ABONE_NO, CANARY_AD, sentetikSUret, type SentetikS } from '@astra/ortak-test';
import { ciktiHedefiAyarla, sessizAyarla } from './cikti.ts';
import { girdiCoz } from './girdi/okuyucu.ts';
import type { SemaSonucu } from './girdi/sema-ayristirici-hesap.ts';
import type { Bagimlilik } from './komut/bagimlilik.ts';
import { planOlustur } from './plan/plan-olustur-hesap.ts';
import type { Plan } from './plan/plan.ts';
import type { Dalga } from './plan/plan-tipleri.ts';
import { bellekDeposuKur, bellekYaziciKur, type BellekDeposu, type BellekYazici } from './yazici/bellek-yazici.ts';
import type { PlanKaynagi } from './komut/plan-kur.ts';
import { yaz, type YazSonucu } from './komut/yaz.ts';

export const TEST_ANA_MAKINE = 'abcd1234.supabase.co';
export const TEST_URL = `https://${TEST_ANA_MAKINE}`;
export const TEST_SURUM = '15.0.0';

export type OrtamEk = Record<string, string | undefined>;

export function testOrtami(ek: OrtamEk = {}): Record<string, string | undefined> {
  return { ASTRA_SUPABASE_URL: TEST_URL, ASTRA_SUPABASE_ANON: 'anon-sentetik', ...ek };
}

/* Sentetik ürün listesi (`--ilgi`): canary değerler ad/not alanlarına gömülüdür. Beklenen plan kuruş toplamı: 101 + 123450 + 13 + 25000 = 148564. */
export function ilgiUrunleri(): Record<string, unknown>[] {
  return [
    { id: 'urun-001', name: 'Örnek Ürün 001', category: 'Ev', price: 1.005, priority: 'high', favorite: true, rating: 4, added_at: 1750000000000 },
    {
      id: 'urun-002', name: CANARY_AD, category: 'Elektronik', price: '1.234,50', note: CANARY_ABONE_NO,
      price_history: [{ date: '2026-01-01', price: 1300 }, { date: '2026-02-01', price: 1250.5 }],
    },
    { id: 'urun-003', name: 'Örnek Ürün 003', price: 0.125 },
    { id: 'urun-004', name: 'Örnek Ürün 004', price: 250, specs: ['a', 'b'], links: [{ ad: 'x' }] },
    { id: 'urun-005', name: 'Örnek Ürün 005' },
    { id: 'urun-006', name: '', price: 999 },
    { id: 'urun-001', name: 'Tekrar kayıt', price: 111 },
    { id: 'urun-007', name: 'Örnek Ürün 007', price: -5 },
  ];
}

export const ILGI_BEKLENEN_KURUS = 148564;

export function semaKur(s: SentetikS = sentetikSUret()): SemaSonucu {
  return girdiCoz(JSON.stringify(s));
}

export type PlanSecenegi = { dalga?: Dalga; s?: SentetikS; ilgi?: unknown; host?: string; surum?: string };

export function sentetikPlanKur(secenek: PlanSecenegi = {}): { s: SentetikS; sema: SemaSonucu; plan: Plan } {
  const s = secenek.s ?? sentetikSUret();
  const sema = semaKur(s);
  const plan = planOlustur({
    dalga: secenek.dalga ?? 'a',
    sema,
    ilgiHam: 'ilgi' in secenek ? secenek.ilgi : ilgiUrunleri(),
    hedefAnaMakine: secenek.host ?? TEST_ANA_MAKINE,
    aracSurumu: secenek.surum ?? TEST_SURUM,
  });
  return { s, sema, plan };
}

export type CiktiYakalayici = { satirlar: string[]; metin: () => string; birak: () => void };

/* `cikti.ts` kapısını yakalar. Her test sonunda `birak()` çağrılmalıdır (afterEach). */
export function ciktiYakala(): CiktiYakalayici {
  const satirlar: string[] = [];
  ciktiHedefiAyarla({ satir: (m) => void satirlar.push(m), istem: (m) => void satirlar.push(m) });
  sessizAyarla(false);
  return {
    satirlar,
    metin: () => satirlar.join('\n'),
    birak: () => {
      ciktiHedefiAyarla(null);
      sessizAyarla(false);
    },
  };
}

export function uuidSayaci(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `11111111-1111-4111-8111-${n.toString(16).padStart(12, '0')}`;
  };
}

export const SABIT_SAAT = new Date('2026-06-15T09:00:00.000Z');

/* Aynı depoya bağlı yeni yazıcı = "ikinci çalıştırma". Üretilen yazıcılar `uretilen` listesindedir. */
export function yaziciFabrikasi(depo: BellekDeposu, saat: () => Date = () => SABIT_SAAT): { fabrika: () => Promise<BellekYazici>; uretilen: BellekYazici[]; cagri: () => number } {
  const uretilen: BellekYazici[] = [];
  let cagri = 0;
  return {
    fabrika: async () => {
      cagri += 1;
      const y = bellekYaziciKur(depo, { saat });
      uretilen.push(y);
      return y;
    },
    uretilen,
    cagri: () => cagri,
  };
}

/* Bellek içi plan kaynağı: dosya sistemi yok. */
export function bellekPlanKaynagi(s: SentetikS, ilgi: unknown = ilgiUrunleri()): PlanKaynagi {
  return { girdiYukle: () => semaKur(s), ilgiOku: () => ilgi };
}

export function sahteBagimlilik(depo: BellekDeposu, s: SentetikS = sentetikSUret(), ek: Partial<Bagimlilik> = {}): { bag: Bagimlilik; fabrika: ReturnType<typeof yaziciFabrikasi> } {
  const fabrika = yaziciFabrikasi(depo);
  const bag: Bagimlilik = {
    ortam: testOrtami(),
    yaziciKur: fabrika.fabrika,
    aracSurumu: TEST_SURUM,
    simdi: () => SABIT_SAAT,
    uuidUret: uuidSayaci(),
    planKaynagi: bellekPlanKaynagi(s),
    ...ek,
  };
  return { bag, fabrika };
}

export const AKTARIM_1 = '11111111-1111-4111-8111-0000000000a1';
export const AKTARIM_2 = '22222222-2222-4222-8222-0000000000a2';

/* `plan.onay_kodu` ile yazar; yazıcı aynı depoya bağlanır. Dönüş: yaz sonucu ve bu çalıştırmanın yazıcısı. */
export async function yazCalistir(
  plan: Plan,
  depo: BellekDeposu,
  secenek: { aktarimId?: string; yigin?: number; onay?: unknown } = {},
): Promise<{ sonuc: YazSonucu; yazici: BellekYazici }> {
  const f = yaziciFabrikasi(depo);
  const sonuc = await yaz({
    plan,
    onay: 'onay' in secenek ? secenek.onay : plan.onay_kodu,
    yaziciKur: f.fabrika,
    aktarimId: secenek.aktarimId ?? AKTARIM_1,
    yiginBoyutu: secenek.yigin,
  });
  return { sonuc, yazici: f.uretilen[0]! };
}

export const KULLANICI_ODEME_DEGERI = 'KULLANICI-ODEME-DEGERI';

/* Hedefte kullanıcının kendi verisi hazır olan depo: `urun-003` kodlu beğeni (planla çakışır → sahiplenilir), alakasız beğeni,
   `odeme/odeme-raporu-v1` anahtarı (planla çakışır → sahiplenilir, ezilmemeli) ve planda olmayan kullanıcı anahtarı. */
export function kullaniciVeriliDepo(): BellekDeposu {
  return bellekDeposuKur({
    begeniler: [{ kod: 'urun-003', ad: 'Kullanici Urun', fiyat: 5 }, { kod: 'kullanici-baska', ad: 'Baska Kullanici Urunu', fiyat: 1 }],
    uygulamaDurumu: { odeme: { 'odeme-raporu-v1': KULLANICI_ODEME_DEGERI, 'kullanici-ozel': 'KO' } },
  });
}
