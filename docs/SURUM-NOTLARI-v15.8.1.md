# ASTRA FİNANS OS v15.8.1 — Sürüm notları

Önceki yayın: v15.8.0 (`97b6fab`, 09.10.2026). Bu sürüm: `main` üzerindeki 15 commit (12.10.2026 – 20.10.2026), yayına alınmamış tüm değişiklikleri kapsar.

## Uygulama (kullanıcıya görünen)
- İlgi Çekici Ürünler uygulaması menüden kaldırıldı; eski adresler Beğendiğim Ürünler sayfasına yönlenir (`public/apps/ilgi-urunler` kaynağı değişmedi).
- Zihin tablolarında sayı okuma: `1,234,567` artık 1234567 okunur; `1,234` eskisi gibi 1,234 kalır.
- Zihin Sarayı stil dosyasındaki sahipsiz CSS artıkları silindi (derleme uyarısı giderildi; görünüm değişmez).

## Altyapı
- Vitest test altyapısı kuruldu (`pnpm test`; CI sırası: tip → test → build).
- Claude Code otomasyon yapısı (`.claude/`, `CLAUDE.md`) eklendi.

## Eski sistemden veri aktarım aracı (`tools/astra-os-aktarim`)
- Varsayılan kuru çalıştırma, onay kodu, `aktarim_eslesme` ile tekrar çalıştırılabilirlik ve geri alma.
- Yalnızca dalga a (statik uygulama verileri) yazar; dalga b/c yazıcıları henüz yok (`DALGA_YAZICI_YOK`).
- Yeni migration: `supabase/migrations/0027_aktarim_eslesme.sql`.
- Sentetik veriyle 1195 aktarım + 41 üretici + 47 tablo-hesap testi.

## Bilinen sınırlar (açık yazıyorum)
- Aktarım aracı **canlı Supabase ile hiç çalıştırılmadı**; `0027` migration'ı hiçbir veritabanına uygulanmadı, SQL/RLS davranışı denenmedi.
- Aktarım aracının güvenlik incelemesi **tamamlanmadı** (oturum kotası nedeniyle yarım kaldı).
- Menü değişikliğinin tarayıcıda görsel doğrulaması yapılmadı.
- Erişilebilirlik denetimi raporlandı, düzeltmeler bu sürümde yok.

## Doğrulama
`main` `97f120f`: CI yeşil; temiz klonda `pnpm install --frozen-lockfile`, `pnpm tip`, `pnpm test`, `pnpm build` geçti.
