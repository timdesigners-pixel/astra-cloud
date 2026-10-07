/* Komut paleti · çalıştırma. Palet bir komutu seçince bu modül tembel yüklenir (açılış paketine girmez). */
import { bildir } from '../../ortak/bildirim';
import { degerSor } from '../../ortak/kutu';
import { bugunAnahtari } from '../../ortak/zaman';
import { katla } from '../../ortak/dom';
import { git } from '../../kabuk/yonlendirici';
import { donemeGit } from '../../kabuk/donem';
import { temaAyarla } from '../../kabuk/tema';
import { hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir } from '../../veri/kayit';
import { notEkle, saglikGetir, saglikYaz } from '../../veri/karsilama';
import { panelSifirla } from '../../veri/panel';
import { kurGetir } from '../genel/dis-veri';
import type { Komut } from './eslestir';

const bugun = () => bugunAnahtari();
const kayitlandi = () => { panelSifirla(); document.dispatchEvent(new Event('astra:veri')); };

async function kopyala(metin: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
}

async function kabukKomutlari() { return (await import('../../kabuk/kabuk')).kabukKomutlari; }

/* ---------- sağlık ---------- */
async function saglikEkle(alan: 'su_ml' | 'adim' | 'kalori', miktar: number, ad: string) {
  const g = bugun();
  const mevcut = await saglikGetir(g);
  const yeni = (mevcut?.[alan] ?? 0) + miktar;
  await saglikYaz(g, { [alan]: yeni });
  bildir(`${ad}: bugün toplam ${yeni.toLocaleString('tr-TR')}`);
}

const uykuMetni = (saat: number) => `${Math.floor(saat)}s ${Math.round((saat % 1) * 60)}dk`;

/* ---------- kişi borcu ---------- */
async function kisiBorcu(p: Record<string, any>) {
  const adaylar = (p.ad as string[]).map(katla);
  const kisiler = await kayitlariGetir('kisiler', ['ad', 'takma_adlar'], {}, 'ad');
  let kisi = kisiler.find(k => [String(k.ad), ...((k.takma_adlar as string[] | null) ?? [])].some(a => adaylar.includes(katla(a))));
  let yeniKisi = false;
  if (!kisi) {
    kisi = await kayitEkle('kisiler', ['ad'], { ad: String(p.ad[0]), tur: 'kisi' });
    yeniKisi = true;
  }
  const acik = (await kayitlariGetir('borclar', ['tur', 'ad', 'yon', 'alacakli_id', 'anapara', 'guncel_borc', 'durum'], {}, 'ad'))
    .find(b => b.tur === 'kisi' && b.yon !== 'alacakli' && b.durum !== 'kapandi' && b.alacakli_id === kisi!.id);
  const tutar = Number(p.tutar);
  if (acik) {
    const guncel = p.mod === 'ayarla' ? tutar : Number(acik.guncel_borc) + tutar;
    const anapara = Math.max(Number(acik.anapara), p.mod === 'ayarla' ? tutar : Number(acik.anapara) + tutar);
    await kayitGuncelle('borclar', ['guncel_borc'], acik.id, acik.surum, { guncel_borc: guncel, anapara });
    bildir(`${kisi.ad}: açık borç ${guncel.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })} oldu`);
  } else {
    await kayitEkle('borclar', ['ad'], { tur: 'kisi', ad: `${kisi.ad} borcu`, alacakli_id: kisi.id, anapara: tutar, guncel_borc: tutar, baslangic_tarihi: bugun() });
    bildir(`${kisi.ad}${yeniKisi ? ' Kişiler\'e eklendi, ' : ': '}yeni borç açıldı`);
  }
}

