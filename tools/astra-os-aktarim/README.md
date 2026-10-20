# @astra/aktarim

ASTRA-OS verisini astra-cloud (Supabase) tarafına aktaran komut satırı aracı. **Kuru çalıştırma varsayılandır**; gerçek yazma yalnız kuru çalıştırmanın ürettiği onay koduyla yapılır. Plan: `.claude/output/plans/astra-os-veri-entegrasyonu.md`.

Şu an **dalga a** (uygulama durumları + `begeniler`) çalışır. Dalga b (finans) ve c (hukuk) dönüştürücüleri ve yazıcı yöntemleri sonraki görevlerdedir (`DALGA_YAZICI_YOK`). `statik-yukle` T6 görevinde yazılacaktır (komut adı rezerve).

## Güvenlik ilkeleri

- Araç hiçbir kayıt **değerini** (ad, tutar, IBAN, dosya no, parola) çıktıya, rapora, günlüğe veya hata metnine yazmaz; yalnız sayı, sabit kod ve kısa kimlik (onay kodu, aktarım kimliği) yazar. Tek çıktı kapısı `src/cikti.ts`'dir.
- Kimlik bilgisi yalnız **ortam değişkeninden** (PIN için ayrıca etkileşimli terminalde yankısız istemden) okunur; argümana, dosyaya, rapora yazılmaz. `--pin`, `--parola`, `--token` gibi bayraklar reddedilir.
- Oturum **kullanıcı oturumudur** (PIN → `pin-giris` → authenticated JWT); servis rolü anahtarı kullanılmaz. Jeton yalnız bellekte durur.
- PIN ile giriş **tek denemedir**, otomatik yeniden deneme yoktur (sunucu art arda yanlış denemede hesabı kilitler). Yanlış PIN'de kalan deneme sayısı yazılır.
- Hedefteki mevcut satır **asla güncellenmez**; yalnız ekleme, eşleşme yazma ve `silindi_at` ile gizleme yapılır.
- Her ağ isteği 30 sn zaman aşımına tabidir; ilk hatada yazma durur ve o ana kadarki sayılar raporlanır.

## Önkoşul: 0027 migration'ı ÖNCE uygulanmalı

`supabase/migrations/0027_aktarim_eslesme.sql` (idempotentlik ve geri alma için `aktarim_eslesme` tablosu) hedef Supabase projesine **önce** uygulanmalıdır. **Bu araç migration uygulamaz.** Tablo yoksa `yaz` ilk eşleşme okumasında hata verir ve hiçbir şey yazmaz.

## Ortam değişkenleri (yalnız adlar)

| Ad | Ne zaman | Not |
|---|---|---|
| `ASTRA_SUPABASE_URL` | her komut | `https://<ref>.supabase.co`; kimlik bilgisi değildir. Onay koduna girer: kod yalnız aynı hedef projede geçerlidir. Kuru çalıştırma yalnız bunu ister. |
| `ASTRA_SUPABASE_ANON` | `yaz`, `dogrula`, `geri-al`, `yetim-tara` | anon (kamusal) anahtar |
| `ASTRA_PIN` | `yaz`, `dogrula`, `geri-al`, `yetim-tara` | isteğe bağlı; yoksa etkileşimli terminalde yankısız sorulur, etkileşimsiz ortamda `OTURUM_HATASI neden=PIN_YOK` |

`ASTRA_SERVIS_ANAHTARI` yalnız ileride `statik-yukle` için kullanılacaktır; bu komutlar okumaz.

## Girdi dosyası güvenliği (R-9)

