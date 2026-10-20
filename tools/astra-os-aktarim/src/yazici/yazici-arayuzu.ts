/* Yazıcı arayüzü: aktarım aracının hedefe (Supabase) dokunan TEK sözleşmesi. Komutlar yalnız bu tipe bağlıdır;
   gerçek uygulama `supabase-yazici.ts`, test uygulaması `bellek-yazici.ts`. Değer içeren veri yalnız parametre olarak girer,
   hata nesnelerinde ASLA taşınmaz (YaziciHatasi yalnız kod/durum/tablo). */
import type { GuvenliHata } from '../guvenlik/sir-koruma.ts';
import type { Dalga } from '../plan/plan-tipleri.ts';

/* Dalga b/c için yazıcı yöntemleri henüz yoktur (T8/T10 dolduracak): ilgili çağrılar bu kodla reddedilir. */
export const DALGA_YAZICI_YOK = 'DALGA_YAZICI_YOK';

/* Eşleşme tablosundaki `kaynak` sütunu (plan §4.1). */
export const KAYNAK_ADI = 'astra-os';

export type YaziciHatasiKodu = string;

/* Yazıcı hatası: PostgREST `message/details/hint` bilerek TAŞINMAZ (kayıt değeri içerebilir); yalnız `hataGuvenli` çıktısı. */
export class YaziciHatasi extends Error {
  kod: YaziciHatasiKodu;
  durum: number | null;
  tablo: string | null;

  constructor(hata: GuvenliHata) {
    super(`YAZICI_HATASI kod=${hata.kod} durum=${hata.durum ?? '-'} tablo=${hata.tablo ?? '-'}`);
    this.name = 'YaziciHatasi';
    this.kod = hata.kod;
    this.durum = hata.durum;
    this.tablo = hata.tablo;
  }
}

export type EslesmeDurumu = 'yazildi' | 'sahiplenildi';

/* `aktarim_eslesme` satırı (okuma). Kayıt değeri içermez: yalnız opak kimlikler. */
export type EslesmeSatiri = {
  id: string;
  koleksiyon: string;
  kaynak_id: string;
  hedef_tablo: string;
  hedef_id: string | null;
  hedef_ref: string | null;
  aktarim_id: string;
  dalga: Dalga;
  silindi_at: string | null;
  ekstra: Record<string, unknown>;
};

export type EslesmeGirdisi = {
  koleksiyon: string;
  kaynak_id: string;
  hedef_tablo: string;
  hedef_id: string | null;
  hedef_ref: string | null;
  aktarim_id: string;
  dalga: Dalga;
  ekstra: { durum: EslesmeDurumu };
};

/* Güncellemede yalnız migration'ın update GRANT'indeki sütunlar. */
export type EslesmeGuncellemesi = Partial<Pick<EslesmeSatiri, 'hedef_id' | 'hedef_ref' | 'aktarim_id' | 'dalga' | 'silindi_at' | 'ekstra'>>;

export type EslesmeSorgusu = { aktarim_id?: string; dalga?: Dalga };

/* `begeniler` insert satırı (dalga a); sütunlar insert GRANT'ine uyar (0010, 0016). */
export type BegeniEkleSatiri = Record<string, unknown> & { kod: string };
export type EklenenSatir = { id: string; kod: string };
export type BegeniKaydi = { id: string; kod: string; olusturma: string | null };
export type BegeniFiyati = { id: string; fiyat: number | null };

export type EklemeTablosu = 'begeniler';

/* RPC adları: yalnız `uygulama_durumu_*` bu görevde canlıdır; diğerleri DALGA_YAZICI_YOK döndürür. */
export const CANLI_RPC_ADLARI = ['uygulama_durumu_oku', 'uygulama_durumu_yaz', 'uygulama_durumu_sil'] as const;
export const BEKLEYEN_RPC_ADLARI = ['iban_ekle', 'icra_kaydet', 'icra_sil', 'dava_kaydet', 'sifre_kaydet'] as const;
export type RpcAdi = (typeof CANLI_RPC_ADLARI)[number] | (typeof BEKLEYEN_RPC_ADLARI)[number];

export type YaziciYontemi =
  | 'eslesmeOku'
  | 'eslesmeEkle'
  | 'eslesmeGuncelle'
  | 'satirEkle'
  | 'satirGizle'
  | 'begeniKodlariOku'
  | 'begeniFiyatlariOku'
  | 'uygulamaAnahtarlariOku'
  | 'uygulamaDurumuYaz'
  | 'uygulamaDurumuSil'
  | 'rpcCagir'
  | 'kapat';

export type Yazici = {
  /* Aktarım eşleşmeleri (silinmişler DAHİL: tekil indeks kısmi değildir, canlandırma için gerekir). */
  eslesmeOku(sorgu?: EslesmeSorgusu): Promise<EslesmeSatiri[]>;
  eslesmeEkle(satirlar: readonly EslesmeGirdisi[]): Promise<void>;
  eslesmeGuncelle(id: string, degisiklik: EslesmeGuncellemesi): Promise<void>;

  /* Düz tabloya satır ekler (hedefteki mevcut satır ASLA güncellenmez). Dönen kimlikler `kod` ile eşlenir (sıra varsayılmaz). */
  satirEkle(tablo: EklemeTablosu, satirlar: readonly BegeniEkleSatiri[]): Promise<EklenenSatir[]>;
  /* Soft delete: `silindi_at` damgası; yalnız henüz silinmemiş satırlara. */
  satirGizle(tablo: EklemeTablosu, idler: readonly string[]): Promise<void>;
  begeniKodlariOku(): Promise<BegeniKaydi[]>;
  begeniFiyatlariOku(idler: readonly string[]): Promise<BegeniFiyati[]>;

  /* `uygulama_durumu`: yalnız anahtar ADLARI döner (değerler okunup atılır, saklanmaz). */
  uygulamaAnahtarlariOku(uygulama: string): Promise<string[]>;
  uygulamaDurumuYaz(uygulama: string, anahtar: string, deger: string): Promise<void>;
  uygulamaDurumuSil(uygulama: string, anahtar: string): Promise<void>;

  rpcCagir(ad: RpcAdi, parametre: Readonly<Record<string, unknown>>): Promise<unknown>;

  /* Oturum zamanlayıcılarını durdurur; sunucuda oturumu KAPATMAZ (uygulamadaki oturuma dokunmaz). */
  kapat(): Promise<void>;
};

/* Çalıştırma sırasında yazıcı oluşturmak için: ağ/kimlik gerektiren adım ancak onay doğrulandıktan sonra çağrılır. */
export type YaziciFabrikasi = () => Promise<Yazici>;
