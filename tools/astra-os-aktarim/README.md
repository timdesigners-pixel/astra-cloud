# @astra/aktarim

ASTRA-OS verisini astra-cloud (Supabase) tarafına aktaran komut satırı aracı. Şu an yalnız iskelet; komutlar **yakında** (kuru-calistir, yaz, dogrula, geri-al, yetim-tara, statik-yukle). Plan: `.claude/output/plans/astra-os-veri-entegrasyonu.md`.

## Güvenlik ilkeleri

- Araç hiçbir kayıt **değerini** (ad, tutar, IBAN, dosya no, parola) çıktıya, rapora veya günlüğe yazmaz; yalnız sayı, kod ve `kaynak_id` yazar.
- Kimlik bilgisi yalnız **ortam değişkeninden** (ya da PIN için yankısız istemden) okunur; argümana, dosyaya veya rapora yazılmaz.
- **Kuru çalıştırma varsayılandır.** Gerçek yazma ancak `--yaz --onay <KOD>` ile, kuru çalıştırmanın ürettiği onay koduyla yapılır.
- Girdi yolu yalnız komut satırı argümanıdır. Girdi/yedek dosyaları işlem sonrası güvenle silinmelidir ve depoya girmez (`.gitignore`).

## Çalıştırma biçimi

Node 22 (bu ortamda v22.22.0): TypeScript dosyaları ek bağımlılık olmadan doğrudan çalıştırılır (tür silme). Node 22.18+ bayraksız çalıştırır; 22.6-22.17 için `--experimental-strip-types` gerekir. `pnpm aktar` betiği bayrağı her zaman verir, ikisinde de çalışır. tsx/ts-node **kullanılmaz**.

Kurallar (tür silme sınırı): `enum`, `namespace`, parametre-özelliği yok; göreli importlar `.ts` uzantılı (`erasableSyntaxOnly` ve `allowImportingTsExtensions` ile `pnpm tip` zorlar).

```
pnpm --filter @astra/aktarim aktar      # CLI
pnpm --filter @astra/aktarim tip        # tür denetimi
pnpm --filter @astra/aktarim test       # testler
```

Kökten `pnpm tip` ve `pnpm test` bu paketi de otomatik çalıştırır.

## Ortam değişkenleri (yalnız adlar; sonraki adımlarda)

`ASTRA_SUPABASE_URL`, `ASTRA_SUPABASE_ANON`, `ASTRA_PIN` (isteğe bağlı), `ASTRA_SERVIS_ANAHTARI` (yalnız `statik-yukle`).

## Komutlar

Yakında.
