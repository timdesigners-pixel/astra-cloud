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
