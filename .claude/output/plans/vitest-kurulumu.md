# TZ: Vitest test altyapisi kurulumu (task-slug: vitest-kurulumu)

Faz: tests pipeline / ANALYZE. Kod yazilmadi, ag/paket kurulumu yapilmadi.

## 1. Hedef
`@astra/web` paketine Vitest eklemek; saf-mantik (`*-hesap.ts`) icin ilk ornek test; kok ve paket `test` betikleri; CI'a test adimi. `pnpm tip` ve `pnpm build` davranisi degismemeli.

## 2. Scope
Dahil: vitest devDependency, yapilandirma, betikler, 1 ornek test dosyasi, CI adimi, pnpm-lock.yaml guncellemesi, (opsiyonel) testing SKILL.md "Durum" satirinin guncellenmesi.
Haric: coverage (`@vitest/coverage-v8`), happy-dom, Playwright, `packages/ortak-test` doldurma, veri/ (Supabase) katmani testleri, legacy `public/apps/*`.

## 3. Mevcut durum (okunarak dogrulandi)
- Kok `package.json`: scripts `dev`, `build`, `tip` (`pnpm -r run tip`); devDep `typescript ^5.6.0`; `packageManager pnpm@10.0.0`; `"type": "module"`.
- `apps/web/package.json`: scripts `dev`, `build` (`vite build`), `tip` (`tsc -p .`); devDep yalniz `vite ^7.0.0` (lock: 7.3.7, engines node ^20.19 || >=22.12). Node yerel: v22.22.0, CI: node 22.
- `pnpm-workspace.yaml`: `apps/*`, `packages/*`. Paketler `alan`, `sema`, `ortak-test` bos (test betigi yok; `pnpm -r run test` betigi olmayan paketleri atlar).
- `tsconfig.base.json`: ES2022, ESNext, moduleResolution bundler, strict, noEmit, lib ES2022+DOM.
- `apps/web/tsconfig.json`: extends base, `types: ["vite/client"]`, `include: ["src"]`. Test dosyalari `src/` altinda olacagi icin **tsc kapsamina GIRER** (istenen davranis: testler de tip-denetimden gecer).
- `apps/web/vite.config.js`: yalniz `export default { base: './' }`.
- `.github/workflows/ci.yml`: tek job `kontrol`; adimlar: checkout, pnpm/action-setup@v4, setup-node (22, cache pnpm), `pnpm install --frozen-lockfile`, `pnpm tip`, `pnpm build`.
- `.claude/skills/testing/SKILL.md` zaten kararlastirmis: Vitest, `<modul>.test.ts` modulun yaninda, kok `"test": "pnpm -r run test"`, paket `"test": "vitest run"`, CI'a `pnpm test`.
- Mevcut `*-hesap.ts`: `ozellikler/zihin/tablo-hesap.ts` (42 satir, import yok, tam saf) ve `ozellikler/kayit/ozet-hesap.ts` (60 satir, yalniz `import type { Kayit }`, calisma zamaninda silinir).

## 4. Paket ve surum onerisi
- `vitest`: `^3.2.4` (Vite 5/6/7 peer destegi, Node 20+; Vite 7 ile uyumlu bilinen kararli hat). Alternatif `^4.0.0` (Vite 6/7). Uygulayici `pnpm view vitest version peerDependencies` ile dogrulayip secsin; karar notu: surum `^3.2.4` varsayilan.
- Yalniz `apps/web/package.json` devDependencies'e eklenir (kokte degil). `pnpm --filter @astra/web add -D vitest@^3.2.4`.
- **pnpm-lock.yaml mutlaka guncellenip commit edilmeli**: CI `--frozen-lockfile` kullaniyor; lock eksikse CI kirilir.
- Vitest kendi vite kopyasini getirmez; mevcut vite 7.3.7 peer'i ile cozulmeli (lock'ta tek vite surumu kalmasi beklenir; kontrol edilsin).

## 5. Dosya listesi
Degisecek:
1. `/home/user/astra-cloud/apps/web/package.json` - devDependencies'e `vitest`; scripts'e `"test": "vitest run"` ve `"test:izle": "vitest"`.
2. `/home/user/astra-cloud/package.json` - scripts'e `"test": "pnpm -r run test"`.
3. `/home/user/astra-cloud/pnpm-lock.yaml` - otomatik (pnpm install).
4. `/home/user/astra-cloud/.github/workflows/ci.yml` - `pnpm tip` sonrasi, `pnpm build` oncesi `- run: pnpm test` (hizli geri bildirim: tip -> test -> build).
5. (Opsiyonel) `/home/user/astra-cloud/.claude/skills/testing/SKILL.md` ve `.claude/memory/facts.md` - "test altyapisi yok" ifadelerinin guncellenmesi.

Olusacak:
6. `/home/user/astra-cloud/apps/web/vitest.config.ts` (yapilandirma).
7. `/home/user/astra-cloud/apps/web/src/ozellikler/zihin/tablo-hesap.test.ts` (ornek test).
8. (Opsiyonel, ikinci dosya) `/home/user/astra-cloud/apps/web/src/ozellikler/kayit/ozet-hesap.test.ts`.

