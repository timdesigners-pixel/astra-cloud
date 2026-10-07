import { genelBakisSayfasi } from './genel/genel';
import { icraBorclariSayfasi } from './icra/icra';
import { kisilerSayfasi } from './kisiler/kisiler';
import { modulMerkeziSayfasi } from './uygulamalar/modul';
import { uygulamaSayfalari } from './uygulamalar/uygulama';

/* Veriyle çalışan sayfalar; kaydı olmayan sekmeler kabukta yer tutucu gösterir. */
export const SAYFALAR: Record<string, (kok: HTMLElement) => void> = {
  genel: genelBakisSayfasi,
  'r-kisi': kisilerSayfasi,
  'b-icra': icraBorclariSayfasi,
  'k-icra': icraBorclariSayfasi,
  hub: modulMerkeziSayfasi,
  ...uygulamaSayfalari,
};
