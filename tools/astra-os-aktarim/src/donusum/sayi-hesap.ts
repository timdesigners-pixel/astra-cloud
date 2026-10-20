/* tr-TR sayı/para çözümü. Neden yeni: `apps/web` içindeki `sayiOku` tarayıcı paketindedir ve `tools/` oradan import edemez (plan §1 katman kuralı); kural aynıdır. */

export type TutarSonucu = { tamam: true; deger: number } | { tamam: false; kod: 'GECERSIZ_TUTAR' };

/* Para/yüzde/birim süslerini (₺, TL, TRY, %) ve boşlukları temizler; işareti ayrı döner. Tanınmayan karakter → null. */
function temizle(ham: string): { negatif: boolean; govde: string } | null {
  const sus = /^(₺|try|tl|%)|(₺|try|tl|%)$/i;
  let s = ham.replace(/[\s\u00a0\u202f]+/g, '').replace(/\u2212/g, '-');
  while (sus.test(s)) s = s.replace(sus, '');
  let negatif = false;
  if (s.startsWith('-')) {
    negatif = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  /* İşaret simgeden önce gelebilir ('-₺5'): simge işaretten sonra tekrar atılır. */
  while (sus.test(s)) s = s.replace(sus, '');
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null;
  return { negatif, govde: s };
}

function binlikGruplariGecerli(parcalar: string[]): boolean {
  if (parcalar.length < 2) return true;
  if (!/^\d{1,3}$/.test(parcalar[0]!)) return false;
  return parcalar.slice(1).every((p) => /^\d{3}$/.test(p));
}

/* Sayısal metni (ya da sayıyı) çözer; geçersiz/boş → NaN. Kurallar (tr-TR):
   '1,234'→1.234 (tek virgül ondalık) · '1,234,567'→1234567 (çok gruplu virgül binlik) · '1.234,56'→1234.56 · '1,234.5'→1234.5 ·
   '1.234'→1234 (nokta gruplu binlik) · '12.5'→12.5 · '%12', '₺99', '12 TL', 'TRY 5' süsleri temizlenir. Belirsiz/bozuk gruplama → NaN. */
export function trSayi(girdi: unknown): number {
  if (typeof girdi === 'number') return Number.isFinite(girdi) ? girdi : NaN;
  if (typeof girdi !== 'string') return NaN;
  const t = temizle(girdi);
  if (t === null) return NaN;
  const g = t.govde;
  const nokta = g.includes('.');
  const virgul = g.includes(',');
  let duz: string;

  if (nokta && virgul) {
    const ondalikAyirac = g.lastIndexOf(',') > g.lastIndexOf('.') ? ',' : '.';
    const binlikAyirac = ondalikAyirac === ',' ? '.' : ',';
    const bolum = g.split(ondalikAyirac);
    if (bolum.length !== 2 || !/^\d+$/.test(bolum[1]!)) return NaN;
    const binlikParca = bolum[0]!.split(binlikAyirac);
    if (!binlikGruplariGecerli(binlikParca)) return NaN;
    duz = binlikParca.join('') + '.' + bolum[1]!;
  } else if (virgul) {
    const parca = g.split(',');
    if (parca.length === 2) {
      if (!/^\d*$/.test(parca[0]!) || !/^\d+$/.test(parca[1]!)) return NaN;
      duz = (parca[0] === '' ? '0' : parca[0]!) + '.' + parca[1]!;
    } else {
      if (!binlikGruplariGecerli(parca)) return NaN;
      duz = parca.join('');
    }
  } else if (nokta) {
    const parca = g.split('.');
    if (parca.length > 2 || /^\d{1,3}(\.\d{3})+$/.test(g)) {
      if (!binlikGruplariGecerli(parca)) return NaN;
      duz = parca.join('');
    } else {
      if (!/^\d*$/.test(parca[0]!) || !/^\d+$/.test(parca[1]!)) return NaN;
      duz = (parca[0] === '' ? '0' : parca[0]!) + '.' + parca[1]!;
    }
  } else duz = g;

  const n = Number(duz);
  if (!Number.isFinite(n)) return NaN;
  return t.negatif ? -n : n;
}

/* `trSayi` sonucunu rapor koduyla döndürür: geçersiz/boş → GECERSIZ_TUTAR. */
export function tutarCoz(girdi: unknown): TutarSonucu {
  const n = trSayi(girdi);
  return Number.isFinite(n) ? { tamam: true, deger: n } : { tamam: false, kod: 'GECERSIZ_TUTAR' };
}

/* Tutarı tam sayı kuruşa çevirir (yarım-yukarı: sıfırdan uzağa, Postgres numeric(18,2) ile aynı). Ondalık metin üzerinden yuvarlanır, 1.005 → 101.
   Geçersiz/sonsuz ya da güvenli tamsayı sınırı dışı → NaN. */
export function kurusaCevir(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  const mutlak = Math.abs(n);
  const metin = String(mutlak);
  let kurus: number;
  if (metin.includes('e')) kurus = Math.round(mutlak * 100);
  else {
    const [tam = '0', kesir = ''] = metin.split('.');
    const yuz = BigInt(tam) * 100n + BigInt((kesir + '00').slice(0, 2));
    const yukari = kesir.length > 2 && kesir.charCodeAt(2) >= 53 ? 1n : 0n; /* üçüncü hane >= 5 */
    const toplam = yuz + yukari;
    if (toplam > BigInt(Number.MAX_SAFE_INTEGER)) return NaN;
    kurus = Number(toplam);
  }
  if (!Number.isSafeInteger(kurus)) return NaN;
  return n < 0 ? -kurus : kurus;
}

/* İki ondalık haneye yarım-yukarı yuvarlar (numeric(18,2) karşılığı). */
export function kurusYuvarla(n: number): number {
  const k = kurusaCevir(n);
  return Number.isNaN(k) ? NaN : k / 100;
}

/* Kontrol toplamı için tam sayı kuruş toplamı: geçersiz öğeler atlanır ve ayrıca sayılır (sessiz düşme yok). */
export function kurusToplami(tutarlar: readonly number[]): { kurus: number; gecersiz: number } {
  let kurus = 0;
  let gecersiz = 0;
  for (const t of tutarlar) {
    const k = kurusaCevir(t);
    if (Number.isNaN(k)) gecersiz++;
    else kurus += k;
  }
  return { kurus, gecersiz };
}
