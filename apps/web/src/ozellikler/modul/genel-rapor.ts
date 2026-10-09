import './genel-rapor.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { donem } from '../../kabuk/donem';
import { hataMetni } from '../../veri/hata';
import { bakiyeGecerliMi, gecerliBakiye, icraDosyalariniGetir, type IcraDosyasi } from '../../veri/icra';
import { hacizAdi, hacizlariGetir, planDurumu, planlariGetir } from '../../veri/icra-ek';
import { kayitlariGetir } from '../../veri/kayit';
import { panelGetir } from '../../veri/panel';
import { sureler } from '../../veri/sureler';

/* Genel Durum Raporu: tek sayfalık özet; tarayıcının yazdır penceresinden PDF olarak kaydedilir. */
export async function genelRaporYazdir(): Promise<void> {
  if (document.body.classList.contains('gizli')) { bildir('Gizlilik modu açık; önce kapat', undefined, true); return; }
  try {
    const bugun = bugunAnahtari();
    const [panel, borclar, icra, hacizler, planlar] = await Promise.all([
      panelGetir(donem()), kayitlariGetir('borclar', ['tur', 'yon', 'durum', 'guncel_borc'], {}, 'ad'), icraDosyalariniGetir(), hacizlariGetir(), planlariGetir(),
    ]);
    const kok = el('div', 'rapor-yazdir');
    const tablo = (basliklar: string[], satirlar: string[][]) => {
      const t = el('table'), bs = el('tr'); basliklar.forEach(b => bs.appendChild(el('th', '', b))); t.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody'); satirlar.forEach(s => { const tr = el('tr'); s.forEach(c => tr.appendChild(el('td', '', c))); g.appendChild(tr); }); t.appendChild(g); return t;
    };
    const baslik = el('div', 'ry-bas'); const sol = el('div');
    sol.append(el('div', 'ry-ust', 'ASTRA FİNANS OS · GİZLİ BELGE'), el('h1', '', 'Genel Durum Raporu'), el('div', 'ry-alt', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })));
    baslik.appendChild(sol);
    const kpi = el('div', 'ry-kpi');
    [['Gelir', tl(panel.gelir)], ['Gider', tl(panel.gider)], ['Serbest bütçe', tl(panel.serbest)], ['Toplam borç', tl(panel.borc)], ['Finansal sağlık', `${panel.saglik}/100`]].forEach(([e, d]) => { const x = el('div'); x.append(el('i', '', e!), el('b', '', d!)); kpi.appendChild(x); });
    kok.append(baslik, kpi);

    const acik = borclar.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi');
    const TUR: [string, string][] = [['kisi', 'Kişi borçları'], ['banka', 'Banka borçları'], ['icra', 'İcra dosyaları'], ['vergi', 'Vergi borçları'], ['sgk', 'SGK borçları']];
    const toplam = acik.reduce((t, b) => t + Number(b.guncel_borc), 0) || 1;
    kok.append(el('h2', '', 'Borçlar'), tablo(['Tür', 'Kayıt', 'Kalan', 'Pay'], TUR.map(([k, a]) => {
      const l = acik.filter(b => b.tur === k), t = l.reduce((s, b) => s + Number(b.guncel_borc), 0); return [a, String(l.length), tl(t), `%${Math.round(t / toplam * 100)}`];
    })));

    const dosyalar = icra.filter(d => gecerliBakiye(d) > 0).sort((a, b) => gecerliBakiye(b) - gecerliBakiye(a));
    kok.append(el('h2', '', `Açık icra dosyaları (${dosyalar.length}, ilk 15)`), dosyalar.length
      ? tablo(['Dosya no', 'Daire', 'Karşı taraf', 'Tür', 'Bakiye'], dosyalar.slice(0, 15).map(d => [d.dosya_no ?? '', d.icra_dairesi ?? '', d.karsi_taraf ?? '', d.takip_turu ?? '', tl(gecerliBakiye(d))]))
      : el('p', '', 'Bakiyesi olan açık icra dosyası yok.'));

    const sure = icra.filter(d => d.durum === 'acik' && d.tebligat_tarihi).flatMap(d => sureler(d.takip_turu, d.tebligat_tarihi, bugun).filter(s => s.kalan >= -1 && s.kalan <= 30).map(s => [`${d.dosya_no ?? ''}`, s.ad, gun(s.son), s.kalan <= 0 ? 'BUGÜN' : `${s.kalan} gün`]));
    kok.append(el('h2', '', 'Yaklaşan icra süreleri (30 gün)'), sure.length ? tablo(['Dosya', 'Süre', 'Son gün', 'Kalan'], sure) : el('p', '', 'Tebliği girilmiş, 30 gün içinde dolacak süre yok.'));

    const aktifHaciz = hacizler.filter(h => h.durum === 'aktif');
    kok.append(el('h2', '', `Hacizler (${aktifHaciz.length} aktif · ${tl(aktifHaciz.reduce((t, h) => t + h.tutar, 0))})`), aktifHaciz.length
      ? tablo(['Dosya', 'Tür', 'Hedef', 'Tutar', 'Tarih'], aktifHaciz.map(h => [icra.find(d => d.id === h.icra_id)?.dosya_no ?? '', h.tur, h.hedef ?? '', tl(h.tutar), gun(h.tarih)])) : el('p', '', 'Aktif haciz kaydı yok.'));

    if (planlar.length) kok.append(el('h2', '', 'Anlaşılan ödeme planları'), tablo(['Dosya', 'Taksit', 'Ödenen', 'Kalan', 'Durum'], planlar.map(p => {
      const st = planDurumu(p, bugun); return [icra.find(d => d.id === p.icra_id)?.dosya_no ?? '', `${tl(p.taksit)} × ${p.adet}`, tl(st.odenen), tl(st.kalan), st.durum === 'geride' ? `GERİDE ${tl(st.gecikme)}` : st.durum === 'bitti' ? 'bitti' : 'güncel'];
    })));

    if (panel.uyarilar.length) kok.append(el('h2', '', 'Uyarılar'), tablo(['Uyarı', 'Not'], panel.uyarilar.map(u => [u.baslik, u.not])));
    kok.appendChild(el('div', 'ry-not', 'Bu rapor uygulamadaki kayıtlardan üretilmiştir; ödeme öncesi UYAP doğrulaması yapılmalıdır. Yatırım ya da hukuk tavsiyesi değildir.'));
    document.body.appendChild(kok); document.body.classList.add('rapor-yaziliyor');
    const bitir = () => { kok.remove(); document.body.classList.remove('rapor-yaziliyor'); window.removeEventListener('afterprint', bitir); };
    window.addEventListener('afterprint', bitir);
    window.print();
  } catch (e) { bildir(hataMetni(e), undefined, true); }
}

