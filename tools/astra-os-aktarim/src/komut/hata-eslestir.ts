/* Her hata türünü SABİT kodlu, değersiz bir olaya çevirir. Hata mesajları (`message`) hiç okunmaz: yalnız türün kod alanları kullanılır.
   Tanınmayan hata → BEKLENMEYEN_HATA (ayrıntı atılır; mesajı kayıt değeri taşıyabilir). */
import { AyarHatasi } from '../ayar.ts';
import { CiktiHatasi, olayYazdir, type KomutOlayi } from '../cikti.ts';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { PlanHatasi } from '../plan/plan-tipleri.ts';
import { RaporHatasi } from '../rapor/rapor-sema.ts';
import { EslesmeHatasi } from '../yazici/eslesme.ts';
import { OturumHatasi } from '../yazici/oturum.ts';
import { YaziciHatasi } from '../yazici/yazici-arayuzu.ts';
import { KomutHatasi, KullanimHatasi } from './komut-hata.ts';

export type HataSonucu = { olay: KomutOlayi; cikis: 1 | 2 };

export function hataSonucuKur(e: unknown): HataSonucu {
  if (e instanceof KullanimHatasi) return { olay: { tur: 'HATA', kod: 'KULLANIM_HATASI', alanlar: { neden: e.kod } }, cikis: 2 };
  if (e instanceof KomutHatasi) return { olay: { tur: 'HATA', kod: e.kod, alanlar: e.alanlar }, cikis: e.cikis };
  if (e instanceof AyarHatasi) return { olay: { tur: 'HATA', kod: 'AYAR_HATASI', alanlar: { neden: e.kod, degisken: e.degisken ?? 'yok' } }, cikis: 2 };
  if (e instanceof GirdiHatasi) {
    const alanlar: Record<string, string | number> = { neden: e.kod };
    if (e.yol !== null) alanlar.yol = e.yol;
    if (e.sayi !== null) alanlar.sayi = e.sayi;
    return { olay: { tur: 'HATA', kod: 'GIRDI_HATASI', alanlar }, cikis: e.kod === 'GIRDI_YOLU_YOK' ? 2 : 1 };
  }
  if (e instanceof PlanHatasi) return { olay: { tur: 'HATA', kod: 'PLAN_HATASI', alanlar: { neden: e.kod } }, cikis: 1 };
  if (e instanceof RaporHatasi) return { olay: { tur: 'HATA', kod: 'RAPOR_SEMA_GECERSIZ', alanlar: { yol: e.yol } }, cikis: 1 };
  if (e instanceof OturumHatasi) {
    const alanlar: Record<string, string | number> = { neden: e.kod };
    if (e.kalan !== null) alanlar.kalan = e.kalan;
    return { olay: { tur: 'HATA', kod: 'OTURUM_HATASI', alanlar }, cikis: 1 };
  }
  if (e instanceof YaziciHatasi) return { olay: { tur: 'HATA', kod: 'YAZICI_HATASI', alanlar: { neden: e.kod, durum: e.durum ?? 0, tablo: e.tablo ?? 'yok' } }, cikis: 1 };
  if (e instanceof EslesmeHatasi) return { olay: { tur: 'HATA', kod: 'ESLESME_HATASI', alanlar: { neden: e.kod } }, cikis: 1 };
  if (e instanceof CiktiHatasi) return { olay: { tur: 'HATA', kod: e.kod }, cikis: 1 };
  return { olay: { tur: 'HATA', kod: 'BEKLENMEYEN_HATA' }, cikis: 1 };
}

/* Hatayı yazdırır, çıkış kodunu döndürür. Olayın kendisi desen denetimini geçemezse en kötü ihtimalle sabit bir kod yazılır. */
export function hataYazdirVeCikisAl(e: unknown): 1 | 2 {
  const { olay, cikis } = hataSonucuKur(e);
  try {
    olayYazdir(olay);
  } catch {
    /* Desen/sızıntı kapısı reddetti: değersiz sabit olay yazılır. */
    olayYazdir({ tur: 'HATA', kod: 'BEKLENMEYEN_HATA' });
  }
  return cikis;
}
