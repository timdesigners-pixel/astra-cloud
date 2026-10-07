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

1. `supabase/migrations/` altındaki göçleri uygula (kimlik tabloları, tek kayıt kuralı).
2. `pin-giris` fonksiyonunu dağıt.
3. Supabase → Edge Functions → Secrets bölümünde iki gizli ayar tanımla:
   - `ASTRA_PIN_BIBER`: uzun rastgele bir metin
   - `ASTRA_KURULUM_KODU`: ilk kurulumda ve PIN sıfırlamada sorulan kod
4. Vercel'de `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değişkenlerini tanımla.
5. Siteyi aç; PIN kurulu değilse kapı "PIN Oluştur" ekranını gösterir.
