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
