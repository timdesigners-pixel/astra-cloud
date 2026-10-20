/* Onay kodları: geri alma (`ONAY-geri-<12 hex>`) ve yetim temizleme (`ONAY-yetim-<12 hex>`). SAF.
   Kod, seçilen eşleşme kümesinin SAYIMINA ve hedef projeye bağlıdır: kuru çalıştırma ile gerçek çalıştırma arasında durum değişirse kod tutmaz. */
import { ozetOlustur, sabitSureliEsitMi } from '../guvenlik/ozet.ts';
import { kanonikYaz } from '../plan/kanonik-json-hesap.ts';

export const GERI_ONAY_DESENI = /^ONAY-geri-[0-9a-f]{12}$/;
export const YETIM_ONAY_DESENI = /^ONAY-yetim-[0-9a-f]{12}$/;

export type GeriAlSayimi = { hedef_tablo: string; yazildi: number; sahiplenildi: number };

export type GeriAlKodGirdisi = {
  aktarim: string | null;
  dalga: string | null;
  hedefRef: string;
  uygulamaDurumlariniSil: boolean;
  sayimlar: readonly GeriAlSayimi[];
};

function ozetKodu(onEk: 'geri' | 'yetim', govde: unknown): string {
  const ozet = ozetOlustur();
  kanonikYaz({ tur: onEk, govde }, ozet.guncelle);
  return `ONAY-${onEk}-${ozet.hex().slice(0, 12)}`;
}

export function geriAlOnayKodu(g: GeriAlKodGirdisi): string {
  const sayimlar = [...g.sayimlar].sort((a, b) => (a.hedef_tablo < b.hedef_tablo ? -1 : a.hedef_tablo > b.hedef_tablo ? 1 : 0));
  return ozetKodu('geri', { aktarim: g.aktarim, dalga: g.dalga, hedef_ref: g.hedefRef, uygulama_sil: g.uygulamaDurumlariniSil, sayimlar });
}

export function yetimOnayKodu(g: { hedefRef: string; idler: readonly string[]; baslangic: string }): string {
  return ozetKodu('yetim', { hedef_ref: g.hedefRef, baslangic: g.baslangic, idler: [...g.idler].sort() });
}

export function onayEsitMi(beklenen: string, desen: RegExp, verilen: unknown): boolean {
  return typeof verilen === 'string' && desen.test(verilen) && sabitSureliEsitMi(beklenen, verilen);
}
