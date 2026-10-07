# Karar kaydı

| Konu | Karar |
| --- | --- |
| Hedef | Plana uygun tam sistem, yalnız bulut (Supabase) |
| Eski repo | `astra-os`, salt okunur referans |
| Taşınacak | PIN ekranı ve tasarım birebir; 28 sekme; 12 APPS uygulaması |
| İşleyiş | Yeni işleyiş: görünüm eskisiyle aynı, iç hesaplar ve yapı yeniden yazılır |
| Yığın | pnpm workspaces, Vite, TypeScript (strict), Supabase |

## Menü yapısı

| Konu | Karar |
| --- | --- |
| Gruplama | Notion düzeninde 6 merkez: Dashboard, Muhasebe & Finans, Hukuk Merkezi, My Space, AI & Teknoloji Üssü, Sistem |
| Sayfalar | 28 sayfanın hepsi korunur; eski `?tab=` adresleri çalışır |
| Merkez başlığı | Yalnız açılıp kapanır; merkez özet sayfası sonraya |
| Yapılacaklar | Dashboard'da; Alınacaklar ve Alım Planı My Space'te |
| Gmail & E-Fatura | Muhasebe & Finans, Nakit Akışı |
| Eski düz menü | Sistem Ayarları'ndan geri seçilebilir |
| Kısayollar | 1–9, merkez sırasına göre (Genel Bakış, Sırada Ne Var, Yapılacaklar, Aylık Giderler…) |

## Borçlar, hesaplar ve kişiler

| Konu | Karar |
| --- | --- |
| Merkez | "Borçlar & Hesaplar" ayrı merkez: Borçlar, Hesaplar, Rehber grupları |
| Yeni sayfalar | Kişiler & Kurumlar, IBAN Rehberi, Banka Hesapları, Vergi & SGK Borçları, İcra Borçları |
| İcra | Hukuk & İcra Masası hukuki tarafı tutar; İcra Borçları aynı dosyaların borç görünümüdür |
| Tek kaynak | Borç yalnız `borclar` tablosunda; kart, kişi, vergi ve icra sayfaları ona bağlanır |
| IBAN | Alan düzeyinde şifreli (pgcrypto, anahtar Vault'ta); istemci şifreli sütunları okuyamaz, yalnız RPC ile çözülür |
| Banka bağlantısı | İlk sürümde ekstre içe aktarma; canlı bağlantı sonraya |
| Yapım sırası | Kişiler, IBAN, Banka Hesapları, Limitler, Borç Takibi, Kişilere Borçlar, Vergi & SGK, İcra Borçları, Taksitlendirme |

## Karşılama panosu ve eski veriler

| Konu | Karar |
| --- | --- |
| Panonun yeri | Genel Bakış sayfasının üstü; görünüm eski sistemle aynı |
| Saat dilimi | Tarih, gün, hafta ve selamlama Europe/Istanbul saatine göre |
| Dış servisler | Hava: open-meteo, kur: open.er-api, altın: gold-api. Anahtarsız, tarayıcıdan çağrılır; yalnız bellekte 30 dk önbelleğe alınır. İleride Edge Function arkasına alınabilir |
| Saklanan | Ad, şehir, sağlık hedefi (`ayarlar`), günlük sağlık (`saglik_gunluk`), hızlı notlar (`hizli_notlar`); hepsi satır düzeyi güvenlikli, silme yumuşak |
| Bağlanmayanlar | Günün puanı, görevler, tarihte bugün: ilgili sayfalar yapılınca bağlanır |
| Eski veri aktarımı | icra dosyaları, alacaklılar ve avukatlar eski projeden tek seferlik aktarıldı; dosya numaraları şifreli; sayı ve tutar kontrol toplamları eşleşti |

## Modül Merkezi ve uygulamalar
- "AI & Teknoloji Üssü" kaldırıldı; AI Danışman & Ses, Dashboard merkezine taşındı.
- Modül Merkezi üst menü merkezidir: Tüm Uygulamalar sayfası ve 12 uygulama sayfası. Eski `?tab=karsilama` gibi adresler yeni adlara yönlenir.
- Uygulamalar `public/apps/` altında, kaynak dosyalar değiştirilmeden; her biri sandbox çerçevede çalışır (allow-same-origin yok).
- Uygulama kayıtları `uygulama_durumu` tablosunda şifreli tutulur; istemci tabloya değil yalnız `uygulama_durumu_oku/yaz/sil` işlevlerine erişir.
- Servis uçları (market fiyatı, Gemini) yeni sunucuda henüz yok; köprü "servis bağlı değil" yanıtı verir.
- Geçici bağımlılıklar: oynatma/pinterest verisi, dosya yöneticisi, telefon rehberi ve ilgi ürünleri eski projenin depolamasından okur.

## Onaylanan menü ve veri planı
- Menü 12 merkez ve onaylanan sayfalar olarak yeniden kuruldu; eski adresler yeni sayfalara yönlenir.
- Alınacaklar (Giderler) ve Alınacaklar Listesi (Hayaller) ayrı listelerdir.
- Ödemeler ayrı veridir (`odemeler`); beklenen gelir ve gider vadeleri `vadeler`'dedir; gerçekleşenler tek defter olan `hareketler`'e yazılır.
- İcra dosyası tek kayıttır; Borçlar ve Hukuk menüsü aynı kaydı gösterir. Her icra dosyası bir `borclar` satırına bağlanır.
- Alınan borç gelir raporuna girmez (`gelir_sayilir = false`).
- Bahis sonucu Ekstra Gelirler'e net tek satır olarak yazılır; zarar eksi tutarlıdır.
