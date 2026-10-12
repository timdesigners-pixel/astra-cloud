# Known Issues

Повторяющиеся проблемы, выявленные при ревью.

| Date | Issue | Frequency | Resolution |
|------|-------|-----------|------------|
| 2026-10-12 | `sayiOku('1,234,567')` NaN dönüyor, `sutunToplam` bu hücreyi sessizce atlıyor (tablo-hesap.ts) | 1 | Çok gruplu virgül (`/^-?\d{1,3}(,\d{3}){2,}$/`) binlik sayıldı; `'1,234'` → 1.234 tr-TR kuralı olarak değişmedi (fix-code/sayioku-virgul-binlik) |
| 2026-10-12 | `vite build` CSS uyarısı: `Unexpected "}"` (zihin.css:96, stiller/zengin.css:99, `…transparent 60%)}`) | 1 | Açık, ayrı iş; bu düzeltmeyle ilgisiz |
