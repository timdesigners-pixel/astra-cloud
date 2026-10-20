/* Komutların dış dünyaya bağımlılıkları (enjeksiyon): testler gerçek ağ/dosya/saat olmadan çalıştırır. */
import type { Ortam } from '../ayar.ts';
import type { StatikTaramaSonucu } from '../girdi/statik-tara.ts';
import type { StatikYukleyiciFabrikasi } from '../yazici/statik-yukleyici.ts';
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
  /* statik-yukle: yükleyici (servis anahtarı) YALNIZ onay doğrulandıktan sonra kurulur; tarayıcı testlerde sahte verilebilir. */
  statikYukleyiciKur?: StatikYukleyiciFabrikasi;
  statikTara?: (kaynak: string) => StatikTaramaSonucu;
};
