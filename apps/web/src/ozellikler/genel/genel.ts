import { h } from '../../ortak/dom';
import { degerSor } from '../../ortak/kutu';
import { bildir } from '../../ortak/bildirim';
import { bugunAnahtari, saatSatiri, selamlama, tarihSatiri, yilinGunu } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import {
  VARSAYILAN_HEDEF, VARSAYILAN_PROFIL, hedefGetir, hedefYaz, notDegistir, notEkle, notlariGetir, profilGetir, profilYaz,
  saglikGetir, saglikYaz, type Hedefler, type Not, type Profil, type Saglik,
} from '../../veri/karsilama';
import { havaGetir, kurGetir, sehirAra, type Hava, type Kur } from './dis-veri';
import { git } from '../../kabuk/yonlendirici';

const IPUCLARI = [
  'Su hayattır{n}, bugün bol su içtiğinden emin ol! 💧✨',
  'Bugün tek bir icra dosyasını doğrula{n} — 30 günden eski bakiye, yanlış karar demek. ⚖',
  'En yüksek faizli borç her gün büyüyor{n}. Bugün ona bir taksit fazladan git. 🔥',
  'Anaparaya dokunma{n} — yalnız getirisi borca gitsin, çekirdek sermaye korunsun. 🛡',
  'Bugün bir tedarikçiyle iskonto konuş{n}; %30 indirim, 3 ay ödeme demek. 🤝',
  'Harcamayı anında gir{n} — akşam hatırlamadığın gider, ay sonu açığın olur. 📝',
  'Taksit tarihleri yaklaştı mı? Sırada Ne Var sekmesi 3 saniyede söyler{n}. ⏭',
  'Gelirini artırmak, gideri kısmaktan daha hızlı sonuç verir{n}. Bugün bir teklif çıkar. 🚀',
  'Alınacaklar listesindeki bir kalemi ertele{n} — nakit, ekipmandan önce gelir. 🧺',
  'Kur oynadıysa dolar bazlı borçların bugün yeniden hesaplanmalı{n}. 💵',
  'Küçük dosyaları kapat{n} — psikolojik hafiflik, matematiksel hafiflikten önce gelir. ✅',
  'Bugün 10 dakika yürü{n}; en iyi finansal kararlar dinlenmiş kafayla alınır. 👣',
  'Mevduat vadesi dolan var mı? Oran düşmeden yenile{n}. %',
  'Z raporunu ayın son günü al{n} — dondurulmuş rakam, dürüst rakamdır. 📌',
];

type Durum = {
  profil: Profil; hedef: Hedefler; hava: Hava | null; havaHata: boolean; kur: Kur | null; kurHata: boolean;
  saglik: Saglik | null; notlar: Not[]; hata: string; ipucuKaydirma: number;
};

let saatKimligi = 0;
const yas = (t: number | undefined) => {
  if (!t) return 'hiç güncellenmedi';
  const dk = Math.round((Date.now() - t) / 60000);
  return dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : `${Math.round(dk / 60)} sa önce`;
};
const sayi = (n: number | null | undefined) => (n ?? 0).toLocaleString('tr-TR');

