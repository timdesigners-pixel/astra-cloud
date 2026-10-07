import './saglik.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { degerSor } from '../../ortak/kutu';
import { hataMetni } from '../../veri/hata';
import { TUR_BILGI, anahtarIptal, anahtarUret, anahtarlariGetir, esitlemeAdresi, olcumleriKaydet, type Anahtar, type OlcumTuru } from '../../veri/saglik';
import { dosyadanOku, type Sonuc } from './ice-aktar';

/* Cihaz Senkronu: telefon ve akıllı saat için senkron anahtarı + kurulum rehberi, dosyadan içe aktarma. */
const goreli = (iso: string) => {
  const dk = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : dk < 1440 ? `${Math.round(dk / 60)} saat önce` : `${Math.round(dk / 1440)} gün önce`;
};
const kopyala = async (metin: string) => {
  try { await navigator.clipboard.writeText(metin); bildir('Kopyalandı'); } catch { bildir('Kopyalanamadı; metni elle seçip kopyala', undefined, true); }
};
const kodKutusu = (metin: string, etiket = 'Kopyala') => {
  const k = el('div', 'sg-kod');
  const pre = el('pre'); pre.textContent = metin;
  const b = el('button', 'btn ghost sm', etiket); b.type = 'button'; b.addEventListener('click', () => void kopyala(metin));
  k.append(pre, b);
  return k;
};
const rehber = (baslik: string, ...icerik: (Node | string)[]) => {
  const d = el('details', 'sg-rehber');
  d.appendChild(el('summary', '', baslik));
  const g = el('div', 'sg-rehber-govde');
  icerik.forEach(x => g.append(typeof x === 'string' ? el('p', '', x) : x));
  d.appendChild(g);
  return d;
};
const liste = (...maddeler: string[]) => { const ol = el('ol'); maddeler.forEach(m => ol.appendChild(el('li', '', m))); return ol; };

const ORNEK_JSON = `{
  "tarih": "2026-10-07",
  "adim": 8421,
  "nabiz": 72,
  "dinlenme_nabzi": 58,
  "uyku_saat": 7.5,
  "kilo": 82.3,
  "tansiyon": "118/78",
  "spo2": 97
}`;

