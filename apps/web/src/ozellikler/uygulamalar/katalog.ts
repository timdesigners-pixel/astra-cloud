export type Uygulama = {
  kod: string; sekme: string; ad: string; yol?: string; not: string; izin?: string; asgariBoy?: number;
};

export const UYGULAMALAR: Uygulama[] = [
  { kod: 'odeme', sekme: 'app-odeme', ad: 'Ödeme Raporu', yol: 'apps/odeme-raporu/index.html', izin: 'clipboard-write *',
    not: 'Sürükle-taşı ödeme kartları, kısmi ödeme, to-do, karar diyagramı, bütçe simülasyonu ve rapor.' },
  { kod: 'hesapyon', sekme: 'app-hesapyon', ad: 'Hesap Yöneticisi', yol: 'apps/hesap-yoneticisi/index.html', izin: 'clipboard-write *; clipboard-read *',
    not: 'Platformlar, güncel giriş adresleri ve kayıtlı hesaplar. Kayıtlar şifreli saklanır.' },
  { kod: 'bahis', sekme: 'app-bahis', ad: 'Bahis Dünyası', yol: 'apps/bahis-dunyasi/index.html', asgariBoy: 940,
    not: 'Bahis siteleri, yatırım/çekim, bonuslar, favori oyunlar ve hesap kayıtları.' },
  { kod: 'marketliste', sekme: 'app-marketliste', ad: 'Market Listesi', yol: 'apps/market-listesi/index.html', izin: 'geolocation *',
    not: 'Alışveriş listesi; yakındaki marketlerde en uygun fiyat (market fiyat servisi bağlanınca).' },
  { kod: 'karsilama', sekme: 'app-karsilama', ad: 'Günlük Karşılama', yol: 'apps/gunluk-karsilama/index.html',
    not: 'Hava, döviz, görevler, saatlik ajanda, sağlık ve bütçe panosu.' },
  { kod: 'ilgi', sekme: 'app-ilgi', ad: 'İlgi Çekici Ürünler', yol: 'apps/ilgi-urunler/index.html',
    not: 'Takip edilen ürünler. Katalog şimdilik eski projeden okunur.' },
  { kod: 'tasarim', sekme: 'app-tasarim', ad: 'Tasarım Atölyesi', yol: 'apps/tasarim-atolyesi/index.html', izin: 'clipboard-write *',
    not: 'Tasarım görsellerini HTML + Tailwind bileşenlerine dönüştüren atölye (Gemini servisi bağlanınca).' },
  { kod: 'dosya', sekme: 'app-dosya', ad: 'Dosya Yöneticisi', yol: 'apps/dosya-yoneticisi/index.html',
    not: 'Bulut dosyalarında ve bu bilgisayardaki klasörlerde gezinme, önizleme. Dosyalar şimdilik eski projeden gelir.' },
  { kod: 'telrehber', sekme: 'app-telrehber', ad: 'Telefon Rehberi', yol: 'apps/telefon-rehberi/index.html',
    not: 'Model, fiyat ve özellik karşılaştırmalı telefon alım rehberi.' },
  { kod: 'kutuphane', sekme: 'app-kutuphane', ad: 'Bilgi Kütüphanesi',
    not: 'AI notları, projeler, ilham panosu ve Recall Center. Sonraki fazda yeniden yazılacak.' },
  { kod: 'oynatma', sekme: 'app-oynatma', ad: 'Oynatma Listelerim', yol: 'apps/oynatma-listelerim/index.html',
    not: 'YouTube oynatma listeleri arşivi. Liste verisi şimdilik eski projeden gelir.' },
  { kod: 'pinterest', sekme: 'app-pinterest', ad: 'Pinterest Panolarım', yol: 'apps/pinterest-panolarim/index.html',
    not: 'Pinterest pano ve pin arşivi. Pin verisi şimdilik eski projeden gelir.' },
];

export const uygulamaBul = (sekme: string) => UYGULAMALAR.find(u => u.sekme === sekme);
