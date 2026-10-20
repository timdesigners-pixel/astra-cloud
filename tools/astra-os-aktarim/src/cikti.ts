/* TEK ÇIKTI KAPISI: `console.*` ve `process.stdout` yalnız bu dosyada kullanılır (katman testi tarar). Kabul edilen içerik:
   doğrulanmış `Rapor` (beyaz liste), süzülmüş `GuvenliHata`, `Ilerleme` (sayı/aşama). Serbest metin kabul edilmez.
   Son savunma: çıktı metninde IBAN biçimi bulunursa yazılmaz (SIZINTI_ENGELLENDI; hata metni değer içermez). */
import { closeSync, fchmodSync, openSync, writeFileSync } from 'node:fs';
import type { GuvenliHata } from './guvenlik/sir-koruma.ts';
import { raporJsonu, raporMetni } from './rapor/rapor-metni.ts';
import type { Rapor } from './rapor/rapor-sema.ts';

export type Ilerleme = { asama: 'okuma' | 'donusum' | 'plan' | 'yazma'; tamamlanan: number; toplam: number };

export class CiktiHatasi extends Error {
  kod = 'SIZINTI_ENGELLENDI' as const;

  constructor() {
    super('CIKTI_HATASI SIZINTI_ENGELLENDI');
    this.name = 'CiktiHatasi';
  }
}

/* `istem`: satır sonu olmayan sabit istem (yankısız PIN girişi için); verilmezse `satir` kullanılır. */
export type CiktiHedefi = { satir: (metin: string) => void; istem?: (metin: string) => void };

const IBAN_BICIMI = /[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){4,7}(?:\s?[A-Z0-9]{1,4})?/;
const varsayilanHedef: CiktiHedefi = {
  satir: (metin) => void process.stdout.write(`${metin}\n`),
  istem: (metin) => void process.stdout.write(metin),
};
let hedef: CiktiHedefi = varsayilanHedef;
let sessiz = false;

/* Testlerde çıktıyı yakalamak için; null varsayılana döner. */
export function ciktiHedefiAyarla(yeni: CiktiHedefi | null): void {
  hedef = yeni ?? varsayilanHedef;
}

export function sessizAyarla(deger: boolean): void {
  sessiz = deger;
}

function guvenliYaz(metin: string): void {
  if (IBAN_BICIMI.test(metin.replace(/\s+/g, ' '))) throw new CiktiHatasi();
  hedef.satir(metin);
}

export function raporYazdir(rapor: Rapor, json: boolean): void {
  if (sessiz) return;
  guvenliYaz(json ? raporJsonu(rapor) : raporMetni(rapor));
}

/* `--rapor <yol>`: yalnız doğrulanmış rapor JSON'u, yalnız sahibi okuyabilir (0600). */
export function raporDosyasiYaz(yol: string, rapor: Rapor): void {
  const metin = raporJsonu(rapor);
  if (IBAN_BICIMI.test(metin.replace(/\s+/g, ' '))) throw new CiktiHatasi();
  /* `mode` yalnız yeni dosyada geçerli: var olan (ör. 0644) dosyanın iznini de sıkılaştır.
     Yol yerine açık tanıtıcı (fd) üzerinden `fchmodSync`: yazmadan ÖNCE izin daraltılır, yol yarışı olmaz. */
  const fd = openSync(yol, 'w', 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeFileSync(fd, `${metin}\n`, { encoding: 'utf8' });
  } finally {
    closeSync(fd);
  }
}

export function hataYazdir(hata: GuvenliHata): void {
  guvenliYaz(`HATA kod=${hata.kod} durum=${hata.durum ?? '-'} tablo=${hata.tablo ?? '-'}`);
}

/* Komut olayı: tür + sabit kod + (ad → tamsayı | kısa kod/kimlik) alanları. Serbest metin ve boşluk içeren değer KABUL EDİLMEZ.
   Bu, komutların (yaz, dogrula, geri-al, yetim-tara, hata) tek yazma yoludur; kayıt değeri bu desenlerden geçemez. */
