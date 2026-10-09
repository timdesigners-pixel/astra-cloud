import './posta.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { hataMetni } from '../../veri/hata';
import { baglananHesaplar, OturumDoldu } from '../../veri/gmail';
import { ETIKET_RENKLERI, gmailEtiketAdi, kuralOner, siniflandir, type Kural, type KuralOnerisi, type Siniflama } from '../../veri/gmail-etiketleyici';
import {
  etiketKimligi, etiketUygula, etiketleyiciAyarGetir, etiketleyiciAyarYaz, etiketlenenleriGetir, etiketlenenleriYaz, govdeOnizleme, kurallariGetir, kurallariYaz, postaListele,
  type EtiketleyiciAyar, type GmailEtiket, type Posta,
} from '../../veri/gmail-posta';
import { hesapDurumuYukle, hesapSeridi, type HesapDurumu } from './ortak';

const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
type Aday = { posta: Posta; sonuc: Siniflama };

/* Otomatik gelişmiş etiketleyici: gelen kutusunu puanlı kurallarla tarar, önizleme gösterir, onayla Gmail'e "Astra/…" etiketi yazar.
   Kendi kurallarını tanımlayabilir, tekrar eden gönderenlerden kural önerisi alabilir; sayfa açıkken yeni iletileri kendiliğinden etiketleyebilir. */
