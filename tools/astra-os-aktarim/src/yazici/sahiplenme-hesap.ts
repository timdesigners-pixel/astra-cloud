/* Sahiplenme kuralları (plan §4.2). SAF: ağ/dosya/ortam yok. Kural özeti:
   - aktif eşleşme var → ATLA (TEKRAR_ESLESME);
   - hedefte aynı doğal anahtar var (`begeniler.kod`, `uygulama_durumu` anahtarı) → SAHIPLEN: yazma yok, yalnız eşleşme yazılır, hedef satır DEĞİŞMEZ;
   - hedefte birden çok aday varsa BELIRSIZ: otomatik birleştirme YOK, yazılmaz, raporlanır. */
import type { PlanKaydi } from '../plan/plan-tipleri.ts';

export type HedefDurumu = {
  /* uygulama kodu → hedefte var olan anahtar adları */
  uygulamaAnahtarlari: ReadonlyMap<string, ReadonlySet<string>>;
  /* begeniler.kod → o kodlu (silinmemiş) satır kimlikleri */
  begeniKodlari: ReadonlyMap<string, readonly string[]>;
};

export type SahiplenmeKarari =
  | { karar: 'ATLA' }
  | { karar: 'YAZ' }
  | { karar: 'SAHIPLEN'; hedef_id: string | null; hedef_ref: string | null }
  | { karar: 'BELIRSIZ' };

export function hedefDurumuKur(
  uygulamaAnahtarlari: Readonly<Record<string, readonly string[]>>,
  begeniler: readonly { id: string; kod: string }[],
): HedefDurumu {
  const uyg = new Map<string, ReadonlySet<string>>();
  for (const [uygulama, anahtarlar] of Object.entries(uygulamaAnahtarlari)) uyg.set(uygulama, new Set(anahtarlar));
  const kodlar = new Map<string, string[]>();
  for (const b of begeniler) {
    const liste = kodlar.get(b.kod);
    if (liste) liste.push(b.id);
    else kodlar.set(b.kod, [b.id]);
  }
  return { uygulamaAnahtarlari: uyg, begeniKodlari: kodlar };
}

/* Tek plan kaydı için karar. `eslesmeAktif`: (koleksiyon, kaynak_id) için silinmemiş eşleşme var mı. */
export function sahiplenmeKarariVer(kayit: PlanKaydi, eslesmeAktif: boolean, hedef: HedefDurumu): SahiplenmeKarari {
  if (eslesmeAktif) return { karar: 'ATLA' };
  if (kayit.tablo === 'uygulama_durumu') {
    const var_ = hedef.uygulamaAnahtarlari.get(kayit.uygulama)?.has(kayit.anahtar) === true;
    return var_ ? { karar: 'SAHIPLEN', hedef_id: null, hedef_ref: kayit.kaynak_id } : { karar: 'YAZ' };
  }
  const adaylar = hedef.begeniKodlari.get(kayit.satir.kod) ?? [];
  if (adaylar.length === 0) return { karar: 'YAZ' };
  if (adaylar.length === 1) return { karar: 'SAHIPLEN', hedef_id: adaylar[0]!, hedef_ref: null };
  return { karar: 'BELIRSIZ' };
}