export function genelBakisSayfasi(kok: HTMLElement) {
  const d: Durum = {
    profil: VARSAYILAN_PROFIL, hedef: VARSAYILAN_HEDEF, hava: null, havaHata: false, kur: null, kurHata: false,
    saglik: null, notlar: [], hata: '', ipucuKaydirma: 0,
  };
  const gun = () => bugunAnahtari();

  /* ---------- çizim ---------- */
  function ciz() {
    const w = h('div', { sinif: 'wel' });
    w.append(baslik(), karolar(), ikiliSira1(), ikiliSira2());
    kok.replaceChildren(w);
  }

  function baslik() {
    const adSpan = h('span', { sinif: 'nm', baslik: 'adını değiştir', tikla: () => void adDegistir() }, d.profil.ad || 'adını ekle');
    const hava = d.hava;
    return h('div', { sinif: 'welhead' },
      h('div', {},
        h('div', { sinif: 'weldate', id: 'weldate' }, tarihSatiri()),
        h('div', { sinif: 'welgreet' }, h('span', { id: 'welgreet' }, selamlama()), d.profil.ad ? ', ' : ' · ', adSpan),
        h('div', { sinif: 'welclock', id: 'welclock' }, saatSatiri())),
      h('div', { sinif: 'welacts' },
        h('span', { sinif: 'wpill' }, h('span', { sinif: 'wdot' }), `${d.profil.sehir.etiket} · ${hava ? `${hava.simge} ${hava.temp >= 0 ? '+' : ''}${hava.temp}°C` : '—'}`),
        h('button', { sinif: 'wpill', tip: 'button', baslik: 'hava ve kuru yenile', tikla: () => void yenile(true) }, '⟳ canlı veri'),
        h('button', { sinif: 'wpill', tip: 'button', baslik: 'konumu değiştir', tikla: () => void konumDegistir() }, '📍 konum')));
  }

  function karo(simge: string, etiket: string, deger: Node | string, renk: string | null, ...satirlar: (Node | string | null)[]) {
    return h('div', { sinif: 'wcard' },
      h('div', { sinif: 'wtop' }, h('span', { sinif: 'wic' }, simge)),
      h('div', {}, h('div', { sinif: 'wl' }, etiket), h('div', { sinif: 'wv', stil: renk ? `color:${renk}` : '' }, deger),
        ...satirlar.map(s => (s ? h('div', { sinif: 'ws' }, s) : null))));
  }

  function karolar() {
    const hv = d.hava, k = d.kur;
    const yenileDugme = (f: () => void) => h('button', { sinif: 'wref', tip: 'button', tikla: f }, 'yenile');
    const havaKaro = karo(hv?.simge ?? '🌤️', 'Hava Durumu',
      hv ? h('span', {}, `${hv.temp >= 0 ? '+' : ''}${hv.temp}°C `, h('span', { stil: 'font-size:11px;color:var(--dim);font-weight:400' }, hv.aciklama)) : (d.havaHata ? 'alınamadı' : '—'),
      'var(--cyan)',
      hv ? `hissedilen ${hv.hissedilen}°${hv.yuksek !== null ? ` · ↑${hv.yuksek}° ↓${hv.dusuk}°` : ''}` : null,
      hv ? `💨 ${hv.ruzgar} km/s · %${hv.nem} nem${hv.dogus ? ` · 🌅 ${hv.dogus} 🌇 ${hv.batis}` : ''}` : null);
    havaKaro.querySelector('.wtop')!.append(yenileDugme(() => void havaYenile(true)));

    const kurKaro = karo('💵', 'Dolar & Euro',
      h('span', {}, `$${k ? k.usd.toFixed(2) : '—'} `, h('span', { stil: 'color:var(--dim);font-size:12.5px' }, '· '), `€${k?.eur ? k.eur.toFixed(2) : '—'}`),
      'var(--gold)',
      k?.gramAltin ? `gram altın ₺${k.gramAltin.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (d.kurHata ? 'kur alınamadı' : null),
      k ? yas(k.zaman) : null);
    kurKaro.querySelector('.wtop')!.append(yenileDugme(() => void kurYenile(true)));

    const bekleyen = (simge: string, etiket: string, not: string) => karo(simge, etiket, '—', 'var(--dim)', not);
    return h('div', { sinif: 'welgrid' }, havaKaro, kurKaro,
      bekleyen('🎯', 'Günün Puanı', 'finans verileri bağlanınca hesaplanır'),
      bekleyen('✓', 'Görevler', 'Yapılacaklar sayfası hazır olunca burada'));
  }

  function ipucu() {
    const ad = d.profil.ad ? ` ${d.profil.ad}` : '';
    return IPUCLARI[(yilinGunu() + d.ipucuKaydirma) % IPUCLARI.length]!.replace(/\{n\}/g, ad);
  }

  function ikiliSira1() {
    const hizli = (etiket: string, sinif: string, f: () => void) => h('button', { sinif: 'qb ' + sinif, tip: 'button', tikla: f }, etiket);
    return h('div', { sinif: 'grid g2', stil: 'margin-bottom:18px' },
      h('div', { sinif: 'wbanner' },
        h('div', { stil: 'position:relative' }, h('div', { sinif: 'wl', stil: 'color:var(--cyan)' }, `HATIRLATMA · ${tarihSatiri().split(', ')[1] ?? ''}`),
          h('h3', {}, 'Günün Hatırlatması'), h('div', { sinif: 'weltip' }, ipucu())),
        h('div', { sinif: 'welfb' }, h('div', {}, 'Günlük kayıtlar biriktikçe burada geçmişle karşılaştırma çıkacak.'),
          h('div', { stil: 'margin-top:6px' }, h('button', { sinif: 'wref', tip: 'button', tikla: () => { d.ipucuKaydirma++; ciz(); } }, '↻ başka bir hatırlatma')))),
      h('div', { sinif: 'card', stil: 'margin-bottom:0' },
        h('h2', { stil: 'font-size:15.5px' }, 'Hızlı İşlemler'),
        h('div', { sinif: 'hint', stil: 'font-size:12.5px' }, 'Karşılama panelinden tek tıkla kayıt aç.'),
        h('div', { sinif: 'welq' },
          hizli('💰 Harcama', 'gold', () => git('gider')),
          hizli('📝 Not Ekle', '', () => void notEkleSor()),
          hizli('📌 Görev Ekle', '', () => git('todo')),
          hizli('💧 +250ml Su', 'cyan', () => void suEkle(250)),
          hizli('₺ Borç Ödemesi', 'red', () => git('borc')),
          hizli('⏭ Sırada Ne Var', '', () => git('sirada')),
          hizli('🧺 Market Listesi', '', () => git('market')),
          hizli('🧩 Modül Merkezi', '', () => git('hub')),
          hizli('⟳ Kur & Hava', '', () => void yenile(true)))));
  }

  function ikiliSira2() {
    const s = d.saglik;
    const hedefSu = d.hedef.su;
    const su = s?.su_ml ?? 0;
    const yuzde = Math.min(100, Math.round((su / Math.max(1, hedefSu)) * 100));
    const hucre = (simge: string, deger: string, alt: string, f: () => void) =>
      h('div', { sinif: 'hcell', tikla: f }, h('span', {}, simge), h('b', {}, deger), h('i', {}, alt));
    const bar = h('div', { sinif: 'bar', stil: 'margin-top:14px' }, h('i', { stil: `width:${yuzde}%` }));
    return h('div', { sinif: 'grid g2', stil: 'margin-bottom:18px' },
      h('div', { sinif: 'card', stil: 'margin-bottom:0' },
        h('h2', { stil: 'font-size:15.5px' }, 'Aktivite & Sağlık'),
        h('div', { sinif: 'hint', stil: 'font-size:12.5px' }, 'Hücreye tıklayarak düzenle. Adım, kalori ve su her gün 00:00\'da yeni güne geçer.'),
        h('div', { sinif: 'welh' },
          hucre('👣', sayi(s?.adim), 'adım', () => void saglikSor('adim', 'Adım sayısı', 'number')),
          hucre('🔥', sayi(s?.kalori), 'kcal', () => void saglikSor('kalori', 'Yakılan kalori (kcal)', 'number')),
          hucre('💧', `${su}ml`, '+250 ml', () => void suEkle(250)),
          hucre('😴', s?.uyku || '—', 'uyku', () => void saglikSor('uyku', 'Uyku süresi (örn. 7s 11dk)', 'text')),
          hucre('🩺', s?.tansiyon || '—', 'tansiyon', () => void saglikSor('tansiyon', 'Tansiyon (örn. 118/78)', 'text')),
          hucre('❤️', s?.nabiz ? String(s.nabiz) : '—', 'nabız', () => void saglikSor('nabiz', 'Nabız', 'number'))),
        bar,
        h('div', { sinif: 'ws' }, `su hedefi %${yuzde} — ${su}/${hedefSu} ml · `,
          h('button', { sinif: 'wref', tip: 'button', tikla: () => void suEkle(-250) }, '−250'), ' · ',
          h('button', { sinif: 'wref', tip: 'button', tikla: () => void hedefDegistir() }, 'hedefi düzenle'))),
      h('div', { sinif: 'card', stil: 'margin-bottom:0' },
        h('h2', { stil: 'font-size:15.5px' }, 'Hızlı Notlar'),
        h('div', { sinif: 'hint', stil: 'font-size:12.5px' }, 'Aklına geleni buraya bırak.'),
        ...(d.notlar.length ? d.notlar.slice(0, 6).map(n => h('div', { sinif: 'wnote' },
          h('p', {}, n.metin, h('em', {}, new Date(n.olusturma).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))),
          h('div', { stil: 'display:flex;gap:8px' }, h('button', { tip: 'button', baslik: 'sil', tikla: () => void notSil(n) }, '✕'))))
          : [h('div', { sinif: 'ws' }, 'Henüz not yok — "📝 Not Ekle" ile başla.')]),
        d.notlar.length > 6 ? h('div', { sinif: 'ws' }, `+${d.notlar.length - 6} not daha kayıtlı`) : null,
        h('button', { sinif: 'btn ghost', tip: 'button', stil: 'margin-top:10px;width:100%', tikla: () => void notEkleSor() }, '＋ Yeni Not')));
  }

  /* ---------- işlemler ---------- */
  const hataBildir = (e: unknown) => bildir(hataMetni(e), undefined, true);

  async function adDegistir() {
    const v = await degerSor({ baslik: 'Adını değiştir', etiket: 'Adın', deger: d.profil.ad, sinir: 40, ipucu: 'Karşılama selamında kullanılır.' });
    if (v === null) return;
    try { d.profil = { ...d.profil, ad: v.trim() }; await profilYaz(d.profil); ciz(); } catch (e) { hataBildir(e); }
  }

  async function konumDegistir() {
    const v = await degerSor({ baslik: 'Konumu değiştir', etiket: 'Şehir', deger: '', kaydet: 'Ara', ipucu: 'Hava durumu bu konuma göre gelir.' });
    if (!v?.trim()) return;
    try {
      const bulunan = await sehirAra(v.trim());
      if (!bulunan.length) { bildir('Şehir bulunamadı.', undefined, true); return; }
      const sec = bulunan[0]!;
      d.profil = { ...d.profil, sehir: sec };
      await profilYaz(d.profil);
      bildir(`Konum: ${sec.etiket}`);
      await havaYenile(true);
    } catch (e) { hataBildir(e); }
  }

  async function saglikSor(alan: 'adim' | 'kalori' | 'uyku' | 'tansiyon' | 'nabiz', baslik: string, tip: 'number' | 'text') {
    const v = await degerSor({ baslik, etiket: baslik, tip, deger: String(d.saglik?.[alan] ?? '') });
    if (v === null) return;
    const deger = tip === 'number' ? (v.trim() === '' ? null : Math.max(0, Math.round(Number(v)))) : (v.trim() || null);
    if (tip === 'number' && deger !== null && Number.isNaN(deger)) { bildir('Geçerli bir sayı gir.', undefined, true); return; }
    try { d.saglik = await saglikYaz(gun(), { [alan]: deger }); ciz(); } catch (e) { hataBildir(e); }
  }

  async function suEkle(ml: number) {
    const yeni = Math.max(0, (d.saglik?.su_ml ?? 0) + ml);
    try { d.saglik = await saglikYaz(gun(), { su_ml: yeni }); ciz(); } catch (e) { hataBildir(e); }
  }

  async function hedefDegistir() {
    const v = await degerSor({ baslik: 'Günlük su hedefi', etiket: 'Hedef (ml)', tip: 'number', deger: String(d.hedef.su) });
    if (v === null) return;
    const n = Math.round(Number(v));
    if (!(n >= 250 && n <= 10000)) { bildir('Hedef 250 ile 10000 ml arasında olmalı.', undefined, true); return; }
    try { d.hedef = { ...d.hedef, su: n }; await hedefYaz(d.hedef); ciz(); } catch (e) { hataBildir(e); }
  }

  async function notEkleSor() {
    const v = await degerSor({ baslik: 'Yeni not', etiket: 'Not', tip: 'textarea', sinir: 2000 });
    if (!v?.trim()) return;
    try { d.notlar = [await notEkle(v.trim()), ...d.notlar]; ciz(); bildir('Not eklendi'); } catch (e) { hataBildir(e); }
  }

  async function notSil(n: Not) {
    try {
      const silinen = await notDegistir(n.id, n.surum, { silindi_at: new Date().toISOString() });
      d.notlar = d.notlar.filter(x => x.id !== n.id); ciz();
      bildir('Not silindi', async () => {
        try { const geri = await notDegistir(silinen.id, silinen.surum, { silindi_at: null }); d.notlar = [geri, ...d.notlar].sort((a, b) => b.olusturma.localeCompare(a.olusturma)); ciz(); }
        catch (e) { hataBildir(e); }
      });
    } catch (e) { hataBildir(e); }
  }

  async function havaYenile(zorla = false) {
    try { d.hava = await havaGetir(d.profil.sehir.lat, d.profil.sehir.lon, zorla); d.havaHata = false; } catch { d.havaHata = true; }
    ciz();
  }
  async function kurYenile(zorla = false) {
    try { d.kur = await kurGetir(zorla); d.kurHata = false; } catch { d.kurHata = true; }
    ciz();
  }
  async function yenile(zorla: boolean) { await Promise.all([havaYenile(zorla), kurYenile(zorla)]); if (zorla) bildir(d.havaHata || d.kurHata ? 'Bazı canlı veriler alınamadı.' : 'Canlı veri güncellendi', undefined, d.havaHata || d.kurHata); }

  /* ---------- açılış ---------- */
  clearInterval(saatKimligi);
  saatKimligi = window.setInterval(() => {
    if (!kok.isConnected || !document.getElementById('welclock')) { clearInterval(saatKimligi); return; }
    document.getElementById('welclock')!.textContent = saatSatiri();
    document.getElementById('weldate')!.textContent = tarihSatiri();
    document.getElementById('welgreet')!.textContent = selamlama();
  }, 30000);

  ciz();
  void (async () => {
    const [p, hd, sg, nt] = await Promise.allSettled([profilGetir(), hedefGetir(), saglikGetir(gun()), notlariGetir()]);
    if (p.status === 'fulfilled') d.profil = p.value;
    if (hd.status === 'fulfilled') d.hedef = hd.value;
    if (sg.status === 'fulfilled') d.saglik = sg.value;
    if (nt.status === 'fulfilled') d.notlar = nt.value;
    const ilkHata = [p, hd, sg, nt].find(x => x.status === 'rejected') as PromiseRejectedResult | undefined;
    if (ilkHata) hataBildir(ilkHata.reason);
    ciz();
    void yenile(false);
  })();
}
