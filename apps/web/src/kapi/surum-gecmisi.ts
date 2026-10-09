/* Sürüm geçmişi: her yayında en üste yeni kayıt eklenir. Sistem Ayarları › Sürüm geçmişi ve güncellemeler bölümü bu listeyi gösterir.
   eklenenler: yeni özellikler · yapilanlar: değişiklik ve düzeltmeler. */
export type SurumKaydi = { surum: string; tarih: string; baslik: string; eklenenler: string[]; yapilanlar: string[] };

export const SURUM_GECMISI: SurumKaydi[] = [
  {
    surum: 'v15.6.0', tarih: '2026-10-09', baslik: 'Sürüm geçmişi, Strateji Matrisi, Genel Durum Raporu ve Rutinler',
    eklenenler: [
      'Sistem Ayarları › Sürüm geçmişi ve güncellemeler: her sürümün notları açılır kapanır biçimde listelenir',
      'Strateji Matrisi (Modül Merkezi): borçlar kurallara göre "hemen kapat", "pazarlık et", "taksiti tut" ve "banka" gruplarına ayrılır',
      'Genel Durum Raporu (Aylık Rapor sayfasından yazdırılır)',
      'Rutinler (Notlar menüsü): günlük, haftalık ve tek seferlik kontrol listeleri; günlük ve haftalık olanlar kendiliğinden sıfırlanır',
    ],
    yapilanlar: ['Sürüm numarası v15.6.0 oldu', 'Sürüm geçmişi koda kayıtlıdır; her yayında yeni kayıt eklenir'],
  },
  {
    surum: 'v15.5.0', tarih: '2026-10-09', baslik: 'Acil Durum Kartı, UYAP içe aktarma, danışman ve yeni sayfalar',
    eklenenler: [
      'Acil Durum Kartı (Sistem): ilk 72 saat adımları, kime ulaşılacağı, 30 gün içindeki süreler, ödemeler, açık icra dosyaları ve IBAN\'lar; tek sayfa yazdırılır',
      'UYAP içe aktarma (İcra): JSON özetini önizleyip onayla işler, "ne değişti" özeti gösterir; hiçbir kayıt silinmez',
      'İcra dosyasında haciz takibi ve anlaşılan ödeme planı (taksit takibi); geride kalan taksit bildirimi',
      'Ödeme Takvimi › Plan yükle: tecil ya da yapılandırma planını PDF veya metinden okur',
      'Danışman ve Sırada Ne Var: kural motoru bulguları ve önümüzdeki 30–60 günün eylem listesi',
      'Yapay Zekâ Danışman: dört rollü sohbet; finans özeti yalnız onayınla paylaşılır',
      'Getiri Motoru: faiz motoru, hesap makinesi ve banka oranları radarı',
      'Araç: kiralık paket takibi, senetle araç alımı, sahip olma maliyeti ve kiralamayla karşılaştırma',
      'Gmail Faturaları (Giderler): yalnız okuma izniyle fatura bulur, seçtiklerini gider olarak ekler',
      'Simülasyon: kritik yol, günlük faiz kanaması ve "Ne olursa" paneli',
    ],
    yapilanlar: [
      'İcra süresi 3 günden az kalınca bildirim üretilir', 'Eski sistemden taşınan veriler: acil durum kişileri, banka faiz oranları, hedefler, getiri motoru ve araç ayarları',
      'Veritabanı: icra_hacizler ve icra_planlari tabloları',
    ],
  },
  {
    surum: 'v15.4.0', tarih: '2026-10-08', baslik: 'İcra yazma yolu, Süreler ve İmza, sabit tarihler',
    eklenenler: [
      'İcra dosyası ekleme, düzenleme, silme ve geri alma; sırayla doğrulama sihirbazı',
      'Hukuk › Süreler ve İmza: sabit tarihler, karakol imza takvimi, süre sayacı, zamanaşımı ve denetim süresi',
      'Sabit tarihler ve imza günü ajandada ve bildirimlerde görünür',
    ],
    yapilanlar: ['Eski sistemden 6 sabit tarih, karakol imzası ve denetim süresi taşındı; ajandadaki yinelenen 5 tek seferlik olay kaldırıldı', 'Kişi borçları (4 kalem) ve ödemeleri eklendi'],
  },
  {
    surum: 'v15.3.0', tarih: '2026-10-08', baslik: 'Hukuk belgeleri ve tahlil değer geçmişi',
    eklenenler: ['Eski hukuk belgeleri Dosya Yöneticisi\'ne taşındı', 'Tahlillerde her değerin önceki sonuçlarıyla karşılaştırmalı geçmişi'],
    yapilanlar: [],
  },
  {
    surum: 'v15.2.0', tarih: '2026-10-07', baslik: 'Sağlık: tahlil, değer takibi ve cihaz senkronu',
    eklenenler: ['Tahlil yükleme ve değer takibi', 'Akıllı saat ve telefon sağlık verisi senkronizasyonu (anahtarlı uç)'],
    yapilanlar: ['Referans dışı tahlil değerleri için bildirim'],
  },
  {
    surum: 'v15.1.0', tarih: '2026-10-07', baslik: 'Dosya Yöneticisi',
    eklenenler: ['Klasörler, yükleme, önizleme, yeniden adlandırma, yıldız ve silme/geri alma; icra ve dava dosyalarına bağlı klasörler'],
    yapilanlar: [],
  },
  {
    surum: 'v15.0.1', tarih: '2026-10-07', baslik: 'Borç bitiş tarihi düzeltmesi',
    eklenenler: [],
    yapilanlar: ['Borç özetindeki "bitiş" tarihi artık yalnız açık borçların son bekleyen ödeme vadesinden hesaplanır'],
  },
  {
    surum: 'v15.0.0', tarih: '2026-10-01', baslik: 'Yeni bulut sürümü',
    eklenenler: ['Yalnız bulutta çalışan yeni yapı; PIN ile giriş, sunucuda şifrelenen hassas alanlar, gruplu menü ve Genel Bakış'],
    yapilanlar: [],
  },
];
