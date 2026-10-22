/** Build a private, reviewable package; never import personal seeds into the web bundle. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source = path.resolve(process.argv[2] || '../astra-os');
const output = path.resolve(process.argv[3] || '../library-files/astra-os-transfer.json');
if (output.startsWith(path.resolve('apps/web') + path.sep)) throw Error('Özel veri web derlemesine yazılamaz.');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function seeds(name) {
  const text = fs.readFileSync(path.join(source, 'src/data/tohum', name + '.seed.js'), 'utf8');
  const names = [...text.matchAll(/export const (\w+)/g)].map(m => m[1]);
  const context = vm.createContext({ n: value => Number(value) || 0 });
  // Only trusted repository seed modules, never uploaded files or user text.
  vm.runInContext(text.replace(/^import .*;\s*$/mg, '').replace(/^export \{[^\n]+\} from [^\n]+;\s*$/mg, '').replace(/export const /g, 'const ') + '\nglobalThis.result={' + names.join(',') + '}', context, { timeout: 1000 });
  return JSON.parse(JSON.stringify(context.result));
}
const debts = seeds('debts'), legal = seeds('legal'), migrations = seeds('migrations');
const records = [], library = [], warnings = [];
const unique = new Set();
function add(kind, identity, data) {
  const key = kind + ':' + hash(identity);
  if (unique.has(key)) { warnings.push('Aynı kaynak kimliğine sahip tekrar atlandı: ' + kind); return; }
  unique.add(key); records.push({ kind, key, data });
}
for (const debt of debts.REAL_DEBTS) {
  // These enforcement balances overlap LEGAL_SEED. Preserve them in the archive,
  // but create financial balances only through linked icra_kaydet records.
  if (debt.cat === 'İcra') continue;
  const category = /banka/i.test(debt.cat) ? 'banka' : /sgk/i.test(debt.cat) ? 'sgk' : /vergi/i.test(debt.cat) ? 'vergi' : 'kisi';
  add('borc', debt.cat + '|' + debt.name, { ad: debt.name, tur: category, anapara: Math.max(0, Number(debt.amount) || 0), faiz_orani: Number(debt.rate) || 0, asgari: Number(debt.min) || 0, notlar: debt.note || '' });
}
for (const row of legal.LEGAL_SEED) {
  if (!row.no || !/\d{4}\//.test(row.no)) { warnings.push('Dosya numarası eksik icra arşivde korundu.'); continue; }
  add('icra', row.no, { dosya_no: row.no, icra_dairesi: row.dr || '', karsi_taraf: row.al || '', gercek_asil_alacak: Number(row.as) || 0,
    guncel_toplam_borc: Number(row.gn) || 0, faiz_orani: Number(row.fz) || 0, durum: 'acik' });
}
for (const row of legal.CASE_SEED) {
  if (!row.es?.trim()) { warnings.push('Dosya numarası eksik dava arşivde korundu.'); continue; }
  const kind = ['hukuk', 'ceza', 'cbs'].includes(row.t) ? row.t : 'hukuk';
  add('dava', kind + '|' + row.es, { dosya_no: row.es, tur: kind, mahkeme: row.mh || '', konu: row.ad || '', asama: row.as || '', notlar: row.nt || '' });
}
for (const row of migrations.TOHUM_GELIR || []) {
  if (row.cur && !/^(TRY|TL|₺)$/i.test(row.cur)) { warnings.push('TRY dışı gelir dönüştürülmeden arşivde korundu.'); continue; }
  add('gelir', row.ad, { ad: row.ad, tutar: Number(row.tutar) || 0, gun: Number(row.gun) || null, notlar: row.not || '', baslangic: row.from ? row.from + '-01' : null, bitis: row.to ? row.to + '-01' : null });
}
// Newest explicit expense seed supersedes the older versions; preserve all raw versions in archive.
for (const row of migrations.TOHUM_GIDER_V11 || []) {
  if (!Array.isArray(row) || typeof row[0] !== 'string' || !Number.isFinite(Number(row[1]))) { warnings.push('Eşlenemeyen gider arşivde korundu.'); continue; }
  add('gider', row[0], { ad: row[0], tutar: Math.max(0, Number(row[1])), tur: 'sabit', notlar: 'Astra OS kaynak kategorisi: ' + String(row[2] || '') });
}
for (const [ad, tutar, gun] of migrations.TOHUM_ABONELIK_V11 || []) add('gider', ad, { ad, tutar: Number(tutar), gun, tur: 'abonelik', notlar: 'Astra OS v11 abonelik kaydı' });
for (const [kind, folder] of [['pinterest', 'pinterest-panolarim'], ['youtube', 'oynatma-listelerim']]) {
  const html = fs.readFileSync(path.join(source, 'public/apps', folder, 'index.html'), 'utf8');
  const match = html.match(/<script type="application\/json" id="d">([\s\S]*?)<\/script>/);
  if (!match) throw Error('Kütüphane verisi bulunamadı: ' + folder);
  const data = JSON.parse(match[1]);
  for (const row of data.rows) library.push({ kind, id: String(row[0]), title: String(row[1] || 'Başlıksız içerik'),
    url: kind === 'youtube' ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(row[0]) : 'https://www.pinterest.com/pin/' + encodeURIComponent(row[0]) + '/',
    collections: Array.isArray(row[6]) ? row[6] : [], note: String(row[2] || '') });
}
// This source repository has no Instagram saved-items dataset or user file bytes.
warnings.push('Instagram kaydedilenler ve kullanıcı belge baytları depoda bulunamadı; uydurma kayıt eklenmedi.');
const archive = { debts: debts.REAL_DEBTS, legal, migrations, purchases: seeds('purchases'), latestPurchases: seeds('alim-v12'), hub: seeds('hub') };
const pkg = { format: 'astra-os-transfer', version: 1, generated: new Date().toISOString(), source: 'astra-os repository seeds', records, library, archive, warnings };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(pkg), { mode: 0o600 });
console.log(JSON.stringify({ output, sha256: hash(fs.readFileSync(output)), records: records.length, library: library.length, warnings: warnings.length }));
