import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';

export type IcraDosyasi = {
  id: string;
  surum: number;
  oncelik: number | null;
  dosya_no: string | null;
  icra_dairesi: string | null;
  alacakli_id: string | null;
  avukat_id: string | null;
  taraf_rolu: string | null;
  takip_turu: string | null;
  takip_yolu: string | null;
  ozel_durum: string | null;
  durum: string | null;
  uyap_durum: string | null;
  karsi_taraf: string | null;
  ucuncu_sahislar: string[];
  son_islemler: string[];
  diger_haciz_sayisi: number | null;
  faiz_orani: number | null;
  gercek_asil_alacak: number | null;
  guncel_toplam_borc: number | null;
  faiz_tutari: number | null;
  vekalet_ucreti: number | null;
  masraf: number | null;
  vergi: number | null;
  tahsil_harci: number | null;
  toplam_alacak: number | null;
  yatan_para: number | null;
  tahsilat: number | null;
  reddiyat: number | null;
  acilis_tarihi: string | null;
  kapanis_tarihi: string | null;
  son_islem_tarihi: string | null;
  dogrulama_tarihi: string | null;
  tebligat_tarihi: string | null;
  uyap_tarihi: string | null;
};

/* Dosya durumu bakiyenin sayılıp sayılmayacağını belirler: kapalı, durdurulmuş, itiraz edilmiş, takipsiz,
   infaz edilmiş ya da iptal edilmiş dosyaların bakiyesi 0 kabul edilir (veritabanındaki icra_bakiye_gecerli ile aynı kural). */
const GECERSIZ_DURUM = /(durdur|itiraz|kapal|takipsiz|infaz|iptal)/;
export function bakiyeGecerliMi(d: Pick<IcraDosyasi, 'durum' | 'uyap_durum'>): boolean {
  const uyap = (d.uyap_durum ?? '').replace(/[İIı]/g, 'i').toLocaleLowerCase('tr');
  return d.durum !== 'kapandi' && !GECERSIZ_DURUM.test(uyap);
}
export const gecerliBakiye = (d: Pick<IcraDosyasi, 'durum' | 'uyap_durum' | 'guncel_toplam_borc'>) =>
  (bakiyeGecerliMi(d) ? (d.guncel_toplam_borc ?? 0) : 0);

/* Dosya numarası sunucuda çözülür; liste yalnız oturum sahibinin kayıtlarını döndürür. */
export async function icraDosyalariniGetir(): Promise<IcraDosyasi[]> {
  const { data, error } = await istemciAl().rpc('icra_dosyalari_listele');
  if (error) throw error;
  return (data ?? []) as IcraDosyasi[];
}

/* ——— Yazma: sunucu işlevleri (dosya numarası şifrelenir, bağlı borç kaydı birlikte yönetilir) ——— */
export type IcraAlanlari = Partial<{
  icra_dairesi: string | null; alacakli_id: string | null; avukat_id: string | null; oncelik: number | null; taraf_rolu: string | null;
  takip_turu: string | null; takip_yolu: string | null; ozel_durum: string | null; durum: 'acik' | 'kapandi'; uyap_durum: string | null;
  karsi_taraf: string | null; diger_haciz_sayisi: number | null; ucuncu_sahislar: string[]; son_islemler: string[]; faiz_orani: number | null;
  gercek_asil_alacak: number | null; guncel_toplam_borc: number | null; faiz_tutari: number | null; vekalet_ucreti: number | null; masraf: number | null;
  vergi: number | null; tahsil_harci: number | null; toplam_alacak: number | null; yatan_para: number | null; tahsilat: number | null; reddiyat: number | null;
  acilis_tarihi: string | null; kapanis_tarihi: string | null; son_islem_tarihi: string | null; dogrulama_tarihi: string | null;
  tebligat_tarihi: string | null; uyap_tarihi: string | null;
}>;

/* mevcut yoksa ekler; varsa yalnız gönderilen alanları, görülen sürüm hâlâ güncelse yazar (çakışırsa CakismaHatasi). */
export async function icraKaydet(mevcut: { id: string; surum: number } | null, dosyaNo: string | null, alanlar: IcraAlanlari): Promise<IcraDosyasi> {
  const { data, error } = await istemciAl().rpc('icra_kaydet', { p_id: mevcut?.id ?? null, p_surum: mevcut?.surum ?? null, p_dosya_no: dosyaNo, p_alanlar: alanlar });
  if (error) { if (error.code === '40001') throw new CakismaHatasi(); throw error; }
  return data as IcraDosyasi;
}
export async function icraSil(d: { id: string; surum: number }): Promise<void> {
  const { error } = await istemciAl().rpc('icra_sil', { p_id: d.id, p_surum: d.surum });
  if (error) { if (error.code === '40001') throw new CakismaHatasi(); throw error; }
}
export async function icraGeriAl(id: string): Promise<void> {
  const { error } = await istemciAl().rpc('icra_geri_al', { p_id: id });
  if (error) throw error;
}
