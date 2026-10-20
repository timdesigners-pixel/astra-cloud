/* KATMAN KORUMA: kaynak dosyaları dosya sistemi taramasıyla denetler (plan §9.2). Yorumlar sayılmaz; metin ve düzenli ifade değişmezleri sayılır.
   Kurallar test dosyalarını (*.test.ts) kapsamaz; yalnız üretim kodunu ve `test-destek.ts` dışındaki her şeyi denetler. */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const PAKET = resolve(SRC, '..');
const TOOLS = resolve(PAKET, '..');

function dosyalariTopla(kok: string, uzanti: RegExp): string[] {
  const sonuc: string[] = [];
  const gez = (dizin: string): void => {
    for (const ad of readdirSync(dizin).sort()) {
      if (ad === 'node_modules' || ad === '.git' || ad === 'dist') continue;
      const yol = join(dizin, ad);
      const d = statSync(yol);
      if (d.isDirectory()) gez(yol);
      else if (uzanti.test(ad)) sonuc.push(yol);
    }
  };
  gez(kok);
  return sonuc;
}

/* Yorumları boşlukla değiştirir (satır sayısı korunur). Metin (' " `) ve düzenli ifade değişmezleri korunur; `${}` içi basitçe metin sayılır. */
export function yorumlariAyikla(kod: string): string {
  let cikti = '';
  let i = 0;
  let oncekiAnlamli = '';
  const n = kod.length;
  while (i < n) {
    const c = kod[i]!;
    const s = kod[i + 1];
    if (c === '/' && s === '/') {
      while (i < n && kod[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && s === '*') {
      i += 2;
      while (i < n && !(kod[i] === '*' && kod[i + 1] === '/')) {
        if (kod[i] === '\n') cikti += '\n';
        i++;
      }
      i += 2;
      cikti += ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && kod[j] !== c) {
        if (kod[j] === '\\') j++;
        j++;
      }
      cikti += kod.slice(i, j + 1);
      i = j + 1;
      oncekiAnlamli = c;
      continue;
    }
    if (c === '/' && (oncekiAnlamli === '' || '(,=:[!&|?{};+-*%<>~^'.includes(oncekiAnlamli))) {
      let j = i + 1;
      let sinif = false;
      while (j < n && (sinif || kod[j] !== '/')) {
        if (kod[j] === '\\') j++;
        else if (kod[j] === '[') sinif = true;
        else if (kod[j] === ']') sinif = false;
        else if (kod[j] === '\n') break;
        j++;
      }
      cikti += kod.slice(i, j + 1);
      i = j + 1;
      oncekiAnlamli = '/';
      continue;
    }
    cikti += c;
    if (!/\s/.test(c)) oncekiAnlamli = c;
    i++;
  }
  return cikti;
}

type Dosya = { yol: string; goreli: string; kod: string };

function uretimDosyalari(): Dosya[] {
  return dosyalariTopla(SRC, /\.ts$/)
    .filter((y) => !y.endsWith('.test.ts'))
    .map((yol) => ({ yol, goreli: relative(SRC, yol).split(sep).join('/'), kod: yorumlariAyikla(readFileSync(yol, 'utf8')) }));
}

const DOSYALAR = uretimDosyalari();
const altDizinde = (d: Dosya, dizin: string): boolean => d.goreli.startsWith(`${dizin}/`);
function ihlaller(dosyalar: readonly Dosya[], desen: RegExp): string[] {
  return dosyalar.filter((d) => desen.test(d.kod)).map((d) => d.goreli);
}

describe('yorumlariAyikla (tarayıcının kendisi)', () => {
  it('satır ve blok yorumlarını atar, metin değişmezlerini korur', () => {
    const k = yorumlariAyikla("const a = 1; // console.log(1)\n/* process.env */ const b = 'console.log';\nconst c = `fetch(`;");
    expect(k).not.toContain('process.env');
    expect(k).not.toMatch(/\/\/ console/);
    expect(k).toContain("'console.log'");
    expect(k).toContain('`fetch(`');
  });
  it('metin içindeki // yorum sayılmaz (URL)', () => {
    expect(yorumlariAyikla("const u = 'https://ornek.invalid'; console.log(1);")).toContain('console.log(1)');
  });
  it('düzenli ifade değişmezi içindeki tırnak metin başlatmaz', () => {
    const k = yorumlariAyikla("const r = /[\\s'`]+/g; console.log(1); // yorum");
    expect(k).toContain('console.log(1)');
    expect(k).not.toContain('yorum');
  });
  it('blok yorum satır sayısını korur', () => {
    expect(yorumlariAyikla('a\n/* x\ny\nz */\nb').split('\n')).toHaveLength(5);
  });
  it('gerçek kaynaklardan beklenen yorum dışı kullanımları yakalar (tarayıcı kör değil)', () => {
    expect(DOSYALAR.find((d) => d.goreli === 'cikti.ts')!.kod).toContain('process.stdout');
    expect(DOSYALAR.find((d) => d.goreli === 'ayar.ts')!.kod).toContain('process.env');
    expect(DOSYALAR.find((d) => d.goreli === 'yazici/supabase-yazici.ts')!.kod).toContain('@supabase/supabase-js');
    expect(DOSYALAR.find((d) => d.goreli === 'donusum/tarih-hesap.ts')!.kod).not.toContain('Date.now');
  });
});

describe('katman koruma: tarama kapsamı', () => {
  it('beklenen üretim dizinleri taranıyor', () => {
    for (const d of ['donusum', 'plan', 'girdi', 'guvenlik', 'rapor', 'komut', 'yazici']) expect(DOSYALAR.some((x) => altDizinde(x, d)), d).toBe(true);
    expect(DOSYALAR.length).toBeGreaterThan(40);
    expect(DOSYALAR.some((d) => d.goreli.endsWith('.test.ts'))).toBe(false);
  });
});

describe('katman koruma: donusum/ ve plan/ saf kalır', () => {
  const saf = DOSYALAR.filter((d) => altDizinde(d, 'donusum') || altDizinde(d, 'plan'));
  it('saf dizinlerde dosya vardır', () => {
    expect(saf.length).toBeGreaterThan(10);
  });
  it.each([
    ['node:fs', /node:fs/],
    ['fetch(', /fetch\(/],
    ['process.env', /process\.env/],
    ['console.', /console\./],
    ['@supabase/supabase-js', /@supabase\/supabase-js/],
    ['herhangi bir node: içe aktarımı', /from\s+['"]node:/],
    ['process. (herhangi)', /\bprocess\./],
    ['import.meta', /import\.meta/],
    ['Date.now()', /Date\.now\(/],
    ['new Date() (argümansız, saat okuma)', /new Date\(\s*\)/],
    ['Math.random()', /Math\.random\(/],
    ['require(', /\brequire\(/],
    ['dinamik import', /\bimport\(/],
  ])('%s yok', (_ad, desen) => {
    expect(ihlaller(saf, desen)).toEqual([]);
  });
  it('yukarı katmanlara (yazici, komut, cikti, ayar, cli, rapor) bağımlı değildir', () => {
    const yasak = /from\s+['"](?:\.\.?\/)+(?:yazici\/|komut\/|rapor\/|cikti\.ts|ayar\.ts|cli\.ts)/;
    expect(ihlaller(saf, yasak)).toEqual([]);
  });
});

describe('katman koruma: tek çıktı kapısı (cikti.ts)', () => {
  const digerleri = DOSYALAR.filter((d) => d.goreli !== 'cikti.ts');
  it('console. yalnız cikti.ts içinde de yoktur (hiç kullanılmaz)', () => {
    expect(ihlaller(DOSYALAR, /console\./)).toEqual([]);
  });
  it('process.stdout yalnız cikti.ts içindedir', () => {
    expect(ihlaller(digerleri, /process\.stdout/)).toEqual([]);
    expect(ihlaller(DOSYALAR, /process\.stdout/)).toEqual(['cikti.ts']);
  });
  it('process.stderr hiçbir yerde kullanılmaz', () => {
    expect(ihlaller(DOSYALAR, /process\.stderr/)).toEqual([]);
  });
  it('doğrudan dosya akışı yazımı (writeFile/appendFile/createWriteStream) yalnız cikti.ts içindedir', () => {
    expect(ihlaller(digerleri, /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\b/)).toEqual([]);
  });
});

describe('katman koruma: process.env yalnız ayar.ts içinde', () => {
  it('başka hiçbir üretim dosyasında yoktur', () => {
    expect(ihlaller(DOSYALAR, /process\.env/)).toEqual(['ayar.ts']);
  });
  it('.env dosyası okunmaz, dotenv kullanılmaz', () => {
    expect(ihlaller(DOSYALAR, /dotenv|['"`][^'"`]*\.env(?:\.[a-z]+)?['"`]/)).toEqual([]);
  });
});

describe('katman koruma: ağ yalnız yazici/ içinde', () => {
  const disarida = DOSYALAR.filter((d) => !altDizinde(d, 'yazici'));
  it('fetch yalnız yazici/ içindedir', () => {
    expect(ihlaller(disarida, /\bfetch\b/)).toEqual([]);
  });
  it('@supabase/supabase-js yalnız yazici/ içinden içe aktarılır', () => {
    expect(ihlaller(disarida, /@supabase\//)).toEqual([]);
    expect(DOSYALAR.filter((d) => /@supabase\//.test(d.kod)).map((d) => d.goreli).sort()).toEqual(['yazici/oturum.ts', 'yazici/statik-yukleyici.ts', 'yazici/supabase-yazici.ts']);
  });
  it('başka ağ modülleri (http, https, net, dns, tls, XMLHttpRequest, WebSocket) hiçbir yerde yoktur', () => {
    expect(ihlaller(DOSYALAR, /node:(?:http|https|http2|net|dns|tls|dgram)\b|XMLHttpRequest|\bWebSocket\b/)).toEqual([]);
  });
  it('child_process / eval / Function kurucusu yoktur', () => {
    expect(ihlaller(DOSYALAR, /node:child_process|\beval\(|new Function\(/)).toEqual([]);
  });
});

describe('katman koruma: dosya sistemi yalnız girdi/ ve cikti.ts içinde', () => {
  it('node:fs içe aktaran dosyalar beyaz listededir', () => {
    expect(DOSYALAR.filter((d) => /node:fs/.test(d.kod)).map((d) => d.goreli).sort()).toEqual(['cikti.ts', 'girdi/dosya-oku.ts', 'girdi/statik-tara.ts']);
  });
  it('sembolik bağlantı izlenmez, silme/taşıma/kopyalama çağrısı yoktur', () => {
    expect(ihlaller(DOSYALAR, /\b(?:unlinkSync|unlink|rmSync|rm|rmdirSync|renameSync|copyFileSync|cpSync|symlinkSync|chmodSync)\(/)).toEqual([]);
  });
});

describe('katman koruma: tools/ içinden apps/web/src içe aktarılmaz', () => {
  const uygulamaYolu = /(?:from|import|require)\s*\(?\s*['"][^'"]*apps[\\/]web[^'"]*['"]/;
  const jsonYolu = new RegExp(['apps', 'web'].join('/'));
  /* Bu dosya kendi örnek metinlerini (tarayıcı sağlaması) içerir: kendini taramaz. */
  const BU_DOSYA = fileURLToPath(import.meta.url);
  const tumTs = dosyalariTopla(TOOLS, /\.(?:ts|js|mjs|json)$/).filter((y) => !y.endsWith('package-lock.json') && y !== BU_DOSYA);
  it('hiçbir içe aktarma ve yapılandırma dosyası uygulama paketine (apps/web) atıf yapmaz', () => {
    const kotu = tumTs.filter((y) => (y.endsWith('.json') ? jsonYolu.test(readFileSync(y, 'utf8')) : uygulamaYolu.test(yorumlariAyikla(readFileSync(y, 'utf8')))));
    expect(kotu.map((y) => relative(TOOLS, y))).toEqual([]);
  });
  it('yasaklı içe aktarma deseni gerçekten yakalar (tarayıcı kör değil)', () => {
    expect(uygulamaYolu.test("import { x } from '../../../../apps/web/src/veri/panel';")).toBe(true);
    expect(uygulamaYolu.test('const m = await import("../../apps/web/api/x.js");')).toBe(true);
    expect(uygulamaYolu.test("import { y } from './yerel.ts';")).toBe(false);
  });
  it('göreli içe aktarmaların hiçbiri paket dizininin dışına çıkmaz', () => {
    const disina: string[] = [];
    for (const y of tumTs.filter((x) => x.endsWith('.ts'))) {
      const kod = yorumlariAyikla(readFileSync(y, 'utf8'));
      for (const m of kod.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/g)) {
        const hedef = resolve(dirname(y), m[1]!);
        if (!hedef.startsWith(PAKET + sep) && hedef !== PAKET) disina.push(`${relative(TOOLS, y)} -> ${m[1]}`);
      }
    }
    expect(disina).toEqual([]);
  });
  it('göreli içe aktarmalar uzantılı (.ts) ve var olan dosyalara gider', () => {
    const kirik: string[] = [];
    for (const y of DOSYALAR) {
      for (const m of y.kod.matchAll(/(?:from)\s*['"](\.{1,2}\/[^'"]*)['"]/g)) {
        if (!m[1]!.endsWith('.ts') || !existsSync(resolve(dirname(y.yol), m[1]!))) kirik.push(`${y.goreli} -> ${m[1]}`);
      }
    }
    expect(kirik).toEqual([]);
  });
  it('bağımlılıklar yalnız supabase-js (çalışma) ve test araçlarıdır; apps/web paketine bağımlılık yoktur', () => {
    const pkg = JSON.parse(readFileSync(join(PAKET, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@supabase/supabase-js']);
    expect(Object.keys(pkg.devDependencies ?? {}).sort()).toEqual(['@astra/ortak-test', '@types/node', 'vitest']);
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((a) => a === '@astra/web')).toBe(false);
  });
});

describe('katman koruma: bağımlılık yönü', () => {
  function ice(d: Dosya): string[] {
    return [...d.kod.matchAll(/from\s*['"](\.{1,2}\/[^'"]*)['"]/g)].map((m) => relative(SRC, resolve(dirname(d.yol), m[1]!)).split(sep).join('/'));
  }
  const grup = (yol: string): string => (yol.includes('/') ? yol.split('/')[0]! : yol);

  it('girdi/ ve guvenlik/ yazici, komut, rapor, plan katmanlarına bağımlı değildir', () => {
    const yasak = new Set(['yazici', 'komut', 'rapor', 'plan', 'cikti.ts', 'ayar.ts', 'cli.ts']);
    for (const d of DOSYALAR.filter((x) => altDizinde(x, 'girdi') || altDizinde(x, 'guvenlik'))) {
      expect(ice(d).filter((h) => yasak.has(grup(h))), d.goreli).toEqual([]);
    }
  });
  it('guvenlik/ yalnız kendi içine (ve Node yerleşiklerine) bağımlıdır', () => {
    for (const d of DOSYALAR.filter((x) => altDizinde(x, 'guvenlik'))) expect(ice(d).filter((h) => grup(h) !== 'guvenlik'), d.goreli).toEqual([]);
  });
  it('rapor/ yalnız cikti.ts kapısı üzerinden yazar (rapor-yaz.ts)', () => {
    const rapor = DOSYALAR.find((d) => d.goreli === 'rapor/rapor-yaz.ts')!;
    expect(ice(rapor)).toContain('cikti.ts');
    expect(rapor.kod).not.toMatch(/node:|process\./);
  });
  it('yazici/ komut/ katmanına bağımlı değildir (komutlar yazıcıya bağlıdır, tersi değil)', () => {
    for (const d of DOSYALAR.filter((x) => altDizinde(x, 'yazici'))) expect(ice(d).filter((h) => grup(h) === 'komut'), d.goreli).toEqual([]);
  });
  it('yalnız cli.ts gerçek yazıcıyı (supabase-yazici, statik-yukleyici) kurar', () => {
    const gercek = /supabase-yazici\.ts|statik-yukleyici\.ts/;
    const kullananlar = DOSYALAR.filter((d) => !altDizinde(d, 'yazici') && ice(d).some((h) => gercek.test(h))).map((d) => d.goreli);
    /* komutlar yalnız türleri (type import) kullanır; gerçek kurucuyu yalnız cli.ts çağırır */
    const gercekKuranlar = DOSYALAR.filter((d) => !altDizinde(d, 'yazici') && /\b(?:supabaseYaziciAc|supabaseStatikYukleyiciAc|supabaseYaziciOlustur|istemciKur|createClient)\b/.test(d.kod)).map((d) => d.goreli);
    expect(gercekKuranlar).toEqual(['cli.ts']);
    expect(kullananlar).toContain('cli.ts');
  });
  it('sır tutan Gizli sarmalayıcı ayar.ts dışında yeniden tanımlanmaz', () => {
    expect(ihlaller(DOSYALAR, /class\s+Gizli\b/)).toEqual(['ayar.ts']);
  });
});

describe('katman koruma: ortam değişkeni adları', () => {
  it('ASTRA_* ortam adları yalnız ortam-adlari.ts içinde tanımlıdır (metin değişmezi olarak)', () => {
    const tanimlayan = DOSYALAR.filter((d) => /['"`]ASTRA_(?:SUPABASE_URL|SUPABASE_ANON|PIN|SERVIS_ANAHTARI)['"`]/.test(d.kod)).map((d) => d.goreli);
    expect(tanimlayan).toEqual(['guvenlik/ortam-adlari.ts']);
  });
});

describe('depo hijyeni: .gitignore kaynak dosyalarını dışlamaz', () => {
  /* Küçük .gitignore eşleyici: yorum satırları, `dizin/`, `*.uzanti`, kök-bağlı `/ad` ve düz ad desenlerini destekler (bu pakette kullanılanlar). */
  function desenRegex(desen: string): RegExp {
    const kacis = desen.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
    return new RegExp(`^${kacis}$`);
  }
  function dislaniyorMu(goreliYol: string, desenler: readonly string[]): string | null {
    const parcalar = goreliYol.split('/');
    for (const ham of desenler) {
      const dizinDesen = ham.endsWith('/');
      const govde = dizinDesen ? ham.slice(0, -1) : ham;
      const kokBagli = govde.startsWith('/');
      const re = desenRegex(kokBagli ? govde.slice(1) : govde);
      if (govde.replace(/^\//, '').includes('/')) {
        if (re.test(goreliYol)) return ham;
        continue;
      }
      /* dizin desenleri yalnız üst dizin bölümleriyle, dosya desenleri her bölümle eşleşir; kök bağlı desen yalnız ilk bölümle */
      const uyeler = dizinDesen ? parcalar.slice(0, -1) : parcalar;
      const gecerli = kokBagli ? uyeler.slice(0, 1) : uyeler;
      if (gecerli.some((p) => re.test(p))) return ham;
    }
    return null;
  }
  const desenler = readFileSync(join(PAKET, '.gitignore'), 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '' && !s.startsWith('#') && !s.startsWith('!'));

  it('eşleyici bilinen örnekleri doğru sınıflar (sağlama)', () => {
    expect(dislaniyorMu('src/rapor/x.ts', ['rapor/'])).toBe('rapor/');
    expect(dislaniyorMu('src/rapor/x.ts', ['/rapor/'])).toBeNull();
    expect(dislaniyorMu('rapor/x.ts', ['/rapor/'])).toBe('/rapor/');
    expect(dislaniyorMu('src/a.yedek.json', ['*.yedek.json'])).toBe('*.yedek.json');
    expect(dislaniyorMu('src/komut/yaz.ts', ['rapor/', '*.durum.json'])).toBeNull();
    expect(dislaniyorMu('src/astra-notlar.json', ['astra-*.json'])).toBe('astra-*.json');
  });

  it('src/ altındaki hiçbir kaynak dosya .gitignore desenleriyle dışlanmaz (src/rapor/* depoya girmeli)', () => {
    const dislanan = dosyalariTopla(SRC, /./).map((y) => relative(PAKET, y).split(sep).join('/')).flatMap((y) => {
      const d = dislaniyorMu(y, desenler);
      return d === null ? [] : [`${y}  <-  "${d}"`];
    });
    expect(dislanan).toEqual([]);
  });

  it('hassas girdi/rapor dosyaları dışlanmaya devam eder (kök bağlı desen yeterli olmalı)', () => {
    for (const ad of ['x.yedek.json', 'x.durum.json', 'astra-yedek.json', 'aktarim-rapor-a.json']) expect(dislaniyorMu(ad, desenler), ad).not.toBeNull();
  });
});