export type OlayTuru = 'BILGI' | 'UYARI' | 'HATA' | 'SONUC' | 'FARK';
export type OlayDegeri = number | string;
export type KomutOlayi = { tur: OlayTuru; kod: string; alanlar?: Readonly<Record<string, OlayDegeri>> };

const OLAY_KODU = /^[A-Z][A-Z0-9_]{2,47}$/;
const ALAN_ADI = /^[a-z][a-z0-9_]{0,39}$/;
/* Kısa kod/kimlik: onay kodu, UUID, tablo/uygulama adı, komut adı, dalga. Boşluk ve "/" yok (nokta yalnız şema yolu için). */
const ALAN_METNI = /^[A-Za-z0-9_.-]{1,64}$/;

export function olayYazdir(olay: KomutOlayi): void {
  if (sessiz && olay.tur === 'BILGI') return;
  if (!OLAY_KODU.test(olay.kod)) throw new CiktiHatasi();
  const parcalar: string[] = [olay.tur, olay.kod];
  for (const [ad, deger] of Object.entries(olay.alanlar ?? {})) {
    if (!ALAN_ADI.test(ad)) throw new CiktiHatasi();
    if (typeof deger === 'number') {
      if (!Number.isSafeInteger(deger)) throw new CiktiHatasi();
    } else if (!ALAN_METNI.test(deger)) {
      throw new CiktiHatasi();
    }
    parcalar.push(`${ad}=${deger}`);
  }
  guvenliYaz(parcalar.join(' '));
}

/* Yankısız PIN isteminin sabit metni (kullanıcıya yalnız ne beklendiğini söyler; değer içermez). */
export function pinIstemiYazdir(): void {
  (hedef.istem ?? hedef.satir)('PIN (gizli, ekranda gorunmez): ');
}

/* PIN girişi bitince imleci yeni satıra alır (boş satır; değer yok). */
export function istemiBitir(): void {
  hedef.satir('');
}

const YARDIM_SATIRLARI: readonly string[] = [
  'KULLANIM aktar <komut> [secenekler]',
  'KOMUT kuru-calistir   (varsayilan) girdiden plan ve rapor uretir; ag ve kimlik gerekmez, yalniz ASTRA_SUPABASE_URL',
  'KOMUT yaz             --onay ONAY-<dalga>-<12 hex> ile yazar (kod kuru-calistir ciktisindadir)',
  'KOMUT dogrula         kaynak ile hedef kontrol toplamlarini karsilastirir (fark varsa cikis kodu 1)',
  'KOMUT geri-al         --aktarim <uuid> veya --dalga a; kodsuz calisirsa yalniz sayim ve onay kodu verir',
  'KOMUT yetim-tara      eslesmesi olmayan aktarim satirlarini raporlar (--yetim-temizle onayli)',
  'KOMUT statik-yukle    --kaynak <yol> (varsayilan kuru: tarar, ONAY-statik-<12 hex> verir); --onay ile apps kovasina yukler (servis anahtari yalniz ortamdan)',
  'SECENEK --girdi <yol> --kaynak <yol> --dalga a|b|c --ilgi <yol> --rapor <yol> --onay <kod> --aktarim <uuid>',
  'SECENEK --uygulama-durumlarini-sil --yetim-temizle --baslangic <ISO zaman> --json --sessiz --yardim',
  'ORTAM ASTRA_SUPABASE_URL ASTRA_SUPABASE_ANON ASTRA_PIN ASTRA_SERVIS_ANAHTARI (yalniz ad; PIN ve anahtar argumanla verilmez; servis anahtari yalniz statik-yukle --onay)',
  'CIKIS 0 basarili, 1 dogrulama farki veya hata, 2 kullanim hatasi',
];

/* Yardım metni: sabit, değersiz. */
export function yardimYazdir(): void {
  for (const satir of YARDIM_SATIRLARI) hedef.satir(satir);
}

export function ilerlemeYazdir(i: Ilerleme): void {
  if (sessiz) return;
  guvenliYaz(`ILERLEME ${i.asama} ${Math.trunc(i.tamamlanan)}/${Math.trunc(i.toplam)}`);
}
