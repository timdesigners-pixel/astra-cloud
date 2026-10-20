/* Komut satırı ayrıştırma. SAF: ortam/dosya/ağ yok. Yalnız argüman: girdi yolu başka kaynaktan (ortam, stdin) ALINMAZ.
   Hata mesajlarında bayrak adı/değeri YANKILANMAZ (yanlışlıkla yapıştırılmış sır çıktıya geçmesin); yalnız sabit kod döner. */
import { DALGALAR, type Dalga } from '../plan/plan-tipleri.ts';
import { KullanimHatasi, type KullanimHataKodu } from './komut-hata.ts';

export const KOMUTLAR = ['kuru-calistir', 'yaz', 'dogrula', 'geri-al', 'yetim-tara', 'statik-yukle', 'yardim'] as const;
export type KomutAdi = (typeof KOMUTLAR)[number];

export type Secenekler = {
  girdi: string | undefined;
  /* statik-yukle: eski repo kökü ya da public/apps yolu (yalnız argüman). */
  kaynak: string | undefined;
  kova: string | undefined;
  dalga: Dalga | undefined;
  /* undefined: bayrak yok; '': bayrak var ama değer yok (ikisi de yazmayı engeller) */
  onay: string | undefined;
  ilgi: string | undefined;
  rapor: string | undefined;
  aktarim: string | undefined;
  baslangic: string | undefined;
  uygulamaDurumlariniSil: boolean;
  yetimTemizle: boolean;
  json: boolean;
  sessiz: boolean;
};

export type ArgumanSonucu = { komut: KomutAdi; secenek: Secenekler };

const DEGERLI = { '--girdi': 'girdi', '--kaynak': 'kaynak', '--kova': 'kova', '--dalga': 'dalga', '--ilgi': 'ilgi', '--rapor': 'rapor', '--aktarim': 'aktarim', '--baslangic': 'baslangic' } as const;
const MANTIKSAL = { '--uygulama-durumlarini-sil': 'uygulamaDurumlariniSil', '--yetim-temizle': 'yetimTemizle', '--json': 'json', '--sessiz': 'sessiz' } as const;
/* Sır taşıyabilecek bayraklar: asla kabul edilmez (süreç listesinde görünür). */
const YASAK_ONEK = ['--pin', '--parola', '--password', '--sifre', '--token', '--anahtar', '--key'] as const;
const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function hata(kod: KullanimHataKodu): never {
  throw new KullanimHatasi(kod);
}

export function argumanAyristir(argv: readonly string[]): ArgumanSonucu {
  const s: Secenekler = {
    girdi: undefined, kaynak: undefined, kova: undefined, dalga: undefined, onay: undefined, ilgi: undefined, rapor: undefined, aktarim: undefined, baslangic: undefined,
    uygulamaDurumlariniSil: false, yetimTemizle: false, json: false, sessiz: false,
  };
  /* Argümansız çağrı yardım gösterir (varsayılan komut kuru-calistir ise ancak bayrak verildiğinde devreye girer). */
  if (argv.length === 0) return { komut: 'yardim', secenek: s };
  let komut: KomutAdi = 'kuru-calistir';
  let i = 0;
  if (argv.length > 0 && !argv[0]!.startsWith('-')) {
    if (!(KOMUTLAR as readonly string[]).includes(argv[0]!)) hata('KOMUT_BILINMIYOR');
    komut = argv[0] as KomutAdi;
    i = 1;
  }

  const deger: Record<string, string | undefined> = {};
  for (; i < argv.length; i++) {
    const ham = argv[i]!;
    if (ham === '--yardim' || ham === '-h') return { komut: 'yardim', secenek: s };
    const esit = ham.indexOf('=');
    const ad = esit > 0 ? ham.slice(0, esit) : ham;
    const satirIci = esit > 0 ? ham.slice(esit + 1) : undefined;
    if (YASAK_ONEK.some((o) => ad.toLowerCase().startsWith(o))) hata('PIN_ARGUMANI_YASAK');

    if (ad === '--onay') {
      /* Değer verilmezse '' olur → onay uyuşmaz → hiçbir yazma yapılmaz. */
      const sonraki = argv[i + 1];
      if (satirIci !== undefined) s.onay = satirIci;
      else if (sonraki !== undefined && !sonraki.startsWith('--')) {
        s.onay = sonraki;
        i++;
      } else s.onay = '';
      continue;
    }
    if (Object.hasOwn(MANTIKSAL, ad)) {
      s[MANTIKSAL[ad as keyof typeof MANTIKSAL]] = true;
      continue;
    }
    if (Object.hasOwn(DEGERLI, ad)) {
      let v = satirIci;
      if (v === undefined) {
        const sonraki = argv[i + 1];
        if (sonraki === undefined || sonraki.startsWith('--')) hata('BAYRAK_DEGERI_YOK');
        v = sonraki;
        i++;
      }
      deger[DEGERLI[ad as keyof typeof DEGERLI]] = v;
      continue;
    }
    hata('BAYRAK_BILINMIYOR');
  }

  s.girdi = deger.girdi;
  s.kaynak = deger.kaynak;
  s.kova = deger.kova;
  s.ilgi = deger.ilgi;
  s.rapor = deger.rapor;
  s.aktarim = deger.aktarim;
  s.baslangic = deger.baslangic;
  if (deger.dalga !== undefined) {
    if (!(DALGALAR as readonly string[]).includes(deger.dalga)) hata('DALGA_GECERSIZ');
    s.dalga = deger.dalga as Dalga;
  }
  if (s.aktarim !== undefined && !UUID_DESENI.test(s.aktarim)) hata('AKTARIM_GECERSIZ');
  if (s.baslangic !== undefined && Number.isNaN(Date.parse(s.baslangic))) hata('BASLANGIC_GECERSIZ');

  /* Komuta özgü zorunlu seçenekler. */
  if (komut === 'kuru-calistir' || komut === 'yaz' || komut === 'dogrula') {
    if (s.dalga === undefined) hata('DALGA_GEREKLI');
    if (s.girdi === undefined || s.girdi.trim() === '') hata('GIRDI_GEREKLI');
  }
  if (komut === 'statik-yukle') {
    /* Kapsam dışı istekler nedeniyle reddedilir (sessizce yok sayılmaz): `dosyalar` kovası kopyası ve `ilgi` (H-4: menüden kaldırıldı). */
    if (s.kova !== undefined && s.kova !== 'apps') hata(s.kova === 'dosyalar' ? 'KAPSAM_DISI_DOSYALAR_KOVASI' : 'KOVA_GECERSIZ');
    if (s.ilgi !== undefined) hata('KAPSAM_DISI_ILGI');
    if (s.kaynak === undefined || s.kaynak.trim() === '') hata('KAYNAK_GEREKLI');
  }
  if (komut === 'geri-al' && s.aktarim === undefined && s.dalga === undefined) hata('AKTARIM_GEREKLI');
  if (komut === 'yetim-tara' && s.yetimTemizle && s.baslangic === undefined) hata('BASLANGIC_GEREKLI');
  return { komut, secenek: s };
}
