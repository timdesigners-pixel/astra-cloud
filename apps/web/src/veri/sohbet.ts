import { istemciAl } from './istemci';

export type SohbetRolu = 'genel_finans' | 'icra_hukuk' | 'sermaye_strateji' | 'butce_denetci';
export const SOHBET_ROLLERI: [SohbetRolu, string, string][] = [
  ['genel_finans', 'Genel finans danışmanı', 'Bütçe dengesi, nakit akışı ve genel rehberlik'],
  ['icra_hukuk', 'İcra ve hukuk analisti', 'Tebligat süreleri, haciz, taksitlendirme ve yasal risk'],
  ['sermaye_strateji', 'Sermaye ve yatırım stratejisti', 'Kasa dağıtımı, kur, enflasyon ve likidite'],
  ['butce_denetci', 'Bütçe ve tasarruf denetçisi', 'Sabit giderler, abonelikler ve tasarruf'],
];
export type Mesaj = { rol: 'user' | 'model'; metin: string };

/* Sunucu ucu /api/sohbet: yalnız oturum jetonuyla çalışır; finans özeti ancak kullanıcı istediğinde bağlam olarak gider. */
export async function sohbetEt(rol: SohbetRolu, mesajlar: Mesaj[], baglam: string): Promise<{ yanit: string; model: string }> {
  const { data } = await istemciAl().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Oturum yok');
  const r = await fetch('/api/sohbet', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify({ rol, mesajlar, baglam }) });
  const v = await r.json().catch(() => ({})) as { error?: string; anahtarYok?: boolean; yanit?: string; model?: string };
  if (!r.ok || !v.yanit) throw new Error(v.anahtarYok ? 'Yapay zekâ için sunucuda GEMINI_API_KEY tanımlı olmalı.' : v.error || `Yanıt alınamadı (${r.status})`);
  return { yanit: v.yanit, model: v.model ?? '' };
}
