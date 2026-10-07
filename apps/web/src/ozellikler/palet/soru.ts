/* Komut paleti · soru-cevap. "Zeki Baba'ya borç ne kadar?", "bu ay toplam gider", "kaç görevim var" gibi
   sorulara palet satırı olarak cevap kartı üretir. Saf mantık: veri dışarıdan (bağlam) verilir. */
import { kat, kok, type Komut } from './eslestir';
import { kisiAdaylari } from './desen';

export type KisiBorcu = { ad: string; takma: string[]; kalan: number; kalem: number };
export type SoruBaglam = {
  gelir: number; gider: number; serbest: number; borc: number; anapara: number; saglik: number; saglikEtiket: string;
  todoAcik: number; todoGecikmis: number; okunmamis: number; yedek: string | null; donem: string;
  kisiler: KisiBorcu[]; gizli: boolean;
};

const tlBicim = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });

function cevap(id: string, ad: string, ac: string, sayfa?: string, kopya?: string): Komut {
  return {
    id: 'cevap:' + id, tur: 'cevap', sim: '✦', ad, ac,
    eylem: kopya !== undefined ? { tip: 'kopya', metin: kopya } : sayfa ? { tip: 'git', sayfa } : undefined,
    eylemAd: kopya !== undefined ? 'Kopyala ↵' : sayfa ? 'Sayfayı aç ↵' : undefined,
  };
}

export function cevapUret(cumle: string, b: SoruBaglam): Komut[] {
  const t = kat(cumle).trim();
  if (t.length < 4) return [];
  const para = (n: number) => (b.gizli ? '₺ ••••' : tlBicim(n));
  const sonuc: Komut[] = [];
  const sorgu = /\?|ne kadar|kac|kaç|nedir|ne\b|kalan|toplam|var mi|durum/.test(t);

  /* Kişi borcu: "Zeki Baba'ya borç ne kadar", "Ahmet'in borcu". */
  if (/borc/.test(t) && sorgu) {
    const metin = cumle.replace(/borç\w*|borc\w*|ne kadar|kaç|kac|kalan|toplam|\?/gi, ' ').replace(/\s+/g, ' ').trim();
    const adaylar = kisiAdaylari(metin).map(kat);
    const bulunan = adaylar.length ? b.kisiler.filter(k => [k.ad, ...k.takma].some(a => {
      const x = kat(a);
      return adaylar.some(ad => x === ad || x.startsWith(ad) || ad.startsWith(x) || (ad.length >= 4 && kok(x) === kok(ad)));
    })) : [];
    bulunan.slice(0, 3).forEach(k => sonuc.push(cevap('kisi-' + k.ad,
      k.kalan > 0 ? `${k.ad}: ${para(k.kalan)} borç kalmış` : `${k.ad}: açık borç yok`,
      k.kalem ? `${k.kalem} açık kalem · Borçlar › Kişi Borçları\'nda ayrıntısı var.` : 'Bu kişiye açık borç kaydı bulunmuyor.', 'b-kisi')));
  }

  if (/toplam borc|ne kadar borc|borcum|borc toplam/.test(t) && !sonuc.length) {
    sonuc.push(cevap('borc', `Toplam açık borcun ${para(b.borc)}`, 'Borç Özeti sayfası kalemleri tek tek gösterir.', 'b-ozet'));
  }
  if (/\bgider/.test(t) && sorgu && !/hedef|ekle/.test(t)) {
    sonuc.push(cevap('gider', `${b.donem} toplam gider: ${para(b.gider)}`, 'Gider Özeti sayfası kalemleri ve dağılımı gösterir.', 'e-ozet'));
  }
  if (/\bgelir|maas|kazanc/.test(t) && sorgu && !/ekle/.test(t)) {
    sonuc.push(cevap('gelir', `${b.donem} toplam gelir: ${para(b.gelir)}`, 'Gelir Özeti sayfası kaynakları gösterir.', 'g-ozet'));
  }
  if (/serbest|butce|artan|kalan para|cebimde/.test(t) && sorgu) {
    sonuc.push(cevap('serbest', `${b.donem} serbest bütçe: ${para(b.serbest)}`, b.serbest < 0 ? 'Giderler geliri aşıyor.' : 'Gelirden giderler çıkarıldıktan sonra kalan.', 'e-ozet'));
  }
  if (/anapara|mevduat|birikim/.test(t) && sorgu) {
    sonuc.push(cevap('anapara', `Mevduat anaparası: ${para(b.anapara)}`, 'Birikim ve Yatırımlar › Mevduat sayfasında ayrıntı var.', 'v-mevduat'));
  }
  if (/gorev|todo|yapilacak/.test(t) && sorgu && !/ekle/.test(t)) {
    sonuc.push(cevap('gorev', `${b.todoAcik} açık görev var${b.todoGecikmis ? `, ${b.todoGecikmis} tanesi gecikmiş` : ''}`, 'Notlar › Todo\'s listesinde bekliyorlar.', 'n-todo'));
  }
  if (/saglik skor|finansal saglik|skorum/.test(t)) {
    sonuc.push(cevap('saglik', `Finansal sağlık skorun ${b.saglik} · ${b.saglikEtiket}`, 'Geciken ödeme, bütçe açığı ve borç/gelir oranından hesaplanır.', 'genel'));
  }
  if (/bildirim|uyari/.test(t) && sorgu) {
    sonuc.push(cevap('bildirim', `${b.okunmamis} okunmamış uyarı var`, 'Bildirim Merkezi\'ni açmak için N tuşuna bas.'));
  }
  if (/yedek/.test(t) && /ne zaman|son|kac gun|ne vakit/.test(t)) {
    sonuc.push(cevap('yedek', b.yedek ? `Son yedek ${b.yedek} alındı` : 'Henüz yedek alınmadı', 'Sistem Ayarları\'ndan yedeği indirebilirsin.', 'sistem'));
  }
  return sonuc.slice(0, 4);
}
