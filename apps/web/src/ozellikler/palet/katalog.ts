/* Komut paleti · sabit komutlar. Yalnız üstveri: ad, açıklama, anahtar sözcükler, simge.
   Sayfalar kabuk/sekmeler.ts'ten okunur; menüye eklenen sayfa palete kendiliğinden düşer.
   k: doğal dil anahtar sözcükleri (eşanlamlılar ve yaygın yazımlar). */
import type { Komut } from './eslestir';

type Taslak = Omit<Komut, 'tur'>;

export const ISLEMLER: Taslak[] = [
  { id: 'yedek', sim: '⤓', ad: 'Veri yedeği al', ac: 'Bütün kayıtları tek JSON dosyası olarak indirir. Şifre, IBAN ve dosya numaraları yedeğe girmez.',
    k: 'yedek yedekle backup kaydet indir dışa aktar sakla arşiv koru verilerimi' },
  { id: 'kur', sim: '$', ad: 'Döviz kurunu güncelle', ac: 'Dolar, euro ve gram altın değerini şimdi yeniden çeker.', k: 'kur döviz dolar euro usd güncelle yenile altın gram' },
  { id: 'su-250', sim: '💧', ad: '+250 ml su içtim', ac: 'Bugünkü su sayacına 250 ml ekler.', k: 'su içtim bardak sağlık' },
  { id: 'gorev-yeni', sim: '✓', ad: 'Yeni görev ekle', ac: 'Başlığı sorup Todo\'s listesine ekler.', k: 'görev yapılacak todo ekle yeni iş' },
  { id: 'not-yeni', sim: '✎', ad: 'Hızlı not ekle', ac: 'Metni sorup Genel Bakış\'taki hızlı notlara ekler.', k: 'not yaz hızlı karma defter hatırla' },
  { id: 'odeme-yeni', sim: '₺', ad: 'Yeni ödeme ekle', ac: 'Ödeme Takvimi\'ni açar; oradan ödeme ya da taksit planı eklenir.', k: 'ödeme ekle taksit borç öde yeni vade' },
  { id: 'kisi-yeni', sim: '⇄', ad: 'Yeni kişi ekle', ac: 'Rehber › Kişiler ve Kurumlar sayfasını açar.', k: 'kişi ekle yeni rehber kurum' },
  { id: 'ajanda-yeni', sim: '▦', ad: 'Ajandaya kayıt ekle', ac: 'Ajanda sayfasını açar; duruşma, randevu ve hatırlatıcı oradan eklenir.', k: 'ajanda randevu duruşma takvim hatırlatıcı ekle' },
  { id: 'yazdir', sim: '⎙', ad: 'Sayfayı yazdır / PDF kaydet', ac: 'Açık sayfayı yazdırma penceresinde açar; oradan PDF olarak kaydedilir.', k: 'yazdır pdf kaydet çıktı rapor print' },
  { id: 'yenile', sim: '⟳', ad: 'Verileri yenile', ac: 'Açık sayfayı ve üst şeridi bulutten yeniden okur.', k: 'yenile tazele güncelle yeniden oku veri' },
  { id: 'kilit', sim: '🔒', ad: 'Oturumu kilitle', ac: 'Uygulamayı kilitler; devam etmek için PIN yeniden istenir.', k: 'kilitle kilit çıkış oturum kapat güvenlik' },
];

export const AYARLAR: Taslak[] = [
  { id: 'tema-koyu', sim: '☾', ad: 'Tema: koyu', ac: 'Uygulamayı koyu renklere geçirir.', k: 'tema koyu karanlık gece dark' },
  { id: 'tema-acik', sim: '☀', ad: 'Tema: açık', ac: 'Uygulamayı açık renklere geçirir.', k: 'tema açık aydınlık gündüz light beyaz' },
  { id: 'tema-sistem', sim: '◐', ad: 'Tema: sistemi izle', ac: 'Cihazın ayarına göre koyu ya da açık olur.', k: 'tema sistem otomatik' },
  { id: 'gizlilik', sim: '◌', ad: 'Gizlilik modunu aç / kapat', ac: 'Tutarları bulanıklaştırır; ekran paylaşırken işe yarar.', k: 'gizlilik gizle tutar sakla privacy maske' },
  { id: 'bildirim', sim: '◔', ad: 'Bildirim Merkezi\'ni aç', ac: 'Ödeme, duruşma, görev ve bütçe uyarılarını gösterir.', k: 'bildirim uyarı zil hatırlatma' },
  { id: 'bugun', sim: '●', ad: 'Bu aya dön', ac: 'Dönemi içinde bulunduğun aya getirir.', k: 'bugün bu ay şimdi dönem' },
  { id: 'onceki-ay', sim: '‹', ad: 'Önceki aya geç', ac: 'Dönemi bir ay geri alır.', k: 'önceki geçen ay dönem geri' },
  { id: 'sonraki-ay', sim: '›', ad: 'Sonraki aya geç', ac: 'Dönemi bir ay ileri alır.', k: 'sonraki gelecek ay dönem ileri' },
  { id: 'kisayol', sim: '?', ad: 'Klavye kısayollarını göster', ac: 'Bütün kısayolların listesini açar.', k: 'klavye kısayol tuş yardım' },
  { id: 'menu-tur', sim: '☰', ad: 'Menü türünü değiştir', ac: 'Gruplu menü ile düz menü arasında geçiş yapar.', k: 'menü düz gruplu liste görünüm' },
];

/* Boş paletin "önerilen" listesi. */
export const ONERILEN = ['yedek', 'su-250', 'gorev-yeni', 'not-yeni', 'kur', 'bildirim'];