/* Tek icra dosyasının raporu: taraflar, tutarlar, süreler, hacizler, ödeme planı. */
export async function icraDosyaRaporuYazdir(d: IcraDosyasi, adlar: Map<string, string>): Promise<void> {
  if (document.body.classList.contains('gizli')) { bildir('Gizlilik modu açık; önce kapat', undefined, true); return; }
  try {
    const bugun = bugunAnahtari();
    const [hacizler, planlar] = await Promise.all([hacizlariGetir(), planlariGetir()]);
    const kok = el('div', 'rapor-yazdir');
    const tablo = (basliklar: string[], satirlar: string[][]) => {
      const t = el('table'), bs = el('tr'); basliklar.forEach(b => bs.appendChild(el('th', '', b))); t.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody'); satirlar.forEach(r => { const tr = el('tr'); r.forEach(c => tr.appendChild(el('td', '', c))); g.appendChild(tr); }); t.appendChild(g); return t;
    };
    const bas = el('div', 'ry-bas'), sol = el('div');
    sol.append(el('div', 'ry-ust', 'ASTRA FİNANS OS · İCRA DOSYA RAPORU'), el('h1', '', `${d.dosya_no ?? '—'}`), el('div', 'ry-alt', `${d.icra_dairesi ?? ''} · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`));
    bas.appendChild(sol); kok.appendChild(bas);
    kok.append(el('h2', '', 'Taraflar ve durum'), tablo(['Alan', 'Değer'], [
      ['Rol', d.taraf_rolu ?? ''], ['Takip türü / yolu', [d.takip_turu, d.takip_yolu].filter(Boolean).join(' · ')], ['UYAP durumu', d.uyap_durum ?? ''], ['Karşı taraf', d.karsi_taraf ?? ''],
      ['Alacaklı', adlar.get(d.alacakli_id ?? '') ?? ''], ['Avukat', adlar.get(d.avukat_id ?? '') ?? ''], ['Açılış', gun(d.acilis_tarihi)], ['Son işlem', gun(d.son_islem_tarihi)], ['Son doğrulama', gun(d.dogrulama_tarihi)], ['Tebligat', gun(d.tebligat_tarihi)],
    ].filter(r => r[1] && r[1] !== '—')));
    kok.append(el('h2', '', 'Tutarlar'), tablo(['Kalem', 'Tutar'], [
      ['Asıl alacak', tl(d.gercek_asil_alacak)], ['Faiz', tl(d.faiz_tutari)], ['Vekâlet ücreti', tl(d.vekalet_ucreti)], ['Masraf', tl(d.masraf)], ['Vergi', tl(d.vergi)], ['Tahsil harcı', tl(d.tahsil_harci)],
      ['Toplam alacak', tl(d.toplam_alacak)], ['Yatan para', tl(d.yatan_para)], ['Tahsilat / reddiyat', `${tl(d.tahsilat)} / ${tl(d.reddiyat)}`], ['Güncel toplam borç', tl(d.guncel_toplam_borc)],
      ['Sayılan bakiye', bakiyeGecerliMi(d) ? tl(d.guncel_toplam_borc) : `${tl(0)} (${d.uyap_durum ?? 'kapalı'})`],
    ]));
    const sr = d.tebligat_tarihi ? sureler(d.takip_turu, d.tebligat_tarihi, bugun) : [];
    kok.append(el('h2', '', 'Süreler'), sr.length ? tablo(['Süre', 'Gün', 'Son gün', 'Kalan'], sr.map(s => [s.ad, String(s.gun), gun(s.son), s.kalan < 0 ? 'geçti' : s.kalan === 0 ? 'BUGÜN' : `${s.kalan} gün`])) : el('p', '', 'Tebliğ tarihi girilmemiş; süreler hesaplanamadı.'));
    const hz = hacizler.filter(h => h.icra_id === d.id);
    kok.append(el('h2', '', `Hacizler (${hz.filter(h => h.durum === 'aktif').length} aktif)`), hz.length ? tablo(['Tür', 'Hedef', 'Tutar', 'Tarih', 'Durum'], hz.map(h => [hacizAdi(h.tur), h.hedef ?? '', tl(h.tutar), gun(h.tarih), h.durum === 'aktif' ? 'aktif' : 'kalktı'])) : el('p', '', 'Haciz kaydı yok.'));
    const pl = planlar.find(p => p.icra_id === d.id);
    if (pl) { const st = planDurumu(pl, bugun); kok.append(el('h2', '', 'Anlaşılan ödeme planı'), el('p', '', `${tl(pl.taksit)} × ${pl.adet} taksit · başlangıç ${gun(pl.baslangic)} · ödenen ${tl(st.odenen)} / ${tl(st.toplam)} · kalan ${tl(st.kalan)}${st.durum === 'geride' ? ` · GERİDE ${tl(st.gecikme)}` : ''}`),
      pl.odemeler.length ? tablo(['Tarih', 'Tutar'], pl.odemeler.map(o => [gun(o.tarih), tl(o.tutar)])) : el('p', '', 'Henüz ödeme girilmemiş.')); }
    if (d.son_islemler.length) kok.append(el('h2', '', 'Son işlemler'), tablo(['İşlem'], d.son_islemler.map(x => [x])));
    kok.appendChild(el('div', 'ry-not', 'Bu rapor uygulamadaki kayıtlardan üretilmiştir; ödeme öncesi UYAP doğrulaması yapılmalıdır.'));
    document.body.appendChild(kok); document.body.classList.add('rapor-yaziliyor');
    const bitir = () => { kok.remove(); document.body.classList.remove('rapor-yaziliyor'); window.removeEventListener('afterprint', bitir); };
    window.addEventListener('afterprint', bitir);
    window.print();
  } catch (e) { bildir(hataMetni(e), undefined, true); }
}