## 6. Yapilandirma taslagi
`apps/web/vitest.config.ts` (ayri dosya; `vite.config.js`'e dokunulmaz, boylece build etkilenmez; vitest.config onceliklidir):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Europe/Istanbul: tarih/yerel bicim testleri her ortamda ayni sonucu versin
    env: { TZ: 'Europe/Istanbul' },
  },
});
```
Notlar:
- `vitest.config.ts` `tsconfig.json`'in `include: ["src"]` kapsami disinda -> `tsc -p .` onu denetlemez (sorun degil; `vitest/config` tipleri zaten dogru).
- `env.TZ` vitest worker'larinda `process.env.TZ` olarak gec kalabilir (Node TZ'yi ilk Date kullaniminda okur). Guvenilir alternatif: `globalSetup` veya betikte `TZ=Europe/Istanbul vitest run`. Ornek testler yerel-tarih tabanli `ayKaydir` kullaniyorsa TZ'den bagimsiz tasarlanmis olmali (asagida oyle). Uygulayici TZ ayarini denesin, calismazsa betigi `"test": "TZ=Europe/Istanbul vitest run"` yapmak yerine (Windows uyumsuz) yalniz TZ-bagimsiz assert'leri tutsun.
- Cakisma: `globals` kapali (SKILL.md ornegi `import { describe, it, expect } from 'vitest'` kullanir) -> tsconfig `types`'a vitest/globals eklemeye gerek yok.

## 7. Betikler
- `apps/web`: `"test": "vitest run"`, `"test:izle": "vitest"`.
- Kok: `"test": "pnpm -r run test"` (yalniz `@astra/web` betige sahip; bos paketler atlanir).
- CI: `- run: pnpm test`.
- Bos test durumu: vitest dosya bulamazsa exit 1 verir; en az bir test dosyasi bulundugu surece sorun yok.

## 8. Ornek test: `tablo-hesap.test.ts`
Secim nedeni: sifir import, sifir bagimlilik, ortam-bagimsiz (cogu islem string/sayi). Fonksiyonlar kod okunarak dogrulandi.

Test edilecek fonksiyonlar ve beklenen davranis:
- `sayisal(b)`: `'sayi'|'para'|'yuzde'` -> true; `'metin'`, `'tarih'`, `undefined` -> false.
- `sayiOku(v)`:
  - `'1.234,50'` -> 1234.5 (virgul sonda: noktalar silinir, virgul ondalik)
  - `'1,234.50'` -> 1234.5 (nokta sonda: virgullar silinir)
  - `'12,5'` -> 12.5
  - `'1.234'` -> 1234 (3 haneli nokta grubu = binlik)
  - `'1.5'` -> 1.5
  - `'%12'` -> 12, `'₺99'` -> 99, `'12 TL'`/`'12 try'` -> 12 (bosluk, %, TL, TRY harf duyarsiz silinir)
  - `''`, `null`, `undefined`, `'abc'` -> NaN
  - `5` (sayi girdisi) -> 5
- `sutunToplam({ satirlar }, c)`: `[['1.000,50'],['x'],['2']]`, c=0 -> 1002.5 (okunamayan hucre atlanir); `satirlar` bos dizi -> 0; `satirlar` undefined (`as never` ile) -> 0 (`|| []` korumasi).
- `tabloSirala(b, c)` (b yerinde degisir, `b.sira` set edilir):
  - sayi sutunu, satirlar `['10'],[''],['2'],['x']`: ilk cagri artan -> `['2'],['10']` sonra bos/okunamayan hucreler sonda; `b.sira` = `{ c, yon: 1 }`.
  - ayni sutuna ikinci cagri -> yon `-1`: `['10'],['2']` ve bos hucreler HALA sonda.
  - farkli sutuna gecince yon tekrar `1`.
  - metin sutunu `['Zeytin'],['Çay'],['Armut']` -> tr yerel sirasi: `Armut, Çay, Zeytin` (Node 22 tam ICU gerektirir; resmi Node build'inde var).
  - tarih sutunu (`bicim: 'tarih'`): `['2025-03-01'],['2024-12-31'],['']` -> `2024-12-31, 2025-03-01, ''`.
- `hucreYaz` (kisitli): bos/null/undefined -> `''`; `('abc','sayi')` -> `'abc'` (okunamayan oldugu gibi); `('x','metin')` -> `'x'`; `('geçersiz','tarih')` -> girdi aynen. `para`/`yuzde`/tarih icin tam bicimli cikti ASSERT EDILMESIN (tr-TR para biciminde bosluk/ICU ince farklari kirilgan); gerekirse `toContain('1.234,5')` gibi gevsek kontrol.

Opsiyonel ikinci dosya `ozet-hesap.test.ts` (TZ-bagimsiz kisim): `ayAnahtari(new Date(2025, 0, 5))` -> `'2025-01'`; `ayKaydir('2024-12', 1)` -> `'2025-01'`; `ayKaydir('2025-01', -1)` -> `'2024-12'`; `sonAylar('2025-02', 3)` -> `['2024-12','2025-01','2025-02']`. `gelirAyi`/`giderAyi` icin fixture `Kayit` `id` ve `surum` zorunlu (`Kayit = { id: string; surum: number; [alan]: unknown }`): ornek `{ id: '1', surum: 1, tur: 'maas', sabit: true, tutar: 1200, periyot: 'yillik', baslangic: '2025-01-01' }` -> sabit.get('maas') = 100; `alinan_borc` turu `toplam`a girmez (karar kaydi: odunc gelir degil) -> `alinanBorc` ayri alanda. Bu ikinci dosya kapsami buyutur; ana teslimde yalniz `tablo-hesap.test.ts` yeterli, ikincisi onerilen ek.

Dil: test adlari Turkce (`describe('sayiOku', () => { it('binlik noktali ve ondalik virgullu sayiyi okur', ...) })`), yorumlar Turkce, tek tirnak, noktalı virgül, 2 bosluk. Import: `import { describe, it, expect } from 'vitest'; import { sayiOku, ... } from './tablo-hesap';` (uzantisiz).

## 9. tsc / build etkisi ve riskler
1. `tsc -p .` test dosyalarini kapsar (`include: ["src"]`). `vitest` tipleri resolve olmali (paket kurulu); `types: ["vite/client"]` kisitlamasi yalniz global tipleri sinirlar, acik `import ... from 'vitest'` calisir. Beklenen sorun yok. Dikkat: `noUncheckedIndexedAccess` tsconfig'de YOK ama mevcut kodda `y!` kullanimi var; testte dizi indeksleri guvenli, `b.satirlar[0]` `string[] | undefined` degil (flag kapali). `as never` yerine `as unknown as Tablo` tercih edilebilir.
2. `vite build` yalniz `index.html` giris grafiğinden bundle eder; `*.test.ts` hicbir yerden import edilmedigi icin build ciktisina girmez. Etki yok.
3. `pnpm-lock.yaml` guncellemesi unutulursa CI `--frozen-lockfile` ile duser (en buyuk risk).
4. Vitest yeni esbuild/rollup optional bagimliliklari getirir; pnpm 10 build-script onayi (`onlyBuiltDependencies`) esbuild icin zaten vite ile cozulmus durumda; kurulumda yeni uyari cikarsa degerlendirilsin.
5. Yerel saat dilimi: `ayKaydir/ayAnahtari` yerel `Date` kullanir; test sabit tarih/`new Date(y, m, d)` ile kurulursa TZ'den bagimsizdir. `Europe/Istanbul` invariant'i icin `ayAdi` (toLocaleDateString 'tr-TR') testlenmesin veya gevsek kontrol edilsin.
6. ICU: `localeCompare(..., 'tr')` ve `toLocaleString('tr-TR')` Node 22 resmi build'inde tam ICU ile calisir; CI `setup-node` de tam ICU verir.
7. Vitest surum/Vite eslesmesi: lock'ta tek vite (7.3.7) kalmali; ikinci bir vite kopyasi cikarsa `pnpm why vite` ile kontrol.
8. `vitest.config.ts` ayri dosya oldugundan `vite.config.js`'deki `base: './'` teste tasinmaz (gereksiz, node ortami).
9. Reuse: Aynalayan test altyapisi yok; `packages/ortak-test` simdilik bos, ortak fixture gerekmedigi icin kullanilmaz (ikinci test dosyasinda `Kayit` fabrikasi tekrar edilirse sonradan oraya tasinir). Analiz: "Aninda tekrar eden test yardimcisi bulunamadi; src altinda hicbir `*.test.ts` yok".

## 10. Acceptance criteria
- `pnpm install` sonrasi `pnpm-lock.yaml` guncel; `pnpm install --frozen-lockfile` basarili.
- `pnpm test` (kok) ve `pnpm --filter @astra/web test` yesil, en az `tablo-hesap.test.ts` calisir.
- `pnpm tip` ve `pnpm build` onceki gibi yesil.
- Test dosyasi `apps/web/src/ozellikler/zihin/tablo-hesap.test.ts`; test adlari/yorumlar Turkce, `describe/it/expect` acik import.
- `.github/workflows/ci.yml`: `pnpm tip` -> `pnpm test` -> `pnpm build` sirasi.
- Uretim kodunda (`*.ts` non-test) degisiklik yok; `public/apps/*` dokunulmamis.

## 11. Alt gorevler (siralama)
1. node-developer: paket ekleme + lock, `vitest.config.ts`, betikler.
2. node-test-developer: `tablo-hesap.test.ts` (+ opsiyonel ozet-hesap).
3. devops/node-developer: ci.yml adimi.
4. Dogrulama: `pnpm tip && pnpm test && pnpm build`.
5. Dokuman: testing SKILL.md / facts.md guncelleme (opsiyonel).

## 12. Acik sorular (varsayilan karar verildi, onay gerekirse degistirilebilir)
- vitest surumu: varsayilan `^3.2.4` (alternatif `^4`).
- Ikinci ornek (`ozet-hesap.test.ts`) kapsama alinsin mi: varsayilan EVET degil, yalniz opsiyonel.
- Coverage simdilik eklenmiyor (SKILL.md: ayrica onay).
