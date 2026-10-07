import { istemciAl } from './istemci';

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

/* Dosya numarası sunucuda çözülür; liste yalnız oturum sahibinin kayıtlarını döndürür. */
export async function icraDosyalariniGetir(): Promise<IcraDosyasi[]> {
  const { data, error } = await istemciAl().rpc('icra_dosyalari_listele');
  if (error) throw error;
  return (data ?? []) as IcraDosyasi[];
}
