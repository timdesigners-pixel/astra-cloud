import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { odemeleriEkle, type Odeme } from '../../veri/odemeler';
import { pdfMetni, planCoz, planKur, type PlanCozum } from '../../veri/plan-coz';
import { secim } from '../notlar/ortak';

/* Ödeme planı yükle: PDF ya da yapıştırılan metin → önizleme → seçilen borca taksit olarak işle. Aynı borçta aynı vade ve tutarlı kayıt tekrar eklenmez. */
export function planYukleFormu(o: { borclar: [string, string][]; odemeler: Odeme[]; eklendi: (yeni: Odeme[]) => void }) {
  const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', 'Ödeme planı yükle');
  const f = el('form'); f.noValidate = true; f.method = 'dialog';
  f.appendChild(el('h2', '', 'Ödeme planı yükle'));
  f.appendChild(el('p', 'bos', 'Tecil / yapılandırma ödeme planı PDF\'ini seç ya da plan tablosunu kopyalayıp yapıştır. Kaydetmeden önce önizleme gösterilir.'));
  const dosya = el('input'); dosya.type = 'file'; dosya.accept = 'application/pdf,.pdf'; dosya.id = 'py-dosya'; dosya.setAttribute('aria-label', 'PDF seç');
  const metin = el('textarea'); metin.id = 'py-metin'; metin.rows = 6; metin.placeholder = '…ya da plan metnini buraya yapıştır (her satırda vade tarihi ve tutar)';
  const onizleme = el('div'); onizleme.id = 'py-onizleme';
  const borc = secim('py-borc', o.borclar, o.borclar[0]?.[0] ?? '');
  const bl = el('label', 'alan'); bl.append(el('span', '', 'Hedef borç'), borc);
  const hata = el('p', 'form-hata'); hata.hidden = true; hata.setAttribute('role', 'alert');
  const kaydet = el('button', 'btn primary', 'Planı işle'); kaydet.type = 'submit'; kaydet.disabled = true; kaydet.id = 'py-kaydet';
  const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
  const d = el('div', 'form-dugmeler'); d.append(kaydet, vazgec);
  f.append(dosya, metin, onizleme, bl, hata, d);

  let c: PlanCozum | null = null, sutun = 0;
  const yeniler = () => {
    if (!c) return [];
    const var_ = new Set(o.odemeler.filter(x => x.borc_id === borc.value && x.durum !== 'iptal').map(x => `${x.vade_tarihi}|${Number(x.tutar)}`));
    return planKur(c, sutun).filter(p => !var_.has(`${p.tarih}|${p.tutar}`));
  };
  const onizle = () => {
    onizleme.replaceChildren(); kaydet.disabled = true;
    if (!c) return;
    if (!c.rows.length) { onizleme.appendChild(el('p', 'bos hata', 'Vade tarihi ve tutar içeren satır bulunamadı.')); return; }
    const plan = planKur(c, sutun), yeni = yeniler();
    onizleme.appendChild(el('p', 'bos', `${plan.length} taksit · ${gun(plan[0]!.tarih)} → ${gun(plan[plan.length - 1]!.tarih)} · toplam ${tl(plan.reduce((t, p) => t + p.tutar, 0))}`
      + `${c.tecil ? ` · tecil no ${c.tecil}` : ''}${c.daire ? ` · ${c.daire} VD` : ''}${yeni.length < plan.length ? ` · ${plan.length - yeni.length} taksit bu borçta zaten var, atlanacak` : ''}`));
    if (c.genislik > 1) {
      const s = el('select'); s.id = 'py-sutun'; s.setAttribute('aria-label', 'Taksit sütunu');
      for (let i = 0; i < c.genislik; i++) { const op = el('option', '', `${i + 1}. tutar sütunu (ör. ${tl(c!.rows[0]!.tutarlar[i] ?? 0)})`); op.value = String(i); s.appendChild(op); }
      s.value = String(sutun); s.addEventListener('change', () => { sutun = Number(s.value); onizle(); });
      const l = el('label', 'alan'); l.append(el('span', '', 'Taksit sütunu'), s); onizleme.appendChild(l);
    }
    const t = el('table'), bs = el('tr'); ['Vade', 'Tutar', ''].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody'); const yeniSet = new Set(yeni.map(p => p.tarih));
    plan.forEach(p => { const tr = el('tr'); tr.append(el('td', '', gun(p.tarih)), el('td', 'sayi', tl(p.tutar)), el('td', '', yeniSet.has(p.tarih) ? 'yeni' : 'var')); g.appendChild(tr); });
    t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); onizleme.appendChild(sarma);
    kaydet.disabled = !yeni.length || !borc.value;
  };
  const coz = (m: string) => { c = planCoz(m); sutun = c.sutun; onizle(); };
  metin.addEventListener('input', () => coz(metin.value));
  borc.addEventListener('change', onizle);
  dosya.addEventListener('change', async () => {
    const dsy = dosya.files?.[0]; if (!dsy) return;
    try { const m = await pdfMetni(dsy); metin.value = m; coz(m); }
    catch (e) { hata.textContent = `PDF okunamadı: ${e instanceof Error ? e.message : hataMetni(e)}`; hata.hidden = false; }
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const liste = yeniler(); if (!liste.length || !borc.value) return;
    kaydet.disabled = true; hata.hidden = true;
    try {
      const eklenen = await odemeleriEkle(liste.map(p => ({ borc_id: borc.value, hesap_id: null, vade_tarihi: p.tarih, tutar: p.tutar, notlar: c?.tecil ? `Tecil ${c.tecil}` : 'Ödeme planından' })));
      dlg.close(); o.eklendi(eklenen); bildir(`${eklenen.length} taksit işlendi`);
    } catch (err) { kaydet.disabled = false; hata.textContent = hataMetni(err); hata.hidden = false; }
  });
  dlg.appendChild(f); dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg); dlg.showModal(); metin.focus();
}
