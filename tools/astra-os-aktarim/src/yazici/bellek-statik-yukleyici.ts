/* SAHTE STATİK YÜKLEYİCİ (testler ve çevrimdışı deneme): `StatikYukleyici` arayüzünün bellek içi uygulaması. Ağ/dosya/ortam yok.
   Gerçek davranışı taklit eder: `upsert:false` (mevcut nesne ezilmez → 'NESNE_VAR'), beyaz liste dışı yol reddi, yüklenenin geri indirilmesi.
   Sayaçlar komut kapısını sınamak içindir (yanlış kodda `yuklemeCagrisi` 0 kalmalı). */
import { statikYoluGecerliMi } from '../donusum/statik-plan-hesap.ts';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import type { StatikYukleyici, StatikYuklemeSonucu, UzakNesneOzeti } from './statik-yukleyici.ts';
import { YaziciHatasi } from './yazici-arayuzu.ts';

export type BellekStatikSecenek = {
  /* Önceden hedefte duran nesneler (yol → bayt). */
  onceden?: Readonly<Record<string, Uint8Array>>;
  /* N. (1 tabanlı) yükleme çağrısında verilen kodla hata fırlatır. */
  yuklemeHatasi?: { sira: number; kod: string };
  /* Yüklenen nesne geri indirilirken bozulur (son bayt atılır): doğrulama farkı denemesi. */
  indirmeyiBozYol?: string;
};

export type BellekStatikYukleyici = StatikYukleyici & {
  depo: Map<string, Uint8Array>;
  yuklemeCagrisi: number;
  dogrulamaCagrisi: number;
  yuklenenYollar: string[];
};

export function bellekStatikYukleyiciKur(secenek: BellekStatikSecenek = {}): BellekStatikYukleyici {
  const depo = new Map<string, Uint8Array>(Object.entries(secenek.onceden ?? {}));
  const y: BellekStatikYukleyici = {
    depo,
    yuklemeCagrisi: 0,
    dogrulamaCagrisi: 0,
    yuklenenYollar: [],
    async yukle(yol: string, bayt: Uint8Array): Promise<StatikYuklemeSonucu> {
      y.yuklemeCagrisi += 1;
      if (!statikYoluGecerliMi(yol)) throw new YaziciHatasi({ kod: 'YOL_IZINSIZ', durum: null, tablo: 'storage_objects' });
      if (secenek.yuklemeHatasi?.sira === y.yuklemeCagrisi) throw new YaziciHatasi({ kod: secenek.yuklemeHatasi.kod, durum: 500, tablo: 'storage_objects' });
      if (depo.has(yol)) return 'NESNE_VAR';
      depo.set(yol, new Uint8Array(bayt));
      y.yuklenenYollar.push(yol);
      return 'YUKLENDI';
    },
    async dogrula(yol: string): Promise<UzakNesneOzeti> {
      y.dogrulamaCagrisi += 1;
      if (!statikYoluGecerliMi(yol)) throw new YaziciHatasi({ kod: 'YOL_IZINSIZ', durum: null, tablo: 'storage_objects' });
      const bayt = depo.get(yol);
      if (bayt === undefined) throw new YaziciHatasi({ kod: 'INDIRME_HATASI', durum: 404, tablo: 'storage_objects' });
      const okunan = secenek.indirmeyiBozYol === yol ? bayt.subarray(0, Math.max(0, bayt.length - 1)) : bayt;
      return { boyut: okunan.byteLength, sha256: sha256HexBayt(okunan) };
    },
  };
  return y;
}
