/* Plan: kayıt değerlerini YALNIZ özel (#) alanlarda tutar. JSON/inspect/string dönüşümleri yalnız `PlanOzeti` (sayı/kod) gösterir;
   değerlere yalnız yazıcı katmanı `kayitlar()` ile erişir. */
import { onayKoduHesapla } from './onay-kodu-hesap.ts';
import type { Dalga, PlanKaydi, PlanOzeti, PlanOzetiTaslagi, PlanVerisi } from './plan-tipleri.ts';
import type { KodluKayit } from '../donusum/neden-kodu.ts';

export class Plan {
  readonly dalga: Dalga;
  readonly onay_kodu: string;
  readonly ozet: PlanOzeti;
  #kayitlar: readonly PlanKaydi[];
  #atlananlar: readonly KodluKayit[];
  #uyarilar: readonly KodluKayit[];

  constructor(dalga: Dalga, taslak: PlanOzetiTaslagi, veri: PlanVerisi) {
    this.dalga = dalga;
    this.onay_kodu = onayKoduHesapla(dalga, taslak, veri);
    this.ozet = Object.freeze({ ...taslak, onay_kodu: this.onay_kodu });
    this.#kayitlar = veri.kayitlar;
    this.#atlananlar = veri.atlananlar;
    this.#uyarilar = veri.uyarilar;
  }

  /* Yazıcı katmanı için: yazılacak kayıtlar (DEĞER İÇERİR; çıktıya/rapora verilmez). */
  kayitlar(): readonly PlanKaydi[] {
    return this.#kayitlar;
  }

  /* Bellek içi tanılama (değer yok): atlanan/uyarı kayıt sayıları. */
  atlananSayisi(): number {
    return this.#atlananlar.length;
  }

  uyariSayisi(): number {
    return this.#uyarilar.length;
  }

  /* Serileştirme yalnız özet döndürür: değer sızdıramaz. */
  toJSON(): PlanOzeti {
    return this.ozet;
  }

  toString(): string {
    return `[Plan dalga=${this.dalga} onay=${this.onay_kodu}]`;
  }

  /* Konsola yazdırma ve util.inspect de değer göstermez (Symbol.for: node:util içe aktarmadan). */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }
}
