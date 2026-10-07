import { genelBakisSayfasi } from './genel/genel';
import { marketAlisverisiSayfasi } from './market/fisler';
import { karsilastirmaSayfasi } from './market/karsilastirma';
import { MARKET_SAYFALARI } from './market/market';
import { aylikRaporSayfasi } from './modul/rapor';
import { planlayiciSayfasi } from './modul/planlayici';
import { simulasyonSayfasi } from './modul/simulasyon';
import { davaSayfasi } from './hukuk/davalar';
import { listelerSayfasi } from './notlar/listeler';
import { todoSayfasi } from './notlar/todo';
import { zihinSayfasi } from './notlar/zihin';
import { ajandaSayfasi } from './ajanda/ajanda';
import { BIRIKIM_SAYFALARI } from './kayit/birikim';
import { birikimOzetiSayfasi } from './kayit/birikim-ozet';
import { HEDEF_SAYFALARI } from './kayit/hedefler';
import { borcOzetiSayfasi } from './kayit/borc-ozet';
import { FINANS_SAYFALARI } from './kayit/finans';
import { icraBorclariSayfasi } from './icra/icra';
import { sifrelerSayfasi } from './sifreler/sifreler';
import { kisilerSayfasi } from './kisiler/kisiler';
import { odemeSayfasi } from './odemeler/odemeler';
import { modulMerkeziSayfasi } from './uygulamalar/modul';
import { uygulamaSayfalari } from './uygulamalar/uygulama';

/* Veriyle çalışan sayfalar; kaydı olmayan sekmeler kabukta yer tutucu gösterir. */
export const SAYFALAR: Record<string, (kok: HTMLElement) => void> = {
  genel: genelBakisSayfasi,
  'r-kisi': kisilerSayfasi,
  'r-sifre': sifrelerSayfasi,
  'b-icra': icraBorclariSayfasi,
  'k-icra': icraBorclariSayfasi,
  'b-ozet': borcOzetiSayfasi,
  ...FINANS_SAYFALARI,
  ...BIRIKIM_SAYFALARI,
  ...HEDEF_SAYFALARI,
  'a-ajanda': ajandaSayfasi,
  'k-ceza': davaSayfasi('ceza'),
  'k-hukuk': davaSayfasi('hukuk'),
  'k-cbs': davaSayfasi('cbs'),
  'e-market': marketAlisverisiSayfasi,
  'm-karsi': karsilastirmaSayfasi,
  ...MARKET_SAYFALARI,
  'm-rapor': aylikRaporSayfasi,
  'm-plan': planlayiciSayfasi,
  'm-sim': simulasyonSayfasi,
  'n-todo': todoSayfasi,
  'n-zihin': zihinSayfasi,
  'n-liste': listelerSayfasi,
  'v-ozet': birikimOzetiSayfasi,
  'o-takvim': odemeSayfasi(''),
  'o-vergi': odemeSayfasi('vergi'),
  'o-icra': odemeSayfasi('icra'),
  'o-kisi': odemeSayfasi('kisi'),
  'o-sgk': odemeSayfasi('sgk'),
  hub: modulMerkeziSayfasi,
  ...uygulamaSayfalari,
};
