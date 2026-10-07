import { el } from '../../ortak/dom';
import { bayt } from './bicim';
import { gruplaEsle, varsayilanSecim, type Aday, type Grup, type Secim } from './hukuk-eslestir';

/* "Hukuk belgelerini taşı": bilgisayardaki klasörlerin (her dava için bir alt klasör) dava ve icra kayıtlarına eşlenip yüklenmesi. */
export type Hazir = { grup: Grup; hedef: { tur: 'dava' | 'icra'; id: string } | 'normal' };

export function hukukTasiPenceresi(o: { dosyalar: File[]; adaylar: Aday[]; baslat: (hazir: Hazir[]) => Promise<void> }) {
  const { gruplar, atlananGurultu, kokDosya } = gruplaEsle(o.dosyalar, o.adaylar);
  const dlg = el('dialog', 'kutu genis ht-pencere'); dlg.setAttribute('aria-label', 'Hukuk belgelerini taşı');
  dlg.appendChild(el('h2', '', 'Hukuk belgelerini taşı'));
  if (!gruplar.length) {
    dlg.appendChild(el('p', 'bos', 'Seçtiğin klasörde taşınacak alt klasör bulunamadı. Dava klasörlerinin (ör. 2026-94) içinde durduğu üst klasörü seç.'));
    const k = el('button', 'btn ghost', 'Kapat'); k.type = 'button'; k.addEventListener('click', () => dlg.close()); dlg.appendChild(k);
    dlg.addEventListener('close', () => dlg.remove()); document.body.appendChild(dlg); dlg.showModal();
    return;
  }
  const secimler = new Map<string, Secim>(gruplar.map(g => [g.ad, varsayilanSecim(g)]));
  const ozet = el('p', 'sg-not');
  const tablo = el('table', 'ht-tablo'), bs = el('tr');
  ['Klasör', 'Dosya', 'Boyut', 'Nereye taşınsın?'].forEach(x => bs.appendChild(el('th', '', x)));
  tablo.appendChild(el('thead')).appendChild(bs);
  const govde = el('tbody');
  const baslat = el('button', 'btn primary', 'Taşımayı başlat'); baslat.type = 'button';

  const hesapla = () => {
    let dosya = 0, boyut = 0, buyuk = 0, secilmemis = 0;
    for (const g of gruplar) {
      const s = secimler.get(g.ad)!;
      if (s === '') secilmemis++;
      if (s === 'atla' || s === '') continue;
      dosya += g.parcalar.length; boyut += g.boyut; buyuk += g.buyuk;
    }
    ozet.textContent = `${dosya} dosya, ${bayt(boyut)} taşınacak`
      + (buyuk ? ` · ${buyuk} dosya 25 MB'tan büyük olduğu için atlanacak` : '')
      + (atlananGurultu ? ` · ${atlananGurultu} sistem/boş dosya yok sayıldı` : '')
      + (kokDosya ? ` · ${kokDosya} dosya doğrudan üst klasörde olduğu için alınmadı` : '')
      + (secilmemis ? ` · ${secilmemis} klasör için hedef seçmelisin` : '');
    baslat.disabled = secilmemis > 0 || dosya === 0;
  };

  for (const g of gruplar) {
    const tr = el('tr');
    const ad = el('td'); ad.append(el('b', '', g.ad), el('small', 'takma', g.anahtar ? `esas: ${g.anahtar.replace('-', '/')}` : 'esas numarası bulunamadı'));
    const sec = el('select'); sec.setAttribute('aria-label', `${g.ad} hedefi`);
    const sec_ = (v: Secim, t: string) => { const op = el('option', '', t); op.value = v; sec.appendChild(op); };
    if (g.adaylar.length > 1) sec_('', '— hedef seç —');
    g.adaylar.forEach(a => sec_(`${a.tur}:${a.id}`, `${a.tur === 'dava' ? 'Dava' : 'İcra'}: ${a.etiket}`));
    sec_('normal', 'Eşleştirme, sıradan klasör olarak yükle');
    sec_('atla', 'Bu klasörü taşıma');
    sec.value = secimler.get(g.ad)!;
    sec.addEventListener('change', () => { secimler.set(g.ad, sec.value as Secim); hesapla(); });
    const td = el('td'); td.appendChild(sec);
    tr.append(ad, el('td', 'sayi', String(g.parcalar.length + g.buyuk)), el('td', 'sayi', bayt(g.boyut)), td);
    govde.appendChild(tr);
  }
  tablo.appendChild(govde);
  const sarma = el('div', 'tablo-sarma ht-kap'); sarma.appendChild(tablo);
  dlg.append(el('p', 'sg-not', 'Her alt klasör, adındaki esas numarasına göre bir dava ya da icra dosyasıyla eşleştirildi. Eşleşenlerin belgeleri o dosyanın "Belgeler" klasörüne gider; aynı ad ve boyuttaki dosyalar tekrar yüklenmez, yani işlemi güvenle yeniden çalıştırabilirsin.'), sarma, ozet);
  const dugmeler = el('div', 'form-dugmeler');
  const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
  baslat.addEventListener('click', () => {
    const hazir: Hazir[] = [];
    for (const g of gruplar) {
      const s = secimler.get(g.ad)!;
      if (s === 'atla' || s === '') continue;
      if (s === 'normal') hazir.push({ grup: g, hedef: 'normal' });
      else { const [tur, id] = s.split(':') as ['dava' | 'icra', string]; hazir.push({ grup: g, hedef: { tur, id } }); }
    }
    dlg.close();
    void o.baslat(hazir);
  });
  dugmeler.append(baslat, vazgec);
  dlg.appendChild(dugmeler);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg); dlg.showModal();
  hesapla();
}
