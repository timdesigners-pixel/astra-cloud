import { genelBakisSayfasi } from './genel/genel';
import { borcOzetiSayfasi } from './kayit/borc-ozet';
import { FINANS_SAYFALARI } from './kayit/finans';
import { icraBorclariSayfasi } from './icra/icra';
import { kisilerSayfasi } from './kisiler/kisiler';
import { odemeSayfasi } from './odemeler/odemeler';
import { modulMerkeziSayfasi } from './uygulamalar/modul';
import { uygulamaSayfalari } from './uygulamalar/uygulama';

/* Veriyle çalışan sayfalar; kaydı olmayan sekmeler kabukta yer tutucu gösterir. */
export const SAYFALAR: Record<string, (kok: HTMLElement) => void> = {
  genel: genelBakisSayfasi,
  'r-kisi': kisilerSayfasi,
  'b-icra': icraBorclariSayfasi,
  'k-icra': icraBorclariSayfasi,
  'b-ozet': borcOzetiSayfasi,
  ...FINANS_SAYFALARI,
  'o-takvim': odemeSayfasi(''),
  'o-vergi': odemeSayfasi('vergi'),
  'o-icra': odemeSayfasi('icra'),
  'o-kisi': odemeSayfasi('kisi'),
  'o-sgk': odemeSayfasi('sgk'),
  hub: modulMerkeziSayfasi,
  ...uygulamaSayfalari,
};
