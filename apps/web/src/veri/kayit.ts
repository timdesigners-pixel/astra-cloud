import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';

export type Kayit = { id: string; surum: number; [alan: string]: unknown };
export type Filtre = Record<string, string | number | boolean>;

/* Sütun yetkileri tek tek verildiği için "*" yerine sütun listesi gerekir. */
export async function kayitlariGetir(tablo: string, sutunlar: string[], filtre: Filtre, sirala: string): Promise<Kayit[]> {
  const kayitlar: Kayit[] = [];
  const sayfaBoyu = 1000;
  for (let baslangic = 0; ; baslangic += sayfaBoyu) {
    let s = istemciAl().from(tablo).select(['id', 'surum', ...sutunlar].join(',')).is('silindi_at', null);
    for (const [k, v] of Object.entries(filtre)) s = s.eq(k, v);
    s = s.order(sirala);
    // Aynı sıradaki sayfalar sınırda kaybolmasın: eşit değerlerde kimlik belirleyicidir.
    if (sirala !== 'id') s = s.order('id');
    const { data, error } = await s.range(baslangic, baslangic + sayfaBoyu - 1);
    if (error) throw error;
    kayitlar.push(...((data ?? []) as unknown as Kayit[]));
    if (!data || data.length < sayfaBoyu) return kayitlar;
  }
}

export async function kayitEkle(tablo: string, sutunlar: string[], g: Record<string, unknown>): Promise<Kayit> {
  const { data, error } = await istemciAl().from(tablo).insert(g).select(['id', 'surum', ...sutunlar].join(',')).single();
  if (error) throw error;
  return data as unknown as Kayit;
}

/* İyimser kilit: yalnız görülen sürüm hâlâ güncelse yazılır. */
export async function kayitGuncelle(tablo: string, sutunlar: string[], id: string, surum: number, g: Record<string, unknown>): Promise<Kayit> {
  const { data, error } = await istemciAl().from(tablo).update(g).eq('id', id).eq('surum', surum).select(['id', 'surum', ...sutunlar].join(','));
  if (error) throw error;
  if (!data || data.length === 0) throw new CakismaHatasi();
  return data[0] as unknown as Kayit;
}
