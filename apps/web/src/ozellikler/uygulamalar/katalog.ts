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
    not: 'Alışveriş listesi; yakındaki marketlerde en uygun fiyat.' },
  { kod: 'karsilama', sekme: 'app-karsilama', ad: 'Günlük Karşılama', yol: 'apps/gunluk-karsilama/index.html',
    not: 'Hava, döviz, görevler, saatlik ajanda, sağlık ve bütçe panosu.' },
  { kod: 'ilgi', sekme: 'app-ilgi', ad: 'İlgi Çekici Ürünler', yol: 'apps/ilgi-urunler/index.html',
    not: 'Takip edilen ürünler. Aynı ürünler ve veriler artık Hayaller ve Hedefler › Beğendiğim Ürünler sayfasında; burası eski görünümdür.' },
  { kod: 'tasarim', sekme: 'app-tasarim', ad: 'Tasarım Atölyesi', yol: 'apps/tasarim-atolyesi/index.html', izin: 'clipboard-write *',
    not: 'Tasarım görsellerini HTML + Tailwind bileşenlerine dönüştüren atölye.' },
  { kod: 'dosya', sekme: 'app-dosya', ad: 'Dosya Yöneticisi', yol: 'apps/dosya-yoneticisi/index.html',
    not: 'Belgelerin klasörlerde saklandığı özel bulut; dava ve icra dosyalarına bağlanır. Eski arşiv ve bu bilgisayardaki klasörler de açılabilir.' },
  { kod: 'telrehber', sekme: 'app-telrehber', ad: 'Telefon Rehberi', yol: 'apps/telefon-rehberi/index.html',
    not: 'Model, fiyat ve özellik karşılaştırmalı telefon alım rehberi.' },
  { kod: 'kutuphane', sekme: 'app-kutuphane', ad: 'Bilgi Kütüphanesi',
    not: 'AI notları, projeler, ilham ve Recall Center; Zihin Sarayı ile aynı blok düzenleyici.' },
  { kod: 'oynatma', sekme: 'app-oynatma', ad: 'Oynatma Listelerim', yol: 'apps/oynatma-listelerim/index.html',
    not: 'YouTube oynatma listeleri arşivi.' },
  { kod: 'pinterest', sekme: 'app-pinterest', ad: 'Pinterest Panolarım', yol: 'apps/pinterest-panolarim/index.html',
    not: 'Pinterest pano ve pin arşivi.' },
];

export const uygulamaBul = (sekme: string) => UYGULAMALAR.find(u => u.sekme === sekme);
