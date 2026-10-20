/* Komutların dış dünyaya bağımlılıkları (enjeksiyon): testler gerçek ağ/dosya/saat olmadan çalıştırır. */
import type { Ortam } from '../ayar.ts';
import type { YaziciFabrikasi } from '../yazici/yazici-arayuzu.ts';
import type { PlanKaynagi } from './plan-kur.ts';

export type Bagimlilik = {
  /* Ortam değişkenleri (yalnız ASTRA_SUPABASE_URL okunur; verilmezse `ayar.ts` süreç ortamını kullanır). */
  ortam?: Ortam;
  /* Ağ/kimlik gerektiren yazıcıyı kurar. YALNIZ onay doğrulandıktan sonra çağrılır. */
  yaziciKur: YaziciFabrikasi;
  aracSurumu: string;
  simdi: () => Date;
  uuidUret: () => string;
  planKaynagi?: PlanKaynagi;
};
