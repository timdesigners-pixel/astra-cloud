# astra-cloud

ASTRA FİNANS OS — yalnız bulutta çalışan yeni sürüm. Eski sistem `astra-os` salt okunur referanstır.

```text
apps/web/            ana uygulama
packages/alan        saf iş mantığı
packages/sema        şemalar ve tipler
packages/ortak-test  sentetik veri ve test yardımcıları
supabase/            göçler, fonksiyonlar, tohum, testler
tools/               yönetici araçları
docs/                karar kaydı
```

```bash
pnpm install
pnpm dev
```

## PIN kurulumu

PIN kaynak kodda yoktur; sunucuda yalnız HMAC etiketi saklanır.

1. `supabase/migrations/0001_kimlik.sql` dosyasını Supabase SQL Editor'de çalıştır.
2. Supabase'de `Authentication → Users` altında tek bir sahip kullanıcı oluştur (e-posta ve uzun rastgele parola; parolayı kimse girmez).
3. `pin-giris` fonksiyonunu dağıt ve şu sırları tanımla: `ASTRA_PIN_BIBER`, `ASTRA_SAHIP_EPOSTA`, `ASTRA_SAHIP_PAROLA`, `ASTRA_CORS_IZIN`.
4. Kendi makinende `node tools/pin-kur.mjs` çalıştır; PIN gizli sorulur.
5. Vercel'de `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değişkenlerini tanımla.