export function etiketleyiciSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card posta');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  let durum: HesapDurumu = { istemci: '', hesaplar: [] };
  let ayar: EtiketleyiciAyar = { gun: 14, gmailaYaz: true, otomatik: false, enCok: 60 };
  let kurallar: Kural[] = [];
  let islenen = new Set<string>();
  let adaylar: Aday[] = [], oneriler: KuralOnerisi[] = [], hatalar: string[] = [], dahil = new Set<string>();
  let taraniyor = false, tarandi = false, sonMesaj = '';
  const etiketOnbellek = new Map<string, GmailEtiket[]>();
  let zamanlayici = 0;
  const anahtar = (p: Posta) => `${p.hesap}|${p.id}`;

  const kaydetAyar = () => { void etiketleyiciAyarYaz(ayar).catch(e => bildir(hataMetni(e), undefined, true)); };
  const kaydetKurallar = () => { void kurallariYaz(kurallar).catch(e => bildir(hataMetni(e), undefined, true)); };

  /* Gelen kutusunu tarar; daha önce etiketlenenleri atlar. Güçlü bir kategori bulunamayan iletilerin gövdesinden ilk parça alınıp yeniden puanlanır. */
  async function tara(): Promise<Aday[]> {
    const sonuc: Aday[] = [], hata: string[] = [];
    for (const h of baglananHesaplar()) {
      try {
        const { postalar } = await postaListele(h, `in:inbox newer_than:${ayar.gun}d`, ayar.enCok);
        const yeni = postalar.filter(p => !islenen.has(anahtar(p)));
        let govdeSayisi = 0;
        for (const p of yeni) {
          let s = siniflandir(p, kurallar);
          const guclu = Object.entries(s.puan).some(([k, v]) => k !== 'Kişisel' && v >= 3);
          if (!guclu && govdeSayisi < 25) { try { p.govde = await govdeOnizleme(h, p.id); govdeSayisi++; s = siniflandir(p, kurallar); } catch { /* gövdesiz devam */ } }
          sonuc.push({ posta: p, sonuc: s });
        }
      } catch (e) { hata.push(`${h}: ${e instanceof Error ? e.message : String(e)}`); if (e instanceof OturumDoldu) continue; }
    }
    hatalar = hata;
    return sonuc;
  }

  /* Seçili etiketleri Gmail'e yazar: etiketi bul/oluştur, hesap başına toplu uygula, işlenenleri kaydet. */
  async function uygula(liste: Aday[], secilenEtiketler: Set<string>): Promise<number> {
    let say = 0;
    const gruplar = new Map<string, Map<string, string[]>>(); // hesap → etiket → ileti kimlikleri
    for (const { posta, sonuc } of liste) {
      for (const e of sonuc.etiketler.filter(x => secilenEtiketler.has(x))) {
        const h = gruplar.get(posta.hesap) ?? new Map<string, string[]>(); gruplar.set(posta.hesap, h);
        h.set(e, [...(h.get(e) ?? []), posta.id]);
      }
    }
    for (const [hesap, etiketler] of gruplar) {
      for (const [e, ids] of etiketler) {
        const id = await etiketKimligi(hesap, gmailEtiketAdi(e), etiketOnbellek);
        await etiketUygula(hesap, ids, [id]); say += ids.length;
      }
    }
    liste.forEach(a => islenen.add(anahtar(a.posta)));
    await etiketlenenleriYaz([...islenen]);
    return say;
  }

  async function otomatikTur() {
    if (!kok.contains(kart) || taraniyor || !baglananHesaplar().length) { if (!kok.contains(kart)) window.clearInterval(zamanlayici); return; }
    taraniyor = true;
    try {
      const l = (await tara()).filter(a => a.sonuc.etiketler.length);
      if (l.length) { const n = await uygula(l, new Set(l.flatMap(a => a.sonuc.etiketler))); sonMesaj = `${new Date().toLocaleTimeString('tr-TR')} · ${n} etiket kendiliğinden uygulandı`; }
      else sonMesaj = `${new Date().toLocaleTimeString('tr-TR')} · yeni etiketlenecek ileti yok`;
    } catch (e) { sonMesaj = e instanceof Error ? e.message : hataMetni(e); if (e instanceof OturumDoldu) { ayar.otomatik = false; kaydetAyar(); } }
    taraniyor = false; ciz();
  }
  function zamanlayiciKur() { window.clearInterval(zamanlayici); if (ayar.otomatik) zamanlayici = window.setInterval(() => void otomatikTur(), 60000); }

  async function onizle() {
    taraniyor = true; ciz();
    try {
      adaylar = await tara(); tarandi = true;
      oneriler = kuralOner(adaylar.map(a => ({ mektup: a.posta, sonuc: a.sonuc })), kurallar);
      dahil = new Set(adaylar.flatMap(a => a.sonuc.etiketler).filter(e => e !== 'Önemli'));
    } catch (e) { bildir(e instanceof Error ? e.message : hataMetni(e), undefined, true); }
    taraniyor = false; ciz();
  }

  function kurallarBolumu(): HTMLElement {
    const b = el('section'); b.appendChild(el('h3', '', 'Kendi kurallarım'));
    b.appendChild(el('p', 'bos', 'Gönderen, konu ve içerik alanları virgülle ayrılmış birden çok sözcük alabilir; doldurulan alanların hepsi eşleşmeli. Eşleşen ileti "Astra/<etiket>" olarak işaretlenir.'));
    const t = el('table'), bs = el('tr'); ['Kural', 'Gönderen', 'Konu', 'İçerik', 'Etiket', 'Açık', ''].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    kurallar.forEach(k => {
      const tr = el('tr');
      const alan = (f: 'ad' | 'gonderen' | 'konu' | 'icerik' | 'etiket', ph: string) => { const i = el('input'); i.value = k[f]; i.placeholder = ph; i.setAttribute('aria-label', ph); i.addEventListener('change', () => { k[f] = i.value.trim(); kaydetKurallar(); }); const td = el('td'); td.appendChild(i); return td; };
      const ac = el('input'); ac.type = 'checkbox'; ac.checked = k.aktif; ac.setAttribute('aria-label', 'Kural açık'); ac.addEventListener('change', () => { k.aktif = ac.checked; kaydetKurallar(); });
      const sil = el('button', 'btn danger sm', 'sil'); sil.type = 'button'; sil.addEventListener('click', () => { kurallar = kurallar.filter(x => x.id !== k.id); kaydetKurallar(); ciz(); });
      const t1 = el('td'), t2 = el('td'); t1.appendChild(ac); t2.appendChild(sil);
      tr.append(alan('ad', 'Kural adı'), alan('gonderen', 'örn. firma.com'), alan('konu', 'konu sözcükleri'), alan('icerik', 'içerik sözcükleri'), alan('etiket', 'Etiket'), t1, t2);
      g.appendChild(tr);
    });
    t.appendChild(g);
    if (kurallar.length) { const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); b.appendChild(sarma); }
    const ekle = el('button', 'btn ghost sm', '+ Kural ekle'); ekle.type = 'button'; ekle.id = 'ke-ekle';
    ekle.addEventListener('click', () => { kurallar.push({ id: yeniId(), ad: 'Yeni kural', gonderen: '', konu: '', icerik: '', etiket: '', aktif: true }); kaydetKurallar(); ciz(); });
    b.appendChild(ekle);
    return b;
  }

  function ciz() {
    kart.replaceChildren(hesapSeridi(durum, () => { void yenile(); }));
    if (!baglananHesaplar().length) { kart.appendChild(el('p', 'bos', 'Etiketleyici için en az bir hesap bağla.')); kart.appendChild(kurallarBolumu()); return; }

    const a = el('div', 'ic-grid');
    const gun = el('select'); gun.id = 'ke-gun'; [7, 14, 30, 90].forEach(v => { const o = el('option', '', `Son ${v} gün`); o.value = String(v); gun.appendChild(o); }); gun.value = String(ayar.gun);
    gun.addEventListener('change', () => { ayar.gun = Number(gun.value); kaydetAyar(); });
    const cok = el('select'); cok.id = 'ke-cok'; [30, 60, 100].forEach(v => { const o = el('option', '', `Hesap başına ${v} ileti`); o.value = String(v); cok.appendChild(o); }); cok.value = String(ayar.enCok);
    cok.addEventListener('change', () => { ayar.enCok = Number(cok.value); kaydetAyar(); });
    const gl = el('label', 'alan'); gl.append(el('span', '', 'Kapsam'), gun); const cl = el('label', 'alan'); cl.append(el('span', '', 'Miktar'), cok);
    const onoy = (id: string, et: string, v: boolean, f: (c: boolean) => void) => { const l = el('label', 'ic-onay'), c = el('input'); c.type = 'checkbox'; c.id = id; c.checked = v; c.addEventListener('change', () => { f(c.checked); kaydetAyar(); ciz(); }); l.append(c, el('span', '', et)); return l; };
    a.append(gl, cl,
      onoy('ke-yaz', 'Onaylayınca Gmail\'e "Astra/…" etiketi yaz', ayar.gmailaYaz, c => { ayar.gmailaYaz = c; }),
      onoy('ke-otomatik', 'Bu sayfa açıkken her dakika yeni iletileri kendiliğinden etiketle', ayar.otomatik, c => { ayar.otomatik = c; zamanlayiciKur(); }));
    kart.appendChild(a);
    kart.appendChild(el('p', 'bos', 'İletiler silinmez, taşınmaz ya da okundu yapılmaz; yalnız etiket eklenir ve Gmail\'den istenince kaldırılabilir. Daha önce etiketlenen iletiler tekrar işlenmez.'));
    if (sonMesaj) kart.appendChild(el('p', 'bos', sonMesaj));

    const tara_ = el('button', 'btn primary', taraniyor ? 'Taranıyor…' : 'Tara ve önizle'); tara_.type = 'button'; tara_.id = 'ke-tara'; tara_.disabled = taraniyor;
    tara_.addEventListener('click', () => void onizle());
    kart.appendChild(tara_);
    if (hatalar.length) kart.appendChild(el('p', 'bos hata', hatalar.join(' · ')));

    if (tarandi && !taraniyor) {
      const onizleme = el('section', 'etiketleyici-onizleme');
      const sayim = new Map<string, Aday[]>();
      adaylar.forEach(x => x.sonuc.etiketler.forEach(e => sayim.set(e, [...(sayim.get(e) ?? []), x])));
      const etiketsiz = adaylar.filter(x => !x.sonuc.etiketler.length).length;
      onizleme.appendChild(el('h3', '', `Önizleme: ${adaylar.length} yeni ileti, ${adaylar.length - etiketsiz} tanesi etiketlenecek`));
      if (!adaylar.length) onizleme.appendChild(el('p', 'bos', 'Etiketlenecek yeni ileti yok.'));
      const t = el('table'), bs = el('tr'); ['Uygula', 'Etiket', 'İleti', 'Örnek nedenler', 'Örnekler'].forEach(x => bs.appendChild(el('th', '', x)));
      t.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody');
      [...sayim.entries()].sort((x, y) => y[1].length - x[1].length).forEach(([e, l]) => {
        const tr = el('tr'), c = el('input'); c.type = 'checkbox'; c.checked = dahil.has(e); c.setAttribute('aria-label', `${e} uygula`); c.dataset.etiket = e;
        c.addEventListener('change', () => { if (c.checked) dahil.add(e); else dahil.delete(e); });
        const t0 = el('td'); t0.appendChild(c);
        const r = el('span', 'posta-etiket', e); r.style.setProperty('--c', ETIKET_RENKLERI[e] ?? 'var(--dim)'); const t1 = el('td'); t1.appendChild(r);
        const nedenler = [...new Set(l.flatMap(x => x.sonuc.nedenler[e] ?? []))].slice(0, 3).join(', ');
        tr.append(t0, t1, el('td', 'sayi', String(l.length)), el('td', '', nedenler), el('td', '', l.slice(0, 3).map(x => `${x.posta.gonderen}: ${x.posta.konu.slice(0, 40)}`).join(' · ')));
        g.appendChild(tr);
      });
      t.appendChild(g); if (sayim.size) { const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); onizleme.appendChild(sarma); }
      const uyg = el('button', 'btn primary', 'Seçili etiketleri Gmail\'e uygula'); uyg.type = 'button'; uyg.id = 'ke-uygula'; uyg.disabled = !ayar.gmailaYaz || !sayim.size;
      uyg.addEventListener('click', async () => {
        uyg.disabled = true;
        try {
          const n = await uygula(adaylar.filter(x => x.sonuc.etiketler.length), dahil);
          bildir(`${n} etiket uygulandı`); adaylar = []; tarandi = false; sonMesaj = `${new Date().toLocaleTimeString('tr-TR')} · ${n} etiket elle uygulandı`;
        } catch (e) { bildir(e instanceof Error ? e.message : hataMetni(e), undefined, true); }
        ciz();
      });
      onizleme.appendChild(uyg);
      if (!ayar.gmailaYaz) onizleme.appendChild(el('p', 'bos', 'Gmail\'e yazma kapalı; önizleme yalnız bilgi amaçlıdır.'));
      if (oneriler.length) {
        onizleme.appendChild(el('h4', '', 'Kural önerileri'));
        onizleme.appendChild(el('p', 'bos', 'Etiketsiz kalan ve aynı alan adından tekrar tekrar gelen iletiler. Etiket adı yazıp kural olarak ekleyebilirsin.'));
        oneriler.forEach(o => {
          const s = el('div', 'tbar'), ad = el('input'); ad.placeholder = 'Etiket adı'; ad.setAttribute('aria-label', `${o.alan} etiketi`);
          const ekle = el('button', 'btn ghost sm', 'Kural olarak ekle'); ekle.type = 'button';
          ekle.addEventListener('click', () => { if (!ad.value.trim()) { bildir('Etiket adı yaz', undefined, true); return; } kurallar.push({ id: yeniId(), ad: o.alan, gonderen: o.alan, konu: '', icerik: '', etiket: ad.value.trim(), aktif: true }); oneriler = oneriler.filter(x => x !== o); kaydetKurallar(); ciz(); });
          s.append(el('span', '', `${o.alan} · ${o.adet} ileti · örn. "${o.ornekKonu.slice(0, 40)}"`), ad, ekle); onizleme.appendChild(s);
        });
      }
      kart.appendChild(onizleme);
    }
    kart.appendChild(kurallarBolumu());
  }

  async function yenile() { durum = await hesapDurumuYukle(); ciz(); }
  void (async () => {
    try { [durum, ayar, kurallar, islenen] = [await hesapDurumuYukle(), await etiketleyiciAyarGetir(), await kurallariGetir(), new Set(await etiketlenenleriGetir())]; }
    catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); return; }
    zamanlayiciKur(); ciz();
  })();
}
