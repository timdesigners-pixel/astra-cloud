/* Komut satırı girişi: yalnız argüman ayrıştırma ve yönlendirme; iş mantığı `komut/`, `plan/`, `yazici/` içindedir.
   Çıktı YALNIZ `cikti.ts` kapısından (bu dosyada `console.`/`process.stdout` yok). Çıkış kodları: 0 başarılı, 1 doğrulama farkı/hata, 2 kullanım hatası. */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarOku, hedefOku } from './ayar.ts';
import { sessizAyarla, yardimYazdir } from './cikti.ts';
import { ARAC_SURUMU } from './surum.ts';
import { argumanAyristir } from './komut/arguman-hesap.ts';
import type { Bagimlilik } from './komut/bagimlilik.ts';
import { dogrula, dogrulaSonucuYazdir } from './komut/dogrula.ts';
import { geriAl, geriAlSonucuYazdir } from './komut/geri-al.ts';
import { hataYazdirVeCikisAl } from './komut/hata-eslestir.ts';
import { KullanimHatasi } from './komut/komut-hata.ts';
import { kuruCalistir } from './komut/kuru-calistir.ts';
import { pinIste } from './komut/pin-iste.ts';
import { planKur } from './komut/plan-kur.ts';
import { statikYukle } from './komut/statik-yukle.ts';
import { yetimTara, yetimTaraSonucuYazdir } from './komut/yetim-tara.ts';
import { yaz, yazSonucuYazdir } from './komut/yaz.ts';
import { hedefRefKur } from './plan/plan-olustur-hesap.ts';
import { OturumHatasi } from './yazici/oturum.ts';
import { supabaseYaziciAc } from './yazici/supabase-yazici.ts';

/* Gerçek bağımlılıklar: ayar → PIN (ortam değişkeni ya da TTY istemi) → TEK denemeli oturum → yazıcı. */
export function varsayilanBagimlilik(): Bagimlilik {
  return {
    yaziciKur: async () => {
      const ayar = ayarOku();
      const pin = ayar.pin ?? (await pinIste());
      if (pin === null) throw new OturumHatasi('PIN_YOK');
      return supabaseYaziciAc(ayar, pin);
    },
    aracSurumu: ARAC_SURUMU,
    simdi: () => new Date(),
    uuidUret: () => randomUUID(),
  };
}

export async function calistir(argv: readonly string[], bag: Bagimlilik): Promise<number> {
  try {
    const { komut, secenek: s } = argumanAyristir(argv);
    sessizAyarla(s.sessiz);
    if (komut === 'yardim') {
      yardimYazdir();
      return 0;
    }
    if (komut === 'statik-yukle') statikYukle();

    const hedef = hedefOku(bag.ortam);
    const hedefRef = hedefRefKur(hedef.anaMakine);
    const planGirdisi = () => {
      /* argumanAyristir bu komutlar için girdi ve dalga'yı zorunlu kılar. */
      if (s.girdi === undefined || s.dalga === undefined) throw new KullanimHatasi('GIRDI_GEREKLI');
      return { girdi: s.girdi, ilgi: s.ilgi, dalga: s.dalga, anaMakine: hedef.anaMakine, aracSurumu: bag.aracSurumu, kaynak: bag.planKaynagi };
    };

    switch (komut) {
      case 'kuru-calistir': {
        const g = planGirdisi();
        kuruCalistir({ ...g, rapor: s.rapor, json: s.json, hedef, aracSurumu: bag.aracSurumu });
        return 0;
      }
      case 'yaz': {
        const plan = planKur(planGirdisi());
        const sonuc = await yaz({ plan, onay: s.onay ?? '', yaziciKur: bag.yaziciKur, aktarimId: bag.uuidUret() });
        yazSonucuYazdir(sonuc);
        return sonuc.hata === null ? 0 : 1;
      }
      case 'dogrula': {
        const plan = planKur(planGirdisi());
        const sonuc = await dogrula({ plan, yaziciKur: bag.yaziciKur });
        dogrulaSonucuYazdir(sonuc);
        return sonuc.farklar.length === 0 ? 0 : 1;
      }
      case 'geri-al': {
        const sonuc = await geriAl({
          aktarim: s.aktarim, dalga: s.dalga, uygulamaDurumlariniSil: s.uygulamaDurumlariniSil, onay: s.onay, hedefRef, yaziciKur: bag.yaziciKur, simdi: bag.simdi,
        });
        geriAlSonucuYazdir(sonuc);
        return sonuc.hata === null ? 0 : 1;
      }
      case 'yetim-tara': {
        const sonuc = await yetimTara({ baslangic: s.baslangic, temizle: s.yetimTemizle, onay: s.onay, hedefRef, yaziciKur: bag.yaziciKur });
        yetimTaraSonucuYazdir(sonuc, s.yetimTemizle);
        return sonuc.hata === null ? 0 : 1;
      }
    }
  } catch (e) {
    /* Kullanım hatasında (bilinmeyen komut/bayrak) yardım metni de gösterilir; hata her durumda kodla yazılır. */
    const cikis = hataYazdirVeCikisAl(e);
    if (e instanceof KullanimHatasi) yardimYazdir();
    return cikis;
  }
}

/* Doğrudan çalıştırıldığında (import edilince değil) ana akış başlar. */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await calistir(process.argv.slice(2), varsayilanBagimlilik());
}
