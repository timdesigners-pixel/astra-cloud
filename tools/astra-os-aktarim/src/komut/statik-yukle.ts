/* `statik-yukle --kaynak <yol> [--onay ONAY-statik-<12hex>]`: Oynatma Listelerim ve Pinterest Panolarım statik JSON'larını Storage `apps` kovasına yükler.
   VARSAYILAN kuru çalıştırmadır (ağ ve kimlik YOK): beyaz listeyi tarar, sayı/boyut/sha256 özeti ve onay kodu üretir.
   Yükleme yalnız doğru kodla: plan yeniden üretilip koda karşı doğrulanır; yanlış/boş kodda yükleyici fabrikası (servis anahtarı okuma dahil) HİÇ çağrılmaz.
   Mevcut nesne ezilmez (`upsert:false`); yüklenen her nesne genel adresten geri indirilip boyut + sha256 doğrulanır; ilk hatada durulur.
   Çıkış kodu 1: ilk hata ya da hedefte FARKLI içerikli nesne (ezilmez, elle incelenmeli). Servis rolü yalnız bu komutta ve yalnız Storage içindir (veritabanı çağrısı yok). Çıktı: yalnız sayı ve sabit kod. */
import { STATIK_AZAMI_BAYT, statikOnayDogrula, statikPlanOlustur, type StatikPlan } from '../donusum/statik-plan-hesap.ts';
import { ilerlemeYazdir, olayYazdir } from '../cikti.ts';
import { statikTara, type StatikTaramaSonucu } from '../girdi/statik-tara.ts';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { hataGuvenli, type GuvenliHata } from '../guvenlik/sir-koruma.ts';
import type { StatikYukleyiciFabrikasi } from '../yazici/statik-yukleyici.ts';
import { KomutHatasi } from './komut-hata.ts';

export type StatikYukleGirdisi = {
  kaynak: string;
  /* undefined → kuru çalıştırma; verilmişse (boş dahil) kodla karşılaştırılır. */
  onay: string | undefined;
  hedef: { anaMakine: string; kisa: string };
  aracSurumu: string;
  /* Enjekte edilebilir (testler gerçek dosya/ağ olmadan çalışır). */
  tara?: (kaynak: string) => StatikTaramaSonucu;
  yukleyiciKur?: StatikYukleyiciFabrikasi;
};

export type StatikYukleSonucu = {
  kuru: boolean;
  hedef_kisa: string;
  plan: StatikPlan;
  yoksayilan: number;
  yuklenen: number;
  yuklenen_bayt: number;
  dogrulanan: number;
  nesne_var: number;
  nesne_ayni: number;
  nesne_farkli: number;
  hata: GuvenliHata | null;
};

const YUKLEME_TABLOSU = 'storage_objects';

export async function statikYukle(g: StatikYukleGirdisi): Promise<StatikYukleSonucu> {
  const tarama = (g.tara ?? statikTara)(g.kaynak);
  const plan = statikPlanOlustur({ dosyalar: tarama.dosyalar.map((d) => d.bilgi), taramaSorunlari: tarama.sorunlar, anaMakine: g.hedef.anaMakine, aracSurumu: g.aracSurumu });
  const sonuc: StatikYukleSonucu = {
    kuru: g.onay === undefined, hedef_kisa: g.hedef.kisa, plan, yoksayilan: tarama.yoksayilan,
    yuklenen: 0, yuklenen_bayt: 0, dogrulanan: 0, nesne_var: 0, nesne_ayni: 0, nesne_farkli: 0, hata: null,
  };
  if (g.onay === undefined) return sonuc;

  /* KAPI: sorunlu plan ve uyuşmayan kod → yükleyici (ve servis anahtarı) hiç kurulmaz. */
  if (plan.sorunlar.length > 0) throw new KomutHatasi('STATIK_PLAN_SORUNLU');
  if (!statikOnayDogrula(plan, g.onay)) throw new KomutHatasi('ONAY_UYUSMADI');
  if (g.yukleyiciKur === undefined) throw new KomutHatasi('STATIK_YUKLEYICI_YOK');
  const yukleyici = g.yukleyiciKur();

  const okuyucular = new Map(tarama.dosyalar.map((d) => [d.bilgi.yol, d.oku]));
  let islenen = 0;
  try {
    for (const bilgi of plan.dosyalar) {
      islenen += 1;
      const oku = okuyucular.get(bilgi.yol);
      if (oku === undefined) throw new KomutHatasi('STATIK_DOSYA_DEGISTI');
      const bayt = oku();
      /* Onaydan sonra dosya değişmişse yüklenmez (onaylanan içerik = yüklenen içerik). */
      if (bayt.byteLength !== bilgi.boyut || sha256HexBayt(bayt) !== bilgi.sha256) throw new KomutHatasi('STATIK_DOSYA_DEGISTI');

      const durum = await yukleyici.yukle(bilgi.yol, bayt);
      const uzak = await yukleyici.dogrula(bilgi.yol);
      const esit = uzak.boyut === bilgi.boyut && uzak.sha256 === bilgi.sha256;
      if (durum === 'YUKLENDI') {
        if (!esit) throw new KomutHatasi('STATIK_DOGRULAMA_FARKI');
        sonuc.yuklenen += 1;
        sonuc.yuklenen_bayt += bilgi.boyut;
        sonuc.dogrulanan += 1;
      } else {
        /* Mevcut nesne: yazılmadı. İçerik aynıysa sorun yok; farklıysa uyarı (elle inceleme; araç ezmez). */
        sonuc.nesne_var += 1;
        if (esit) sonuc.nesne_ayni += 1;
        else sonuc.nesne_farkli += 1;
      }
      if (islenen % 10 === 0 || islenen === plan.dosyalar.length) ilerlemeYazdir({ asama: 'yazma', tamamlanan: islenen, toplam: plan.dosyalar.length });
    }
  } catch (e) {
    /* İlk hatada dur: süzülmüş hata + o ana kadarki sayılar. */
    sonuc.hata = hataGuvenli(e, YUKLEME_TABLOSU);
  }
  return sonuc;
}

