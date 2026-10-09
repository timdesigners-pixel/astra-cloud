import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { donem } from '../../kabuk/donem';
import { git } from '../../kabuk/yonlendirici';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { bulgular, siradaHesapla, type Bulgu, type DanismanGirdi } from '../../veri/danisman';
import { icraDosyalariniGetir } from '../../veri/icra';
import { ayarOku, ayarYaz } from '../../veri/karsilama';
import { kayitlariGetir } from '../../veri/kayit';
import { panelGetir } from '../../veri/panel';
import { imzaGetir } from '../../veri/sabitler';

const SEVIYE: Record<Bulgu['seviye'], string> = { kritik: 'KRİTİK', uyari: 'UYARI', firsat: 'FIRSAT', bilgi: 'BİLGİ' };

/* Danışman ve Sırada Ne Var: kural motoru bulguları + önümüzdeki 30–60 günün eylem listesi. */
export function danismanSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card danisman');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [panel, borclar, odemeler, gelirler, giderler, varliklar, hesaplar, hareketler, davalar, alinacaklar, icra, imza, gizliAyar] = await Promise.all([
        panelGetir(donem()),
        kayitlariGetir('borclar', ['ad', 'yon', 'durum', 'guncel_borc', 'faiz_orani'], {}, 'ad'),
        kayitlariGetir('odemeler', ['borc_id', 'vade_tarihi', 'tutar', 'durum'], {}, 'vade_tarihi'),
        kayitlariGetir('gelirler', ['sabit', 'periyot', 'tutar', 'baslangic', 'bitis', 'aktif'], {}, 'ad'),
        kayitlariGetir('giderler', ['ad', 'tur', 'periyot', 'tutar', 'para_birimi', 'baslangic', 'bitis', 'aktif'], {}, 'ad'),
        kayitlariGetir('varliklar', ['tur', 'ad', 'anapara', 'guncel_deger', 'vade_tarihi'], {}, 'ad'),
        kayitlariGetir('hesaplar', ['tur', 'acilis_bakiyesi', 'aktif'], {}, 'ad'),
        kayitlariGetir('hareketler', ['hesap_id', 'yon', 'tutar'], {}, 'tarih'),
        kayitlariGetir('davalar', ['tur', 'konu', 'mahkeme', 'durum', 'sonraki_durusma'], {}, 'sonraki_durusma'),
        kayitlariGetir('alinacaklar', ['ad', 'tahmini_tutar', 'hedef_tarih', 'durum'], {}, 'ad'),
        icraDosyalariniGetir(), imzaGetir(), ayarOku<{ idler?: string[] }>('danisman_gizli'),
      ]);
      const vadesiz = new Set(hesaplar.filter(h => h.tur === 'vadesiz' && h.aktif !== false).map(h => h.id));
      const nakit = hesaplar.filter(h => vadesiz.has(h.id)).reduce((t, h) => t + Number(h.acilis_bakiyesi), 0)
        + hareketler.filter(h => vadesiz.has(String(h.hesap_id))).reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * Number(h.tutar), 0);
      const girdi: DanismanGirdi = { bugun: bugunAnahtari(), nakit, borclar, odemeler, gelirler, giderler, varliklar, serbest: panel.serbest, icra, imza, gelir: panel.gelir, gider: panel.gider };
      const hepsi = bulgular(girdi);
      let gizli = new Set(gizliAyar?.deger?.idler ?? []);
      let ek = 0;

      const gizleKaydet = async () => {
        try { await ayarYaz('danisman_gizli', { idler: [...gizli].slice(-300) }); }
        catch (e) { if (e instanceof CakismaHatasi) await ayarYaz('danisman_gizli', { idler: [...gizli].slice(-300) }); else throw e; }
      };

      const ciz = () => {
        const gorunur = hepsi.filter(b => !gizli.has(b.id));
        const ozet = el('div', 'icra-ozet');
        const hucre = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
        const say = (s: Bulgu['seviye']) => gorunur.filter(b => b.seviye === s).length;
        hucre('Kritik', String(say('kritik')), 'hemen bakılmalı', say('kritik') ? 'uyari' : '');
        hucre('Uyarı', String(say('uyari')), 'bu hafta bakılmalı');
        hucre('Fırsat', String(say('firsat')), 'kazanç ya da tasarruf');
        hucre('Yıllık potansiyel', tl(gorunur.reduce((t, b) => t + b.tasarruf, 0)), 'önerilen adımların toplamı', 'vurgu');

        const liste = el('div', 'dnm-liste');
        if (!gorunur.length) liste.appendChild(el('p', 'bos', 'Şu an dikkat gerektiren bir bulgu yok.'));
        gorunur.forEach(b => {
          const k = el('article', `dnm-bulgu s-${b.seviye}`);
          const ust = el('div', 'dnm-ust'); ust.append(el('span', 'dnm-rozet', SEVIYE[b.seviye]), el('b', '', b.baslik));
          const alt = el('p', '', b.aciklama);
          const eylem = el('div', 'form-dugmeler');
          const git_ = el('button', 'btn sm', b.etiket); git_.type = 'button'; git_.addEventListener('click', () => git(b.git));
          const gizle = el('button', 'btn ghost sm', 'İlgilenmiyorum'); gizle.type = 'button';
          gizle.addEventListener('click', async () => { gizli.add(b.id); ciz(); try { await gizleKaydet(); } catch (e) { bildir(hataMetni(e), undefined, true); } });
          eylem.append(git_, gizle);
          if (b.tasarruf > 0) ust.appendChild(el('span', 'dnm-tasarruf', `yılda ~${tl(b.tasarruf)}`));
          k.append(ust, alt, eylem); liste.appendChild(k);
        });
        if (hepsi.length > gorunur.length) {
          const geri = el('button', 'btn ghost sm', `Gizlenen ${hepsi.length - gorunur.length} bulguyu geri getir`); geri.type = 'button';
          geri.addEventListener('click', async () => { gizli = new Set(); ciz(); try { await gizleKaydet(); } catch (e) { bildir(hataMetni(e), undefined, true); } });
          liste.appendChild(geri);
        }

        const s = siradaHesapla(girdi, davalar, alinacaklar, ek);
        const sirada = el('section', 'dnm-sirada');
        sirada.appendChild(el('h3', '', 'Sırada ne var'));
        const ekGiris = el('input'); ekGiris.type = 'number'; ekGiris.min = '0'; ekGiris.step = '500'; ekGiris.value = String(ek); ekGiris.id = 'dnm-ek';
        const ekEtiket = el('label', 'alan'); ekEtiket.append(el('span', '', `Aylık ek ödeme (şu an taksitler ${tl(s.butce - ek)})`), ekGiris);
        ekGiris.addEventListener('change', () => { ek = Math.max(0, Number(ekGiris.value) || 0); ciz(); });
        sirada.appendChild(ekEtiket);
        const tablo = (baslik: string, kolonlar: string[], satirlar: string[][], bos: string) => {
          const b = el('div', 'dnm-blok'); b.appendChild(el('h4', '', baslik));
          if (!satirlar.length) { b.appendChild(el('p', 'bos', bos)); return b; }
          const t = el('table'), bs = el('tr'); kolonlar.forEach(x => bs.appendChild(el('th', '', x)));
          t.appendChild(el('thead')).appendChild(bs);
          const g = el('tbody'); satirlar.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.appendChild(el('td', i ? 'sayi' : '', c))); g.appendChild(tr); });
          t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); b.appendChild(sarma); return b;
        };
        const aylar = (k: number) => new Date(new Date().getFullYear(), new Date().getMonth() + k, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        sirada.append(
          tablo('Bu turda kapanacak borçlar (ilk 2 ay)', ['Borç', 'Kapanış'], s.buTur.map(x => [x.ad, `${x.ay}. ay · ${aylar(x.ay)}`]), 'İlk 2 ayda tam kapanış öngörülmüyor.'),
          tablo('Sonraki sırada (3–6. ay)', ['Borç', 'Öngörülen kapanış'], s.sonraki.map(x => [x.ad, `${x.ay}. ay · ${aylar(x.ay)}`]), 'Bu aralıkta kapanış yok.'),
          tablo('Yaklaşan ödemeler (31 gün)', ['Kalem', 'Tutar', 'Vade', 'Kalan'], s.taksitler.slice(0, 15).map(x => [x.ad, tl(x.tutar), gun(x.vade), x.kalan < 0 ? `${-x.kalan} gün gecikti` : x.kalan === 0 ? 'BUGÜN' : `${x.kalan} gün`]), '31 gün içinde bekleyen ödeme yok.'),
          tablo('Sıradaki alımlar (3 ay)', ['Kalem', 'Tutar', 'Hedef'], s.alimlar.map(x => [x.ad, tl(x.tutar), gun(x.tarih)]), 'Planlı alım yok.'),
          tablo('Tarihli işler', ['İş', 'Tarih', 'Kalan'], s.tarihli.map(x => [x.ad, gun(x.tarih), x.kalan <= 0 ? 'BUGÜN' : `${x.kalan} gün`]), 'Yaklaşan duruşma ya da vade yok.'));
        kart.replaceChildren(ozet, liste, sirada);
      };
      ciz();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
