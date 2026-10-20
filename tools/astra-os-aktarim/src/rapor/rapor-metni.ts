/* Raporu insan okuyabilir metne / JSON'a çevirir. Her zaman önce `raporDogrula` (beyaz liste) geçer. SAF. */
import { raporDogrula, type Rapor } from './rapor-sema.ts';

function kurusMetni(kurus: number): string {
  const isaret = kurus < 0 ? '-' : '';
  const m = Math.abs(kurus);
  return `${isaret}${Math.trunc(m / 100)}.${String(m % 100).padStart(2, '0')}`;
}

export function raporJsonu(r: Rapor): string {
  return JSON.stringify(raporDogrula(r), null, 2);
}

export function raporMetni(girdi: Rapor): string {
  const r = raporDogrula(girdi);
  const s: string[] = [];
  s.push(`ARAC ${r.arac_surumu} DALGA ${r.dalga} HEDEF ${r.hedef_proje_kisa ?? '-'} (${r.hedef_ref})`);
  s.push(`ONAY_KODU ${r.onay_kodu}`);
  const g = r.girdi_ozeti;
  s.push(`GIRDI mezar=${g.silinen_mezar_sayisi} bilinmeyen_anahtar=${g.bilinmeyen_anahtar_sayisi} gecersiz_kayit=${g.gecersiz_kayit_sayisi}`);
  for (const k of g.koleksiyon_sayilari) if (k.sayi > 0) s.push(`  koleksiyon ${k.koleksiyon}=${k.sayi}`);
  for (const t of r.hedef_tablolar) s.push(`TABLO ${t.tablo} yeni=${t.yeni} atlanan=${t.atlanan}`);
  for (const k of r.kontrol_toplamlari) s.push(`KONTROL ${k.ad} kurus=${k.kurus_toplami} (${kurusMetni(k.kurus_toplami)})`);
  for (const k of r.sayaclar) s.push(`SAYAC ${k.ad}=${k.sayi}`);
  for (const k of r.atlanan) s.push(`ATLANAN ${k.koleksiyon} ${k.neden_kodu} x${k.sayi}`);
  for (const k of r.uyarilar) s.push(`UYARI ${k.koleksiyon} ${k.neden_kodu} x${k.sayi}`);
  for (const b of r.bilgi_kodlari) s.push(`BILGI ${b}`);
  return s.join('\n');
}