export function cihazSayfasi(kok: HTMLElement) {
  const s = { anahtarlar: [] as Anahtar[], yukleniyor: true, hata: '' };
  const kart = el('section', 'card sg');
  kok.replaceChildren(kart);

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { s.anahtarlar = await anahtarlariGetir(); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  async function yeniAnahtar() {
    const ad = await degerSor({ baslik: 'Yeni senkron anahtarı', etiket: 'Bu anahtar hangi cihaz için?', deger: '', ipucu: 'Örnek: iPhone, Galaxy Watch', sinir: 80, kaydet: 'Anahtar üret' });
    if (ad === null) return;
    if (!ad.trim()) { bildir('Bir ad yaz', undefined, true); return; }
    try {
      const { belirtec } = await anahtarUret(ad);
      await yukle();
      anahtarGoster(ad.trim(), belirtec);
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  function anahtarGoster(ad: string, belirtec: string) {
    const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', 'Senkron anahtarı');
    dlg.appendChild(el('h2', '', `"${ad}" anahtarı hazır`));
    dlg.appendChild(el('p', 'sg-uyari', 'Bu anahtar bir daha gösterilmez. Şimdi kopyalayıp telefondaki uygulamaya yapıştır; kaybedersen iptal edip yenisini üretirsin.'));
    dlg.appendChild(el('h3', '', 'Anahtar'));
    dlg.appendChild(kodKutusu(belirtec));
    dlg.appendChild(el('h3', '', 'Gönderim adresi'));
    dlg.appendChild(kodKutusu(esitlemeAdresi()));
    dlg.appendChild(el('h3', '', 'Tek adresle kullan (Kısayollar gibi araçlar için)'));
    dlg.appendChild(kodKutusu(`${esitlemeAdresi()}?anahtar=${belirtec}&adim=8421&nabiz=72&uyku_saat=7.5`));
    const sonuc = el('p', 'sg-not');
    const dene = el('button', 'btn', 'Bağlantıyı dene'); dene.type = 'button';
    dene.addEventListener('click', async () => {
      dene.disabled = true; sonuc.textContent = 'Deneniyor…';
      try {
        const r = await fetch(esitlemeAdresi(), { method: 'POST', headers: { Authorization: `Bearer ${belirtec}`, 'Content-Type': 'application/json' }, body: '{}' });
        sonuc.textContent = r.status === 422 || r.status === 200 ? '✓ Alıcı anahtarını tanıdı; veri göndermeye hazırsın.' : r.status === 401 ? '✕ Anahtar tanınmadı.' : `Beklenmeyen yanıt (${r.status}).`;
      } catch { sonuc.textContent = '✕ Alıcıya ulaşılamadı; bağlantını kontrol et.'; }
      dene.disabled = false;
    });
    const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
    const dugmeler = el('div', 'form-dugmeler'); dugmeler.append(dene, kapat);
    dlg.append(sonuc, dugmeler);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg); dlg.showModal();
  }

  function anahtarBolumu(): HTMLElement {
    const b = el('section', 'sg-bolum');
    const bas = el('div', 'sg-ust');
    bas.append(el('h3', '', 'Telefon ve akıllı saat → Astra (otomatik)'), el('span', 'tbar-sp'));
    const yeni = el('button', 'btn primary sm', '＋ Yeni anahtar'); yeni.type = 'button'; yeni.addEventListener('click', () => void yeniAnahtar());
    bas.appendChild(yeni);
    b.appendChild(bas);
    b.appendChild(el('p', 'sg-not', 'Telefonundaki ya da saatindeki bir uygulama, sağlık verilerini bu anahtarla Astra\'ya gönderir. Her cihaz için ayrı anahtar üret; istediğin zaman iptal edebilirsin. Gönderilen veriler günlük özet olarak Sağlık Özeti\'nde görünür.'));
    if (s.yukleniyor) { b.appendChild(el('p', 'bos', 'Yükleniyor…')); return b; }
    if (s.hata) { b.appendChild(el('p', 'bos hata', s.hata)); return b; }
    const aktif = s.anahtarlar.filter(a => !a.iptal_at);
    if (!aktif.length) b.appendChild(el('p', 'bos', 'Henüz anahtar yok.'));
    else {
      const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
      ['Cihaz', 'Oluşturuldu', 'Son veri', 'Gönderim', ''].forEach(x => bs.appendChild(el('th', '', x)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody');
      aktif.forEach(a => {
        const tr = el('tr');
        tr.append(el('td', '', a.ad), el('td', '', new Date(a.olusturma).toLocaleDateString('tr-TR')),
          el('td', '', a.son_kullanim ? `${goreli(a.son_kullanim)}${a.son_sonuc ? ' · ' + a.son_sonuc : ''}` : 'henüz gelmedi'), el('td', 'sayi', String(a.kullanim_sayisi)));
        const td = el('td');
        const iptal = el('button', 'btn danger sm', 'İptal et'); iptal.type = 'button';
        iptal.addEventListener('click', async () => {
          if (!(await onayla({ baslik: 'Anahtar iptal edilsin mi?', metin: `"${a.ad}" artık veri gönderemez. Daha önce gelen veriler silinmez.`, evet: 'İptal et' }))) return;
          try { await anahtarIptal(a.id); bildir('Anahtar iptal edildi'); void yukle(); } catch (e) { bildir(hataMetni(e), undefined, true); }
        });
        td.appendChild(iptal); tr.appendChild(td); g.appendChild(tr);
      });
      tablo.appendChild(g); sarma.appendChild(tablo); b.appendChild(sarma);
    }
    b.appendChild(el('h4', '', 'Kurulum rehberi'));
    b.appendChild(rehber('iPhone ve Apple Watch',
      'Apple Sağlık verisini otomatik göndermek için App Store\'daki "Health Auto Export" uygulaması kullanılır (ücretsiz sürüm sınırlı olabilir). Apple, sağlık verisini doğrudan web sitelerine vermez; bu uygulama arada köprü olur.',
      liste(
        'Yukarıdan bu iPhone için bir anahtar üret ve anahtarı kopyala.',
        'Health Auto Export\'u aç → Automations → yeni otomasyon → "REST API" türünü seç.',
        'URL kısmına yukarıdaki "Gönderim adresi"ni yapıştır. Yöntem: POST. Biçim: JSON.',
        'Headers kısmına yeni üst bilgi ekle: ad "Authorization", değer "Bearer " + anahtarın (Bearer\'dan sonra bir boşluk bırak).',
        'Veri türleri: Adım, Aktif Enerji, Yürüme+Koşma Mesafesi, Kalp Atış Hızı, Dinlenme Kalp Atışı, Uyku Analizi, Vücut Kütlesi, Kan Oksijeni, Tansiyon seçebilirsin. Toplama: "Günlük".',
        'Zamanlamayı kur (örn. her saat) ve "Şimdi çalıştır"a bas. Bu sayfada "Son veri" satırı dolduysa tamam.',
      ),
      'Apple Watch verisi iPhone\'daki Sağlık uygulamasına zaten aktarıldığı için ayrıca bir şey kurmana gerek yok.'));
    b.appendChild(rehber('Android, Wear OS, Samsung, Garmin, Fitbit',
      'Bu platformlarda sağlık verisini otomatik gönderen hazır bir köprü uygulamamız yok. İki yolun var:',
      liste(
        'Dosyayla: Samsung Health, Garmin Connect, Fitbit/Google gibi uygulamalar verilerini .csv olarak dışa aktarabilir. Dosyayı aşağıdaki "Dosyadan içe aktar" bölümüne yükle.',
        'Otomasyon uygulamasıyla: Tasker, MacroDroid ya da HTTP Shortcuts gibi bir uygulamayla aşağıdaki JSON örneğini yukarıdaki adrese POST edebilirsin (üst bilgi: Authorization: Bearer anahtar).',
      )));
    b.appendChild(rehber('Elle ya da Kısayollar ile gönderim (örnek biçimler)',
      'Alıcı şu alan adlarını tanır (Türkçe ya da İngilizce): adim, nabiz, dinlenme_nabzi, hrv, uyku_saat (ya da uyku_dk), kilo, yag_orani, spo2, tansiyon ("118/78"), glukoz, ates, su_ml, mesafe_km, kalori. "tarih" verilmezse bugüne yazılır; aynı gün tekrar gönderilirse üzerine yazılır.',
      kodKutusu(ORNEK_JSON), 'Dizi halinde birden çok gün de gönderilebilir: [{"tarih":"2026-10-05","adim":9000},{"tarih":"2026-10-06","adim":7000}]. Yalnız adres açabilen araçlar (iOS Kısayollar → "URL\'nin içeriğini al") için aynı alanlar adresin sonuna ?adim=8421&nabiz=72 diye eklenebilir.'));
    return b;
  }

  function iceAktarBolumu(): HTMLElement {
    const b = el('section', 'sg-bolum');
    b.appendChild(el('h3', '', 'Dosyadan içe aktar'));
    b.appendChild(el('p', 'sg-not', 'Dosya tarayıcında okunur, ham dosya hiçbir yere gönderilmez; yalnız günlük özetler kaydedilir. Aynı gün için tekrar yüklemek öncekinin üzerine yazar.'));
    const dosya = el('input'); dosya.type = 'file'; dosya.accept = '.zip,.xml,.csv,.tsv,.txt,.json'; dosya.id = 'sg-dosya';
    dosya.setAttribute('aria-label', 'İçe aktarılacak dosya');
    const aralik = el('select'); aralik.id = 'sg-ice-aralik';
    [['30', 'Son 30 gün'], ['90', 'Son 90 gün'], ['365', 'Son 1 yıl'], ['0', 'Hepsi']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; aralik.appendChild(o); });
    aralik.value = '90';
    const oku = el('button', 'btn', 'Dosyayı oku'); oku.type = 'button';
    const durum = el('p', 'sg-not');
    const onizleme = el('div', 'sg-onizleme');
    let sonuc: Sonuc | null = null;
    const satir = el('div', 'sg-satir'); satir.append(dosya, aralik, oku);
    b.append(satir, durum, onizleme);
    oku.addEventListener('click', async () => {
      const f = dosya.files?.[0];
      if (!f) { durum.textContent = 'Önce bir dosya seç.'; return; }
      oku.disabled = true; onizleme.replaceChildren(); sonuc = null;
      try {
        sonuc = await dosyadanOku(f, Number(aralik.value), m => { durum.textContent = m; });
        durum.textContent = sonuc.ozet;
        if (!sonuc.satirlar.length) return;
        const say = new Map<OlcumTuru, number>();
        sonuc.satirlar.forEach(x => say.set(x.tur, (say.get(x.tur) ?? 0) + 1));
        const ozet = el('ul', 'sg-ozet-liste');
        [...say.entries()].forEach(([t, n]) => ozet.appendChild(el('li', '', `${TUR_BILGI[t].simge} ${TUR_BILGI[t].etiket}: ${n} gün`)));
        const kaydet = el('button', 'btn primary', `${sonuc.satirlar.length} ölçümü içe aktar`); kaydet.type = 'button';
        kaydet.addEventListener('click', async () => {
          kaydet.disabled = true;
          try { await olcumleriKaydet(sonuc!.satirlar); bildir('İçe aktarıldı'); durum.textContent = `✓ ${sonuc!.satirlar.length} ölçüm kaydedildi. Sağlık Özeti\'nde görebilirsin.`; onizleme.replaceChildren(); dosya.value = ''; }
          catch (e) { kaydet.disabled = false; bildir(hataMetni(e), undefined, true); }
        });
        onizleme.append(ozet, kaydet);
      } catch (e) { durum.textContent = hataMetni(e); }
      oku.disabled = false;
    });
    b.appendChild(rehber('Hangi dosyayı nasıl alırım?',
      liste(
        'iPhone: Sağlık uygulaması → sağ üstte profil resmin → "Tüm Sağlık Verilerini Dışa Aktar". Çıkan export.zip dosyasını buraya yükle (büyük olabilir; yüzlerce MB sorun değil, tarayıcıda parça parça okunur).',
        'Samsung Health, Garmin, Fitbit vb.: uygulamanın "verilerimi dışa aktar" bölümünden .csv al. İlk satırda "Tarih" ile "Adım", "Nabız", "Uyku", "Kilo", "Kalori", "Mesafe" gibi başlıklar olması yeterli.',
        'Health Auto Export\'tan aldığın .json dosyaları da yüklenebilir.',
      )));
    return b;
  }

  function ciz() {
    kart.replaceChildren();
    const ust = el('div', 'sg-ust');
    ust.appendChild(el('h2', '', 'Cihaz Senkronu'));
    kart.append(ust, anahtarBolumu(), iceAktarBolumu());
  }
  ciz();
  void yukle();
}
