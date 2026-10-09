import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { gun, tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import type { IcraDosyasi } from '../../veri/icra';
import {
  HACIZ_TURLERI, hacizAdi, hacizEkle, hacizGuncelle, hacizlariGetir, planDurumu, planEkle, planGuncelle, planlariGetir, type Haciz, type Plan,
} from '../../veri/icra-ek';

const sayiOku = (s: string) => { const n = Number(s.trim().replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function girdi(id: string, tip: string, deger = '', ph = '') {
  const i = el('input'); i.id = id; i.type = tip; i.value = deger; if (ph) i.placeholder = ph; i.setAttribute('aria-label', ph || id); return i;
}

/* Detay penceresine eklenen iki bölüm: hacizler ve anlaşılan ödeme planı. Yükleme bittiğinde kendini doldurur. */
export function icraEkBolumleri(d: IcraDosyasi): HTMLElement[] {
  const hacizKutu = el('section', 'bolum'), planKutu = el('section', 'bolum');
  hacizKutu.appendChild(el('p', 'bos', 'Hacizler yükleniyor…')); planKutu.appendChild(el('p', 'bos', 'Plan yükleniyor…'));
  let hacizlar: Haciz[] = [];
  let plan: Plan | null = null;

  const hacizCiz = () => {
    hacizKutu.replaceChildren(el('h3', '', 'Hacizler'));
    const aktif = hacizlar.filter(h => h.durum === 'aktif');
    if (hacizlar.length) {
      hacizKutu.appendChild(el('p', 'bos', `${aktif.length} aktif haciz · ${tl(aktif.reduce((t, h) => t + h.tutar, 0))}`));
      const ul = el('ul', 'ic-liste');
      hacizlar.forEach(h => {
        const li = el('li', h.durum === 'kalkti' ? 'pasif' : '');
        li.append(el('b', '', hacizAdi(h.tur)), ` · ${h.hedef ?? ''} · ${tl(h.tutar)} · ${gun(h.tarih)}${h.durum === 'kalkti' ? ' · kalktı' : ''} `);
        const tog = el('button', 'btn ghost sm', h.durum === 'aktif' ? 'Kalktı' : 'Yeniden aktif'); tog.type = 'button';
        tog.addEventListener('click', async () => {
          try { const y = await hacizGuncelle(h, { durum: h.durum === 'aktif' ? 'kalkti' : 'aktif' }); hacizlar = hacizlar.map(x => (x.id === h.id ? y : x)); hacizCiz(); }
          catch (e) { bildir(hataMetni(e), undefined, true); }
        });
        const sil = el('button', 'btn danger sm', 'Sil'); sil.type = 'button';
        sil.addEventListener('click', async () => {
          if (!(await onayla({ baslik: 'Haciz kaydı silinsin mi?', evet: 'Sil', tehlike: true }))) return;
          try { await hacizGuncelle(h, { silindi_at: new Date().toISOString() }); hacizlar = hacizlar.filter(x => x.id !== h.id); hacizCiz(); }
          catch (e) { bildir(hataMetni(e), undefined, true); }
        });
        li.append(tog, sil); ul.appendChild(li);
      });
      hacizKutu.appendChild(ul);
    }
    const f = el('div', 'ic-grid');
    const tur = el('select'); tur.id = 'hz-tur'; tur.setAttribute('aria-label', 'Haciz türü');
    HACIZ_TURLERI.forEach(([v, a]) => { const o = el('option', '', a); o.value = v; tur.appendChild(o); });
    const hedef = girdi('hz-hedef', 'text', '', 'Hedef (banka, araç plakası, işyeri…)');
    const tutar = girdi('hz-tutar', 'text', '', 'Tutar'); tutar.inputMode = 'decimal';
    const tarih = girdi('hz-tarih', 'date', bugunAnahtari(), 'Tarih');
    const ekle = el('button', 'btn sm', '+ Haciz ekle'); ekle.type = 'button'; ekle.id = 'hz-ekle';
    ekle.addEventListener('click', async () => {
      const t = tutar.value.trim() ? sayiOku(tutar.value) : 0;
      if (Number.isNaN(t) || t < 0) { bildir('Tutar geçersiz', undefined, true); return; }
      ekle.disabled = true;
      try {
        hacizlar = [...hacizlar, await hacizEkle({ icra_id: d.id, tur: tur.value, hedef: hedef.value.trim() || null, tutar: t, tarih: tarih.value || bugunAnahtari(), durum: 'aktif', notlar: null })];
        hacizCiz();
      } catch (e) { bildir(hataMetni(e), undefined, true); ekle.disabled = false; }
    });
    f.append(tur, hedef, tutar, tarih, ekle);
    hacizKutu.appendChild(f);
  };

  const planCiz = () => {
    planKutu.replaceChildren(el('h3', '', 'Anlaşılan ödeme planı'));
    if (!plan) {
      planKutu.appendChild(el('p', 'bos', 'Bu dosya için anlaşılmış bir taksit planı yok. Varsa girersen geciken taksit uyarısı çıkar.'));
      const f = el('div', 'ic-grid');
      const taksit = girdi('pl-taksit', 'text', '', 'Aylık taksit (TL)'); taksit.inputMode = 'decimal';
      const adet = girdi('pl-adet', 'number', '', 'Taksit adedi'); adet.min = '1';
      const bas = girdi('pl-bas', 'date', bugunAnahtari(), 'Başlangıç');
      const kur = el('button', 'btn sm', 'Planı kaydet'); kur.type = 'button'; kur.id = 'pl-kaydet';
      kur.addEventListener('click', async () => {
        const t = sayiOku(taksit.value), a = Math.round(Number(adet.value));
        if (!(t > 0) || !(a >= 1 && a <= 600)) { bildir('Taksit ve adet geçerli olmalı', undefined, true); return; }
        kur.disabled = true;
        try { plan = await planEkle({ icra_id: d.id, taksit: t, adet: a, baslangic: bas.value || bugunAnahtari(), odemeler: [] }); planCiz(); }
        catch (e) { bildir(hataMetni(e), undefined, true); kur.disabled = false; }
      });
      f.append(taksit, adet, bas, kur); planKutu.appendChild(f); return;
    }
    const p = plan, st = planDurumu(p, bugunAnahtari());
    planKutu.appendChild(el('p', st.durum === 'geride' ? 'bos hata' : 'bos',
      `${tl(p.taksit)} × ${p.adet} taksit · ${gun(p.baslangic)} başlangıç · ödenen ${tl(st.odenen)} / ${tl(st.toplam)} · kalan ${tl(st.kalan)}`
      + (st.durum === 'geride' ? ` · GERİDE: ${tl(st.gecikme)}` : st.durum === 'bitti' ? ' · bitti' : ' · güncel')));
    if (p.odemeler.length) {
      const ul = el('ul', 'ic-liste');
      [...p.odemeler].sort((x, y) => y.tarih.localeCompare(x.tarih)).forEach(o => {
        const li = el('li'); li.append(`${gun(o.tarih)} · ${tl(o.tutar)} `);
        const sil = el('button', 'btn ghost sm', 'Sil'); sil.type = 'button';
        sil.addEventListener('click', async () => {
          try { plan = await planGuncelle(p, { odemeler: p.odemeler.filter(x => x.id !== o.id) }); planCiz(); }
          catch (e) { bildir(hataMetni(e), undefined, true); }
        });
        li.appendChild(sil); ul.appendChild(li);
      });
      planKutu.appendChild(ul);
    }
    const f = el('div', 'ic-grid');
    const tarih = girdi('pl-otarih', 'date', bugunAnahtari(), 'Ödeme tarihi');
    const tutar = girdi('pl-otutar', 'text', String(p.taksit).replace('.', ','), 'Tutar'); tutar.inputMode = 'decimal';
    const ekle = el('button', 'btn sm', '+ Ödeme kaydet'); ekle.type = 'button'; ekle.id = 'pl-odeme';
    ekle.addEventListener('click', async () => {
      const t = sayiOku(tutar.value);
      if (!(t > 0)) { bildir('Tutar geçersiz', undefined, true); return; }
      ekle.disabled = true;
      try { plan = await planGuncelle(p, { odemeler: [...p.odemeler, { id: yeniId(), tarih: tarih.value || bugunAnahtari(), tutar: t }] }); planCiz(); }
      catch (e) { bildir(hataMetni(e), undefined, true); ekle.disabled = false; }
    });
    const kaldir = el('button', 'btn danger sm', 'Planı kaldır'); kaldir.type = 'button';
    kaldir.addEventListener('click', async () => {
      if (!(await onayla({ baslik: 'Ödeme planı kaldırılsın mı?', metin: 'Girilen ödemeler de silinir.', evet: 'Kaldır', tehlike: true }))) return;
      try { await planGuncelle(p, { silindi_at: new Date().toISOString() }); plan = null; planCiz(); }
      catch (e) { bildir(hataMetni(e), undefined, true); }
    });
    f.append(tarih, tutar, ekle, kaldir); planKutu.appendChild(f);
  };

  void Promise.all([hacizlariGetir(), planlariGetir()]).then(([h, p]) => {
    hacizlar = h.filter(x => x.icra_id === d.id); plan = p.find(x => x.icra_id === d.id) ?? null; hacizCiz(); planCiz();
  }).catch(e => { hacizKutu.replaceChildren(el('p', 'bos hata', hataMetni(e))); planKutu.replaceChildren(); });
  return [hacizKutu, planKutu];
}
