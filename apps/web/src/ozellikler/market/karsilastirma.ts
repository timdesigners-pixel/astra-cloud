import { el } from '../../ortak/dom';
import { gun, tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { fisleriGetir, kalemleriGetir, urunleriGetir } from '../../veri/market';
import { fiyatDegisimleri, marketFiyatlari, teklifSirala, type FiyatKaydi } from './hesap';

export function karsilastirmaSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [fisler, kalemler, urunler] = await Promise.all([fisleriGetir(), kalemleriGetir(), urunleriGetir()]);
      const fis = new Map(fisler.map(f => [f.id, f]));
      const kayitlar: FiyatKaydi[] = kalemler.flatMap(k => { const f = fis.get(k.fis_id); return f ? [{ urun_id: k.urun_id, market: f.market, tarih: f.tarih, birim_fiyat: Number(k.birim_fiyat) }] : []; });
      const urunAdi = (id: string) => urunler.find(u => u.id === id)?.ad ?? '—';
      const tablo = (basliklar: string[], satirlar: string[][]) => {
        const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
        basliklar.forEach(h => bs.appendChild(el('th', '', h)));
        t.appendChild(el('thead')).appendChild(bs);
        const g = el('tbody');
        satirlar.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.appendChild(el('td', i > 0 && /\d/.test(c) ? 'sayi gz' : '', c))); g.appendChild(tr); });
        t.appendChild(g); sarma.appendChild(t); return sarma;
      };

      /* 1) ürün fiyat geçmişi */
      const bolum1 = el('div', 'rapor-icerik');
      bolum1.appendChild(el('h3', '', 'Ürün fiyatı: hangi markette ucuz?'));
      const sec = el('select'); sec.id = 'kars-urun'; sec.setAttribute('aria-label', 'Ürün');
      const fiyatli = urunler.filter(u => kayitlar.some(k => k.urun_id === u.id));
      const b0 = el('option', '', fiyatli.length ? 'Ürün seç' : 'Henüz fişli ürün yok'); b0.value = ''; sec.appendChild(b0);
      fiyatli.forEach(u => { const o = el('option', '', u.ad); o.value = u.id; sec.appendChild(o); });
      const sonuc = el('div');
      sec.addEventListener('change', () => {
        sonuc.replaceChildren();
        if (!sec.value) return;
        const m = marketFiyatlari(kayitlar, sec.value);
        sonuc.appendChild(el('p', 'bos', m.length > 1 ? `En ucuz: ${m[0]!.market} (son fiyat ${tl(m[0]!.son)}). En pahalı ${m[m.length - 1]!.market} ${tl(m[m.length - 1]!.son)}.` : `Yalnız ${m[0]!.market} markette fişin var; karşılaştırma için başka markette de fiş gir.`));
        sonuc.appendChild(tablo(['Market', 'Son fiyat', 'Ortalama', 'En düşük', 'Fiş', 'Son alış'], m.map(x => [x.market, tl(x.son), tl(x.ortalama), tl(x.enDusuk), String(x.adet), gun(x.sonTarih)])));
      });
      bolum1.append(sec, sonuc);

      /* 2) son fiyat değişimleri */
      const degisim = fiyatDegisimleri(kayitlar).filter(x => Math.abs(x.yuzde) >= 1);
      const bolum2 = el('div', 'rapor-icerik');
      bolum2.appendChild(el('h3', '', 'Son alışverişte fiyatı değişenler'));
      bolum2.appendChild(degisim.length ? tablo(['Ürün', 'Önceki', 'Son', 'Değişim'], degisim.slice(0, 15).map(x => [urunAdi(x.urun_id), tl(x.onceki), tl(x.son), `${x.yuzde > 0 ? '+' : '−'}%${Math.abs(Math.round(x.yuzde))}`]))
        : el('p', 'bos', 'Aynı ürünü iki kez aldıkça fiyat değişimleri burada görünür.'));

      /* 3) teklif karşılaştırma */
      const bolum3 = el('div', 'rapor-icerik');
      bolum3.appendChild(el('h3', '', 'Teklif karşılaştır: birim fiyata göre'));
      const satirlar = el('div', 'fis-satirlar'), sira = el('div');
      type S = { ad: HTMLInputElement; fiyat: HTMLInputElement; miktar: HTMLInputElement };
      const liste: S[] = [];
      const hesapla = () => {
        const s = teklifSirala(liste.map(r => ({ ad: r.ad.value.trim() || 'Seçenek', fiyat: Number(r.fiyat.value), miktar: Number(r.miktar.value) })));
        sira.replaceChildren();
        if (s.length < 2) { sira.appendChild(el('p', 'bos', 'En az iki seçenek için fiyat ve miktar gir.')); return; }
        sira.appendChild(el('p', 'bos', `En uygun: ${s[0]!.ad}. Birim fiyatı ${tl(s[0]!.birim)}, en pahalıdan %${Math.round((1 - s[0]!.birim / s[s.length - 1]!.birim) * 100)} ucuz.`));
        sira.appendChild(tablo(['Seçenek', 'Fiyat', 'Miktar', 'Birim fiyat'], s.map(x => [x.ad, tl(x.fiyat), String(x.miktar), tl(x.birim)])));
      };
      const satirEkle = () => {
        const k = el('div', 'fis-satir');
        const a = el('input'); a.placeholder = 'Seçenek (marka, paket…)'; a.setAttribute('aria-label', 'Seçenek');
        const f = el('input'); f.type = 'number'; f.step = '0.01'; f.min = '0'; f.placeholder = 'Toplam fiyat'; f.setAttribute('aria-label', 'Fiyat');
        const m = el('input'); m.type = 'number'; m.step = '0.001'; m.min = '0'; m.placeholder = 'Miktar (kg, lt, adet)'; m.setAttribute('aria-label', 'Miktar');
        const sil = el('button', 'btn ghost xs', '×'); sil.type = 'button'; sil.setAttribute('aria-label', 'Satırı sil');
        const r = { ad: a, fiyat: f, miktar: m };
        [a, f, m].forEach(x => x.addEventListener('input', hesapla));
        sil.addEventListener('click', () => { liste.splice(liste.indexOf(r), 1); k.remove(); hesapla(); });
        k.append(a, f, m, sil); satirlar.appendChild(k); liste.push(r);
      };
      satirEkle(); satirEkle();
      const ekle = el('button', 'btn ghost sm', '+ Seçenek'); ekle.type = 'button'; ekle.id = 'kars-ekle'; ekle.addEventListener('click', satirEkle);
      bolum3.append(satirlar, ekle, sira);
      hesapla();

      kart.replaceChildren(bolum1, bolum2, bolum3);
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
