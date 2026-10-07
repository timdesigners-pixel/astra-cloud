import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { bugunAnahtari } from '../../ortak/zaman';
import { SURUM } from '../../kapi/surum';
import { donem } from '../../kabuk/donem';
import { duzMenu } from '../../kabuk/menu-durum';
import { temaAd } from '../../kabuk/tema';
import { hataMetni } from '../../veri/hata';
import { istemciAl } from '../../veri/istemci';
import { ayarYaz } from '../../veri/karsilama';
import { panelGetir, panelSifirla, type Panel } from '../../veri/panel';
import { YEDEK_TABLOLARI } from './yedek-tablolari';

const SAYFA = 1000;

/* Bir tabloyu sayfa sayfa okur (sunucu tek seferde en fazla 1000 satır verir). */
async function tabloOku(tablo: string, kolonlar: string): Promise<unknown[]> {
  const hepsi: unknown[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await istemciAl().from(tablo).select(kolonlar).order('olusturma').order('id').range(bas, bas + SAYFA - 1);
    if (error) throw error;
    hepsi.push(...(data ?? []));
    if (!data || data.length < SAYFA) return hepsi;
  }
}

export async function yedekOlustur(): Promise<{ icerik: Record<string, unknown[]>; satir: number }> {
  const adlar = Object.keys(YEDEK_TABLOLARI);
  const sonuc = await Promise.all(adlar.map(a => tabloOku(a, YEDEK_TABLOLARI[a]!)));
  const icerik: Record<string, unknown[]> = {};
  adlar.forEach((a, i) => { icerik[a] = sonuc[i]!; });
  return { icerik, satir: sonuc.reduce((t, l) => t + l.length, 0) };
}

function dosyaIndir(ad: string, veri: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' }));
  const a = el('a'); a.href = url; a.download = ad; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function sistemSayfasi(kok: HTMLElement) {
  const kart = el('div', 'sistem');
  kok.replaceChildren(kart);
  let panel: Panel | null = null, hata = '', indiriliyor = false;

  const bolum = (baslik: string, ...cocuk: (Node | string)[]) => {
    const s = el('section', 'card sistem-bolum'); s.appendChild(el('h2', '', baslik)); s.append(...cocuk); return s;
  };
  const satir = (ad: string, not: string, ...dugme: HTMLElement[]) => {
    const r = el('div', 'sistem-satir'), m = el('div', 'sistem-metin');
    m.append(el('b', '', ad), el('small', '', not));
    const d = el('div', 'sistem-dugme'); d.append(...dugme); r.append(m, d); return r;
  };
  const islemDugme = (metin: string, islem: string, id: string) => {
    const b = el('button', 'btn', metin); b.type = 'button'; b.dataset.islem = islem; b.id = id; return b;
  };

  function ciz() {
    if (!kok.contains(kart)) return;
    const gorunum = bolum('Görünüm',
      satir('Tema', temaAd(), islemDugme('Temayı değiştir', 'tema', 'sis-tema')),
      satir('Gizlilik', 'Tutarları bulanıklaştırır (P tuşu da çalışır)', islemDugme(document.body.classList.contains('gizli') ? 'Gizliliği kapat' : 'Gizliliği aç', 'gizlilik', 'sis-gizlilik')),
      satir('Menü', 'Gruplu menü merkezlere ayrılmıştır; istersen eski düz listeye dön', islemDugme(duzMenu() ? 'Gruplu menüye geç' : 'Düz menüye geç', 'menu-tur', 'sis-menu')));

    const indir = el('button', 'btn primary', indiriliyor ? 'Hazırlanıyor…' : 'Yedeği indir'); indir.type = 'button'; indir.id = 'sis-yedek'; indir.disabled = indiriliyor;
    indir.addEventListener('click', () => void yedekAl());
    const yedekNotu = panel?.yedek ? `Son yedek: ${panel.yedek}` : 'Henüz yedek alınmadı';
    const yedek = bolum('Yedek',
      satir('Verileri dosyaya indir', `${yedekNotu}. Şifreler, IBAN numaraları, dosya numaraları ve abone numaraları yedeğe girmez.`, indir));

    const kontrol = bolum('Veri bütünlüğü');
    if (hata) kontrol.appendChild(el('p', 'bos hata', hata));
    else if (!panel) kontrol.appendChild(el('p', 'bos', 'Denetleniyor…'));
    else panel.kontroller.forEach(k => {
      const r = el('div', 'sistem-satir kontrol ' + (k.tamam ? 'tamam' : 'sorun'));
      r.append(el('span', 'kontrol-ikon', k.tamam ? '✓' : '✕'), el('div', 'sistem-metin'));
      r.lastElementChild!.append(el('b', '', k.ad), el('small', '', k.not)); kontrol.appendChild(r);
    });

    const kilit = el('button', 'btn', 'Kilitle'); kilit.type = 'button'; kilit.id = 'sis-kilit';
    kilit.addEventListener('click', () => location.reload());
    const hakkinda = bolum('Oturum ve sürüm',
      satir('Kilitle', 'Oturum yalnız bellekte tutulur; kilitleyince PIN yeniden istenir', kilit),
      satir('Sürüm', `${SURUM} · veriler bulutta saklanır, hassas alanlar sunucuda şifrelenir`));
    kart.replaceChildren(gorunum, yedek, kontrol, hakkinda);
  }

  async function yedekAl() {
    indiriliyor = true; ciz();
    try {
      const { icerik, satir } = await yedekOlustur();
      const bugun = bugunAnahtari();
      dosyaIndir(`astra-yedek-${bugun}.json`, { surum: SURUM, tarih: new Date().toISOString(), tablolar: icerik });
      await ayarYaz('son_yedek', { tarih: bugun });
      panelSifirla(); panel = await panelGetir(donem());
      bildir(`Yedek indirildi (${satir} kayıt)`);
    } catch (e) { bildir(hataMetni(e), undefined, true); }
    indiriliyor = false; ciz();
  }

  kok.addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('[data-islem]')) window.setTimeout(ciz, 0);
  });
  ciz();
  panelGetir(donem()).then(p => { panel = p; ciz(); }).catch(e => { hata = hataMetni(e); ciz(); });
}