/* ---------- hızlı ekleme ---------- */
async function hizli(c: Komut) {
  const p = (c.p ?? {}) as Record<string, any>;
  const gun = Number(bugun().slice(8, 10));
  switch (c.desen) {
    case 'su': return saglikEkle('su_ml', p.ml, 'Su');
    case 'adim': return saglikEkle('adim', p.v, 'Adım');
    case 'kalori': return saglikEkle('kalori', p.v, 'Kalori');
    case 'uyku': await saglikYaz(bugun(), { uyku: uykuMetni(p.v) }); bildir(`Uyku kaydedildi: ${uykuMetni(p.v)}`); return;
    case 'tansiyon': await saglikYaz(bugun(), { tansiyon: p.v }); bildir(`Tansiyon kaydedildi: ${p.v}`); return;
    case 'nabiz': await saglikYaz(bugun(), { nabiz: p.v }); bildir(`Nabız kaydedildi: ${p.v}`); return;
    case 'kisi-borc': await kisiBorcu(p); kayitlandi(); return;
    case 'gider':
      await kayitEkle('giderler', ['ad'], { ad: p.ad, tur: 'tek_sefer', periyot: 'tek_sefer', tutar: p.tutar, baslangic: bugun() });
      bildir(`Gider eklendi: ${p.ad}`); kayitlandi(); return;
    case 'sabit-gider':
      await kayitEkle('giderler', ['ad'], { ad: p.ad, tur: p.abonelik ? 'abonelik' : 'sabit', periyot: 'aylik', tutar: p.tutar, gun, baslangic: bugun() });
      bildir(`${p.abonelik ? 'Abonelik' : 'Sabit gider'} eklendi: ${p.ad}`); kayitlandi(); return;
    case 'gelir':
      await kayitEkle('gelirler', ['ad'], p.tek
        ? { ad: p.ad, tur: 'diger', sabit: false, periyot: 'tek_sefer', tutar: p.tutar, baslangic: bugun() }
        : { ad: p.ad, tur: /maas/.test(katla(p.ad)) ? 'maas' : 'diger', sabit: true, periyot: 'aylik', tutar: p.tutar, gun, baslangic: bugun() });
      bildir(`Gelir eklendi: ${p.ad}`); kayitlandi(); return;
    case 'alinacak':
      await kayitEkle('alinacaklar', ['ad'], { ad: p.ad, tahmini_tutar: p.tutar || null });
      bildir(`Alınacaklara eklendi: ${p.ad}`); kayitlandi(); return;
    case 'kiler': {
      const urunler = await kayitlariGetir('urunler', ['ad', 'stok_miktari'], {}, 'ad');
      const var_ = urunler.find(u => katla(String(u.ad)) === katla(p.ad));
      if (var_) await kayitGuncelle('urunler', ['stok_miktari'], var_.id, var_.surum, { stok_miktari: Number(var_.stok_miktari) + p.adet });
      else await kayitEkle('urunler', ['ad'], { ad: p.ad, birim: p.birim, stok_miktari: p.adet });
      bildir(`Kilere eklendi: ${p.adet} ${p.birim} ${p.ad}`); kayitlandi(); return;
    }
    case 'gorev':
      await kayitEkle('todolar', ['baslik'], { baslik: p.ad, tarih: p.due || null, oncelik: p.acil ? 'yuksek' : 'orta' });
      bildir(`Görev eklendi: ${p.ad}`); kayitlandi(); return;
    case 'hatirlat':
      await kayitEkle('ajanda_olaylari', ['baslik'], { baslik: p.ad, tarih: p.gun, saat: p.saat });
      bildir(`Hatırlatıcı eklendi: ${p.ad} · ${p.gun} ${p.saat}`); kayitlandi(); return;
    case 'not': await notEkle(p.ad); bildir('Hızlı not eklendi'); return;
    case 'hedef':
      await kayitEkle('hedefler', ['ad'], { ad: p.ad, hedef_tutar: p.tutar || 0 });
      bildir(`Hedef eklendi: ${p.ad}`); kayitlandi(); return;
    case 'donem': donemeGit(p.donem); return;
    case 'hesap':
      bildir((await kopyala(String(p.v))) ? `${p.ifade} = ${p.v.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} (panoya kopyalandı)` : `Sonuç: ${p.v}`);
      return;
    case 'tema': temaAyarla(p.v); (await kabukKomutlari()).yenile(false); return;
    case 'gizlilik': (await kabukKomutlari()).gizlilik(p.v); return;
  }
}

/* ---------- sabit komutlar ---------- */
async function sabit(c: Komut) {
  const k = await kabukKomutlari();
  switch (c.id) {
    case 'yedek': { const { yedekIndir } = await import('../sistem/sistem'); await yedekIndir(); return; }
    case 'kur': {
      const kur = await kurGetir(true);
      bildir(`Kur güncellendi: 1 USD = ${kur.usd.toLocaleString('tr-TR')} ₺${kur.gramAltin ? ` · gram altın ${kur.gramAltin.toLocaleString('tr-TR')} ₺` : ''}`);
      return;
    }
    case 'su-250': return saglikEkle('su_ml', 250, 'Su');
    case 'gorev-yeni': {
      const ad = await degerSor({ baslik: 'Yeni görev', etiket: 'Görev', ipucu: 'Todo\'s listesine eklenir', sinir: 300 });
      if (ad?.trim()) { await kayitEkle('todolar', ['baslik'], { baslik: ad.trim() }); bildir(`Görev eklendi: ${ad.trim()}`); kayitlandi(); }
      return;
    }
    case 'not-yeni': {
      const m = await degerSor({ baslik: 'Hızlı not', etiket: 'Not', tip: 'textarea', sinir: 2000 });
      if (m?.trim()) { await notEkle(m.trim()); bildir('Hızlı not eklendi'); kayitlandi(); }
      return;
    }
    case 'odeme-yeni': git('o-takvim'); return;
    case 'kisi-yeni': git('r-kisi'); return;
    case 'ajanda-yeni': git('a-ajanda'); return;
    case 'yazdir': window.setTimeout(() => window.print(), 50); return;
    case 'yenile': kayitlandi(); bildir('Veriler yenileniyor'); return;
    case 'kilit': location.reload(); return;
    case 'tema-koyu': temaAyarla('koyu'); k.yenile(false); return;
    case 'tema-acik': temaAyarla('acik'); k.yenile(false); return;
    case 'tema-sistem': temaAyarla('sistem'); k.yenile(false); return;
    case 'gizlilik': k.gizlilik(); return;
    case 'bildirim': k.bildirim(); return;
    case 'bugun': k.donem('bugun'); return;
    case 'onceki-ay': k.donem(-1); return;
    case 'sonraki-ay': k.donem(1); return;
    case 'kisayol': k.kisayol(); return;
    case 'menu-tur': k.menuTur(); return;
  }
}

export async function komutCalistir(c: Komut): Promise<void> {
  try {
    if (c.tur === 'sayfa' && c.sayfa) git(c.sayfa);
    else if (c.tur === 'hızlı') await hizli(c);
    else await sabit(c);
  } catch (e) { bildir(hataMetni(e), undefined, true); }
}

export async function cevapCalistir(c: Komut): Promise<void> {
  const e = c.eylem as { tip: string; metin?: string; sayfa?: string } | undefined;
  if (!e) return;
  if (e.tip === 'kopya') bildir((await kopyala(e.metin ?? '')) ? 'Kopyalandı' : 'Panoya kopyalanamadı', undefined, false);
  else if (e.tip === 'git' && e.sayfa) git(e.sayfa);
}
