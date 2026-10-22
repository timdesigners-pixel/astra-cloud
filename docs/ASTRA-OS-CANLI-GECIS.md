# Astra OS → Astra Cloud / Mind Palace

Bu değişiklik GitHub `main` dalındaki v15.8.1 aktarım aracını korur. Yeni tarayıcı ekranı finans/hukuk ve kütüphane paketini mevcut uygulama tablolarına aktarır. CLI `dalga a` / statik yükleme akışları değişmez; CLI'nin henüz desteklemediği b/c yazma bayrakları açıkmış gibi gösterilmez.

## Özel paket üretimi

```sh
node tools/build-astra-package.mjs /path/to/astra-os /private/path/astra-os-transfer.json
```

Paket depo dışında tutulur. Tohum dosyaları ve Pinterest/YouTube arşivlerinden üretilir; açık tarayıcıdaki güncel kasa değildir. Özel veriler kaynak koda, Release dosyalarına veya web derlemesine konmaz.

22 Ekim 2026 kaynak incelemesi: 1.798 Pinterest pini, 2.409 YouTube kaydı, 78 finans/hukuk kaydı. Kaynağın 6 dava kaydında dosya numarası yoktur; 2 yabancı para geliri kur varsayımı yapılmadan doğrudan finans tablolarına eklenmez. Bu kayıtlar ve diğer tarihsel tohumlar, başarılı bulut aktarımında sahibine özel şifreli `eskiarsiv` uygulama durumunda korunur. Aynı icra borcunu iki kez saymamak için `D_ICRA` tutarları ayrı borç olarak eklenmez; `LEGAL_SEED` dosyaları mevcut `icra_kaydet` işleviyle bağlı borç oluşturur. Depoda Instagram kaydedilenler veya kullanıcı belge baytları bulunmadı.

## Canlı geçiş sırası

1. Mevcut bulut verisini yedekleyin.
2. Yetkili Supabase bağlantısıyla önce yayımlanmış `0027_aktarim_eslesme.sql`, ardından `0028_astra_os_aktarim.sql` göçlerini uygulayın. Yeni işlev yalnız `authenticated` rolüne açıktır. Hizmet anahtarı tarayıcıya verilmez.
3. Uygulamayı yayınlayın. PIN ile giriş yapın; Sistem Ayarları → Astra OS canlı veri aktarımı.
4. Özel paketi seçin, “Sunucuda önizle” basın. Çakışma varsa eski kayıtlar değiştirilmez; canlı yazma açılmaz.
5. “Paketi canlı kayıtlara aktar” basın. Tüm değişiklikler tek veritabanı işlemidir; hata veya çakışma olursa tamamı geri alınır. Başarılı tekrarlar yeni kayıt oluşturmaz. Kullanıcının sonradan yaptığı değişiklikler kaynak paketle ezilmez.
6. Finans, Simülasyon Merkezi, Bilgi Kütüphanesi ve hukuk sayfalarındaki sayı/tutarları kontrol edin. Bu sürüm hiçbir canlı yazma yapılmış gibi varsayımda bulunmaz.

## Mind Palace ve UYAP

Aynı JSON paketini Mind Palace 1.3'te ilgili tablo menüsünden içe aktarabilirsiniz. Yayımlanmış yerel tablo yapıları kullanılır. YouTube/Pinterest ayrıntılı HTML/JSON içe aktarma seçenekleri de korunur.

UYAP Flow 2.3.8 ZIP'leri `mind-palace-manifest.json` ve SHA-256 değerlerini içerir. Mind Palace ZIP'i doğrular, belgeleri kendi `documents` dizinine kopyalar ve dava/icra kaydına bağlar. UYAP'a giriş ve evrak indirme kullanıcının yetkili tarayıcı oturumunda yapılır. Canlı UYAP oturumu olmadan evrak indirilmiş gibi raporlanmaz.

## Doğrulama

`pnpm tip`, `pnpm test`, `pnpm build` ve `node tools/test-astra-import.mjs`.

SQL testi yerel PostgreSQL motorunda çalışır; kimlik, önizleme, atomik geri alma, tekrar ve kullanıcı ayrımı sınanır. Şifreleme ve mevcut hukuk RPC'leri testte sentetik karşılık kullanır. Gerçek Supabase göçü ve gerçek kullanıcı oturumuyla kabul testi ayrıca gerekir.
