import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import type { IcraDosyasi } from '../../veri/icra';
import { uyapAyristir, uyapDegisimOzeti, uyapPlanla, uyapUygula, type Degisim } from '../../veri/uyap';

const DURUM: Record<string, string> = { acik: 'açık', kapali: 'kapalı', itiraz: 'itiraz' };

function ozetPenceresi(degisimler: Degisim[], hatalar: string[]) {
  const o = uyapDegisimOzeti(degisimler);
  const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', 'UYAP içe aktarma özeti');
  dlg.appendChild(el('h2', '', 'UYAP içe aktarma — ne değişti'));
  dlg.appendChild(el('p', 'bos',
    `${o.toplam} borçlu dosya işlendi: ${o.yeni} yeni · ${o.artan} bakiyesi arttı · ${o.azalan} bakiyesi azaldı · ${o.kapanan} kapandı/durdu`
    + `${o.yenidenAcilan ? ` · ${o.yenidenAcilan} yeniden açıldı` : ''} · ${o.degismeyen} değişmedi. Açık icra borcu farkı: ${o.acikBorcFarki > 0 ? '+' : ''}${tl(o.acikBorcFarki)}`));
  if (hatalar.length) dlg.appendChild(el('p', 'bos hata', `${hatalar.length} dosya yazılamadı: ${hatalar.slice(0, 3).join(' · ')}${hatalar.length > 3 ? ' …' : ''}`));
  if (o.satirlar.length) {
    const t = el('table'), bs = el('tr');
    ['Dosya', 'Durum', 'Eski', 'Yeni', 'Fark'].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    o.satirlar.slice(0, 12).forEach(x => {
      const f = x.yeniGn - x.eskiGn, tr = el('tr');
      tr.append(el('td', '', `${x.no} ${x.dr}`), el('td', '', `${x.tur === 'yeni' ? 'yeni · ' : ''}${DURUM[x.eskiDur ?? ''] ?? '—'} → ${DURUM[x.yeniDur] ?? x.yeniDur}`),
        el('td', 'sayi', tl(x.eskiGn)), el('td', 'sayi', tl(x.yeniGn)), el('td', 'sayi', `${f > 0 ? '▲' : f < 0 ? '▼' : '•'} ${tl(Math.abs(f))}`));
      g.appendChild(tr);
    });
    t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); dlg.appendChild(sarma);
    if (o.satirlar.length > 12) dlg.appendChild(el('p', 'bos', `+${o.satirlar.length - 12} dosya daha (en büyük 12 fark gösterildi)`));
  }
  const kapat = el('button', 'btn primary', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
  dlg.appendChild(kapat); dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg); dlg.showModal();
}

/* UYAP icra özeti (JSON) seçtirir, ne olacağını gösterip onay ister, sırayla yazar ve değişiklik özetini açar. */
export function uyapIceAktar(mevcut: IcraDosyasi[], bitti: () => void) {
  const inp = el('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0]; if (!f) return;
    let plan;
    try { plan = uyapPlanla(uyapAyristir(await f.text()), mevcut, bugunAnahtari()); }
    catch (e) { bildir(`UYAP dosyası okunamadı: ${e instanceof Error ? e.message : hataMetni(e)}`, undefined, true); return; }
    const kapali = plan.borc.filter(k => !k.acik).length, itiraz = plan.borc.filter(k => k.acik && /[İi]tiraz/.test(k.durum ?? '')).length;
    const evet = await onayla({
      baslik: 'UYAP verisini içe aktar',
      metin: `${plan.tarih} tarihli UYAP özeti: ${plan.paket.length} dosya. ${plan.guncel.length} mevcut dosya güncellenecek, ${plan.yeni.length} yeni dosya eklenecek. `
        + `${kapali} kapalı, ${itiraz} itirazla durmuş dosya var. ${plan.alacak.length} dosyada alacaklısın; bunlar borç toplamına katılmaz. `
        + `Açık icra borcu: ${tl(plan.oncekiToplam)} → ${tl(plan.yeniAcikToplam)}. Faiz oranı, notlar, tebliğ tarihi ve öncelik korunur; hiçbir kayıt silinmez.`,
      evet: 'İçe aktar',
    });
    if (!evet) return;
    bildir('UYAP verisi işleniyor…');
    try {
      const r = await uyapUygula(plan, [...mevcut], (y, t) => { if (y === t) bildir(`UYAP: ${t} dosya işlendi`); });
      bitti();
      ozetPenceresi(r.degisimler, r.hatalar);
      bildir(`UYAP: ${r.guncellenen} dosya güncellendi, ${r.eklenen} eklendi, ${r.alacakli} alacaklı dosya`);
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  });
  inp.click();
}