/* Çıkış kodu: kuru çalıştırmada sorun varsa 1; yüklemede hata varsa 1; hedefte farklı içerikli nesne kaldıysa 1 (zincirli otomasyon eski içeriği başarı sanmasın). */
export function statikYukleCikisKodu(s: StatikYukleSonucu): 0 | 1 {
  if (s.hata !== null) return 1;
  if (s.nesne_farkli > 0) return 1;
  return s.kuru && s.plan.sorunlar.length > 0 ? 1 : 0;
}

/* Sonucu `cikti.ts` kapısından yazar: yalnız sayı ve kısa kodlar (dosya adı/yolu bile yazılmaz). */
export function statikYukleSonucuYazdir(s: StatikYukleSonucu): void {
  const p = s.plan;
  if (s.kuru) {
    olayYazdir({ tur: 'BILGI', kod: 'STATIK_KURU_CALISTIRMA', alanlar: { hedef: s.hedef_kisa, kova: p.kova } });
    for (const u of p.uygulamalar) {
      olayYazdir({ tur: 'SONUC', kod: 'STATIK_UYGULAMA', alanlar: { uygulama: u.uygulama, dosya: u.dosya, detay: u.detay, bayt: u.bayt, en_buyuk: u.en_buyuk } });
    }
    olayYazdir({ tur: 'SONUC', kod: 'STATIK_TOPLAM', alanlar: { dosya: p.toplam_dosya, bayt: p.toplam_bayt, en_buyuk: p.en_buyuk, sinir: STATIK_AZAMI_BAYT, ozet: p.ozet_sha256 } });
    olayYazdir({ tur: 'BILGI', kod: 'STATIK_YOKSAYILAN', alanlar: { sayi: s.yoksayilan } });
    for (const k of p.sorunlar) olayYazdir({ tur: 'UYARI', kod: 'STATIK_SORUN', alanlar: { neden: k.kod, sayi: k.sayi } });
    if (p.onay_kodu !== null) olayYazdir({ tur: 'SONUC', kod: 'ONAY_KODU', alanlar: { kod: p.onay_kodu } });
    else olayYazdir({ tur: 'UYARI', kod: 'ONAY_VERILMEDI', alanlar: { neden: p.sorunlar.length > 0 ? 'PLAN_SORUNLU' : 'DOSYA_YOK' } });
    return;
  }
  olayYazdir({ tur: 'SONUC', kod: s.hata === null ? 'STATIK_YUKLE_TAMAM' : 'STATIK_YUKLE_YARIM', alanlar: { hedef: s.hedef_kisa, kova: p.kova } });
  olayYazdir({ tur: 'SONUC', kod: 'STATIK_YUKLENEN', alanlar: { dosya: s.yuklenen, bayt: s.yuklenen_bayt, dogrulanan: s.dogrulanan, toplam: p.toplam_dosya } });
  olayYazdir({ tur: 'SONUC', kod: 'NESNE_VAR', alanlar: { sayi: s.nesne_var, ayni: s.nesne_ayni, farkli: s.nesne_farkli } });
  if (s.nesne_farkli > 0) olayYazdir({ tur: 'UYARI', kod: 'NESNE_FARKLI', alanlar: { sayi: s.nesne_farkli } });
  if (s.hata !== null) olayYazdir({ tur: 'HATA', kod: 'YUKLEME_DURDU', alanlar: { neden: s.hata.kod, durum: s.hata.durum ?? 0, tablo: s.hata.tablo ?? 'yok' } });
}
