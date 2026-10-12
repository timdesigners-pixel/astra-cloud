# Review: vitest-kurulumu (tests pipeline, faz 4)

## Verdict: PASS

Dogrulama (calistirildi): `pnpm install --frozen-lockfile --offline` OK; `pnpm tip` yesil; `pnpm test` yesil (1 dosya, 28 test); `TZ=UTC` ile de 28/28 yesil.

## Bulgular

1. INFO - pnpm-lock.yaml: yalniz vitest agaci eklendi (vitest 3.2.7, vite-node 3.2.4, @vitest/* 3.2.7, chai, tinypool, vb.). Silinen satir yok; vite 7.3.7, esbuild 0.28.2, rollup 4.64.0 tek kopya (surum kaymasi yok). Kabul kriteri saglandi.
2. INFO - apps/web/package.json:9-11,19: `test`, `test:izle`, `vitest ^3.2.4` plana uygun; kokte yalniz `test: pnpm -r run test` (package.json:11). Fazladan bagimlilik yok.
3. INFO - .github/workflows/ci.yml:13: sira tip -> test -> build (kriter saglandi).
4. INFO - Uretim kodu: `git diff` yalniz paket/lock/ci/skill/memory dosyalarini gosteriyor; apps/web/src ve apps/web/public/apps/* degismemis. Yeni dosyalar yalniz vitest.config.ts ve *.test.ts.
5. INFO - apps/web/src/ozellikler/zihin/tablo-hesap.test.ts: beklenen degerler tablo-hesap.ts davranisiyla ornusuyor (sayiOku dallari: nokta/virgul sirasi, 3 haneli grup, TL/TRY/%/₺, NaN; sutunToplam `|| []` korumasi; tabloSirala yon degisimi, bos/NaN hep sonda, tarih/metin). Tautoloji yok; 28 testin hepsi ger cek cikti assert ediyor. Kapsanmayan: `para` ve `yuzde` icin tam cikti ve `tarih` basarili bicim (bilincli, plan geregi).
6. INFO - test.ts:85-93: hucreYaz sayi/para `toContain('1.234,5')` gevsek ama bilincli (ICU para sembolu/bosluk farki kirilganligindan kacinma); `yuzde` `/^%/` zayif ama kod `'%' +` ile onek verdigi icin dogru. Kirilgan degil.
7. INFO - tr-TR/ICU/TZ: `localeCompare('tr')` (test.ts:127-131, Armut/Çay/Zeytin) tam ICU ister; Node 22 resmi build ve CI setup-node'da var, kucuk ICU'da kirilabilir (kabul edilebilir, plan 9.6). Tarih siralamasi `new Date('YYYY-MM-DD')` UTC ayrisir, karsilastirma goreli; TZ'den bagimsiz (TZ=UTC kosusuyla dogrulandi). Yerel biçimli cikti (toLocaleDateString) assert edilmiyor.
8. INFO - apps/web/vitest.config.ts:8: `env: { TZ }` worker'larda gec kalabilir (plan 6 notu); testler TZ-bagimsiz oldugundan etkisi yok. Yorum "Europe/Istanbul ... garanti" iddiasini abartmiyor.
9. INFO - Kod stili: Turkce describe/it adlari ve yorumlar, 2 bosluk, tek tirnak, noktali virgul uyumlu. `describe/it/expect` acik import. `as unknown as Pick<...>` (test.ts:63) `as never` yerine tercih edilen kalip. Kucuk not: test.ts:5 tek satirda uzun (~120 kol.), `tabloKur` aciklamasi bicim `string | undefined`; kabul edilebilir (projede formatter yok).
10. INFO - Dokuman: SKILL.md ve facts.md guncellemesi dogru. Kucuk tutarsizlik: SKILL.md "Frameworku (recommended)" bolumu hala "Подключение при первом тесте" yerine guncellenmis; sorun yok. facts.md Key Paths satirinda Rusca/Turkce karisik, projenin mevcut memory diline uygun.
11. INFO - `.claude/memory/usage.jsonl` (+15 satir) bu isin parcasi DEGIL; pipeline telemetri yan etkisi. Commit'e alinmamasi veya ayri tutulmasi onerilir. `.claude/output/` izlenmeyen dizin (pipeline ciktilari), commit kapsami karar sahibine ait.

## Ozet
BLOCK: 0, WARN: 0, INFO: 11. Kabul kriterleri (plan bolum 10) karsilandi; `vite build` bu review'da ayrica kosulmadi (test dosyalari giris grafiginde degil, etki beklenmiyor).
