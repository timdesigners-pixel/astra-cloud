import { genelBakisSayfasi } from './genel/genel';
import { marketAlisverisiSayfasi } from './market/fisler';
import { karsilastirmaSayfasi } from './market/karsilastirma';
import { MARKET_SAYFALARI } from './market/market';
import { aylikRaporSayfasi } from './modul/rapor';
import { planlayiciSayfasi } from './modul/planlayici';
import { simulasyonSayfasi } from './modul/simulasyon';
import { davaSayfasi } from './hukuk/davalar';
import { surelerSayfasi } from './hukuk/sureler';
import { listelerSayfasi } from './notlar/listeler';
import { todoSayfasi } from './notlar/todo';
import { kutuphaneSayfasi, zihinSayfasi } from './notlar/zihin';
import { ajandaSayfasi } from './ajanda/ajanda';
import { BIRIKIM_SAYFALARI } from './kayit/birikim';
import { birikimOzetiSayfasi } from './kayit/birikim-ozet';
import { HEDEF_SAYFALARI } from './kayit/hedefler';
import { gelirOzetiSayfasi, giderOzetiSayfasi } from './kayit/gelir-gider-ozet';
import { borcOzetiSayfasi } from './kayit/borc-ozet';
import { FINANS_SAYFALARI } from './kayit/finans';
import { icraBorclariSayfasi } from './icra/icra';
import { begenilerSayfasi } from './begeniler/begeniler';
import { sistemSayfasi } from './sistem/sistem';
import { acilKartSayfasi } from './sistem/acil-kart';
import { gmailFaturaSayfasi } from './kayit/gmail-fatura';
import { ibanSayfasi } from './iban/iban';
import { sifrelerSayfasi } from './sifreler/sifreler';
import { kisilerSayfasi } from './kisiler/kisiler';
import { odemeSayfasi } from './odemeler/odemeler';
import { modulMerkeziSayfasi } from './uygulamalar/modul';
import { uygulamaSayfalari } from './uygulamalar/uygulama';
import { dosyaYoneticisiSayfasi } from './dosyalar/dosyalar';
import { saglikOzetiSayfasi } from './saglik/ozet';
import { tahlilSayfasi } from './saglik/tahlil';
import { cihazSayfasi } from './saglik/cihaz';

/* Veriyle çalışan sayfalar; kaydı olmayan sekmeler kabukta yer tutucu gösterir. */
export const SAYFALAR: Record<string, (kok: HTMLElement) => void> = {
  genel: genelBakisSayfasi,
  'r-kisi': kisilerSayfasi,
  'r-sifre': sifrelerSayfasi,
  'r-iban': ibanSayfasi,
  sistem: sistemSayfasi,
  acil: acilKartSayfasi,
  'e-gmail': gmailFaturaSayfasi,
  'h-begen': begenilerSayfasi,
  'b-icra': icraBorclariSayfasi,
  'k-icra': icraBorclariSayfasi,
  'b-ozet': borcOzetiSayfasi,
  'g-ozet': gelirOzetiSayfasi,
  'e-ozet': giderOzetiSayfasi,
  ...FINANS_SAYFALARI,
  ...BIRIKIM_SAYFALARI,
  ...HEDEF_SAYFALARI,
  'a-ajanda': ajandaSayfasi,
  'k-ceza': davaSayfasi('ceza'),
  'k-hukuk': davaSayfasi('hukuk'),
  'k-cbs': davaSayfasi('cbs'),
  'k-sure': surelerSayfasi,
  'e-market': marketAlisverisiSayfasi,
  'm-karsi': karsilastirmaSayfasi,
  ...MARKET_SAYFALARI,
  'm-rapor': aylikRaporSayfasi,
  'm-plan': planlayiciSayfasi,
  'm-sim': simulasyonSayfasi,
  's-ozet': saglikOzetiSayfasi,
  's-tahlil': tahlilSayfasi,
  's-cihaz': cihazSayfasi,
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
  'app-dosya': dosyaYoneticisiSayfasi,
  'app-kutuphane': kutuphaneSayfasi,
};