- Girdi (uygulama yedek JSON'u ya da `astra_kasa_duz.durum` çıktısı) ve `--ilgi` dosyası gerçek kişisel finans verisi içerir. Dosyaları **depo DIŞINDA** tutun (ör. `~/gecici/`), depoya koymayın.
- Araç dosyayı kopyalamaz, geçici dosya yazmaz, silmez. **İşiniz bitince dosyaları güvenle silin** (ve indirdiyseniz kopyalarını/geçmişini temizleyin).
- Şifreli kasa gövdesi (`v:1|2`) kabul edilmez (`SIFRELI_GIRDI`); araç şifre çözmez.
- `--rapor <yol>` dosyası yalnız doğrulanmış, değersiz rapordur (0600 izinli); yine de depoya koymayın.

## Çalıştırma rehberi — dalga a

Komutlar kökten: `pnpm --filter @astra/aktarim aktar <komut> [seçenekler]` (Node 22; bayrak `--experimental-strip-types` betikte hazır).

1. **Kuru çalıştırma** (ağ ve kimlik yok; hiçbir şey yazılmaz):
   ```
   export ASTRA_SUPABASE_URL=https://<ref>.supabase.co
   pnpm --filter @astra/aktarim aktar kuru-calistir --dalga a --girdi ~/gecici/astra-yedek.json --ilgi ~/gecici/ilgi-urunler.json --rapor ~/gecici/rapor-a.json
   ```
   `--ilgi` isteğe bağlıdır (yoksa `ILGI_KAYNAK_YOK`, yalnız uygulama durumları planlanır). `--json` raporu JSON olarak yazar.
2. **Raporu inceleyin**: tablo başına yeni/atlanan sayıları, kontrol toplamı (kuruş), atlanma/uyarı kodları. Kayıt değeri raporda yoktur; sorunlu kaydı kaynakta kaynak kimliğiyle bulursunuz.
3. **Onay kodunu alın**: rapordaki `ONAY_KODU ONAY-a-<12 hex>`. Kod; araç sürümüne, dalgaya, hedef projeye ve tüm plana bağlıdır. Girdi dosyası ya da dalga değişirse kod tutmaz.
4. **Yazın** (kuru çalıştırmadaki AYNI `--girdi`, `--ilgi`, `--dalga` ile):
   ```
   export ASTRA_SUPABASE_ANON=...   # anon anahtar
   export ASTRA_PIN=...             # ya da boş bırakıp terminalde yankısız girin
   pnpm --filter @astra/aktarim aktar yaz --dalga a --girdi ~/gecici/astra-yedek.json --ilgi ~/gecici/ilgi-urunler.json --onay ONAY-a-xxxxxxxxxxxx
   ```
   Yanlış, boş ya da başka dalganın kodunda **hiçbir yazma yapılmaz** (oturum bile açılmaz, PIN deneme hakkı yakılmaz). Sıra: eşleşme oku → sahiplen → yaz → eşleşme yaz. Hedefte aynı `begeniler.kod` ya da `uygulama_durumu` anahtarı varsa satır **sahiplenilir** (yazılmaz, yalnız eşleşme kaydedilir); birden çok aday varsa `belirsiz` sayılır ve yazılmaz. İkinci çalıştırma yeni satır yazmaz. `YAZ_YARIM` ile biterse çıktıdaki `yetim_olabilir` sayısına bakın (aşağıda).
5. **Doğrulayın** (salt okunur):
   ```
   pnpm --filter @astra/aktarim aktar dogrula --dalga a --girdi ... --ilgi ...
   ```
   Kaynak–hedef sayı ve kuruş toplamı karşılaştırılır (`ESIT` / `FARK_VAR`), fark varsa **çıkış kodu 1**. Ardından plan §6'daki SQL sorgularını (değer döndürmeyenleri) SQL editöründe çalıştırıp uygulamada duman testi yapın.
6. **Geri alın** (gerekirse): önce kodsuz çalıştırın (yalnız sayım ve `ONAY-geri-...` kodu verir), sonra kodla:
   ```
   pnpm --filter @astra/aktarim aktar geri-al --aktarim <uuid>            # ya da --dalga a
   pnpm --filter @astra/aktarim aktar geri-al --aktarim <uuid> --onay ONAY-geri-xxxxxxxxxxxx
   ```
   `<uuid>`: `yaz` çıktısındaki `aktarim_id`. Eşleşmeler ve aracın yazdığı satırlar `silindi_at` ile gizlenir (fiziksel silme yok). **Sahiplenilen satırlara dokunulmaz.** `uygulama_durumu` anahtarları kullanıcı verisi olabileceğinden bayraksız silinmez; yalnız `--uygulama-durumlarini-sil` ile ve yalnız aracın kendi yazdığı anahtarlar silinir. Geri alındıktan sonra aynı kodla yeniden `yaz` satırları yeniden oluşturur (eşleşme güncellenir).

### Yetim tarama (çökme penceresi)

Satır yazıldı ama eşleşmesi yazılamadıysa (ağ kopması, zaman aşımı) satır "yetim"dir:

```
pnpm --filter @astra/aktarim aktar yetim-tara --baslangic 2026-10-20T09:00:00Z
pnpm --filter @astra/aktarim aktar yetim-tara --yetim-temizle --baslangic <aynı zaman> --onay ONAY-yetim-xxxxxxxxxxxx
```
`begeniler` taranır (`uygulama_durumu` anahtarlarının ayırt edilebilir izi yoktur). `--baslangic` ile yalnız o andan sonra oluşan satırlar aday olur; temizleme onaylıdır ve soft delete yapar, ardından `yaz` satırı yeniden oluşturur. Yarım kalan bir çalıştırmadan sonra `yaz`'ı tekrarlamadan önce `yetim-tara` çalıştırın; aksi halde yetim satır "sahiplenilmiş" sayılır.

## Komutlar ve çıkış kodları

| Komut | Açıklama |
|---|---|
| `kuru-calistir` (varsayılan) | girdi → plan → rapor + onay kodu; ağ/kimlik yok |
| `yaz` | `--onay` ile yazma |
| `dogrula` | kaynak–hedef kontrol toplamı; fark → çıkış 1 |
| `geri-al` | `--aktarim <uuid>` veya `--dalga`; onay kodlu |
| `yetim-tara` | eşleşmesiz aktarım satırları; `--yetim-temizle` onaylı |
| `statik-yukle` | rezerve (T6) — çalışmaz, `KOMUT_T6_GOREVI` verir |

Seçenekler: `--girdi <yol>` `--dalga a|b|c` `--ilgi <yol>` `--rapor <yol>` `--onay <kod>` `--aktarim <uuid>` `--uygulama-durumlarini-sil` `--yetim-temizle` `--baslangic <ISO>` `--json` `--sessiz` `--yardim`.

Çıkış kodları: **0** başarılı · **1** doğrulama farkı ya da hata · **2** kullanım hatası (bilinmeyen komut/bayrak, eksik ortam değişkeni, eksik zorunlu seçenek).

## Geliştirme

```
pnpm --filter @astra/aktarim tip      # tür denetimi
pnpm --filter @astra/aktarim test     # testler
```
Kökten `pnpm tip` ve `pnpm test` bu paketi de çalıştırır. Kurallar (Node tür silme sınırı): `enum`, `namespace`, parametre-özelliği yok; göreli importlar `.ts` uzantılı. `tsx`/`ts-node` kullanılmaz.

Katmanlar: `girdi/` → `donusum/` (saf) → `plan/` (saf) → `komut/` → `yazici/` (tek ağ katmanı: `supabase-yazici.ts`; testler için `bellek-yazici.ts`). `fetch`/`@supabase/supabase-js` yalnız `yazici/` içindedir; `console.`/`process.stdout` yalnız `cikti.ts`; `process.env` yalnız `ayar.ts`.
