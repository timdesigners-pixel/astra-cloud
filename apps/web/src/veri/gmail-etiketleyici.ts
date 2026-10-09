/* Otomatik gelişmiş etiketleyici (saf): gönderen, konu ve içerik ipuçlarını puanlayıp etiket önerir ve nedenini söyler.
   Gönderen eşleşmesi 3, konu 2, içerik 1 puan; eşik 2 (hukuk için 1 gönderen/konu ipucu yeter). Kullanıcı kuralları her zaman uygulanır. */
export type Mektup = { gonderen: string; gonderenAdres: string; konu: string; snippet: string; govde?: string; toplu: boolean };
export type Kural = { id: string; ad: string; gonderen: string; konu: string; icerik: string; etiket: string; aktif: boolean };
export type Onem = 'yuksek' | 'normal' | 'dusuk';
export type Siniflama = { etiketler: string[]; nedenler: Record<string, string[]>; puan: Record<string, number>; onem: Onem };

export const ETIKET_ONEKI = 'Astra/';
export const ETIKET_RENKLERI: Record<string, string> = {
  'Önemli': 'var(--red)', 'Hukuk / İcra': 'var(--red)', 'Güvenlik': 'var(--red)', 'Bahis': 'var(--red)', 'Kişisel': 'var(--gold)', 'Resmi': 'var(--gold)',
  'Fatura': 'var(--cyan)', 'Abonelik': 'var(--cyan)', 'Seyahat': 'var(--cyan)', 'Ödeme': 'var(--green)', 'Banka': 'var(--green)', 'Sağlık': 'var(--green)',
  'Alışveriş': 'var(--orange, var(--gold))', 'Kargo': 'var(--orange, var(--gold))', 'Hesaplar': 'var(--violet, var(--cyan))', 'Yazılım': 'var(--violet, var(--cyan))',
  'Ödeme Bekliyor': 'var(--red)', 'Bülten': 'var(--dim)',
};

type Kategori = { ad: string; gonderen?: RegExp; konu?: RegExp; icerik?: RegExp; esik?: number };
const KATEGORILER: Kategori[] = [
  { ad: 'Hukuk / İcra', esik: 1, gonderen: /uyap|icra|adalet\.gov|barobirlik|noter|mahkeme|avukat/i, konu: /icra|uyap|tebligat|haciz|müzekkere|mahkeme|duruşma|e-?tebligat|ödeme emri|dava/i, icerik: /icra (dosya|müdürlü|dairesi)|ödeme emri|haciz|duruşma|tebligat|müzekkere|vekil/i },
  { ad: 'Fatura', gonderen: /fatura|billing|invoice|e-?arsiv|earsiv/i, konu: /e-?fatura|faturanız|fatura(sı)?\b|e-?arşiv|hesap özeti|invoice/i, icerik: /son ödeme tarihi|fatura (no|tutar)|ödenecek tutar|dönem(i)? tutar/i },
  { ad: 'Ödeme', gonderen: /payment|odeme|paytr|iyzico|param|papara|ininal/i, konu: /dekont|havale|eft\b|fast\b|ödeme(niz)? (alındı|başarı|onay)|tahsilat|makbuz|iade/i, icerik: /ödemeniz (alındı|tamam)|işlem (başarı|tamam)|dekont/i },
  { ad: 'Banka', gonderen: /garanti|yapıkredi|yapi ?kredi|isbank|akbank|ziraat|halkbank|vakifbank|denizbank|qnb|enpara|kuveyt|albaraka|fibabanka|anadolubank|odeabank|banka|bank\b/i, konu: /ekstre|kredi kartı|hesap hareket|asgari ödeme|kart borc|limit/i, icerik: /kart(ınızın)? (son ödeme|borç)|asgari ödeme|hesap özeti/i },
  { ad: 'Abonelik', gonderen: /turkcell|vodafone|turk ?telekom|superonline|netflix|spotify|youtube|disney|exxen|blutv|digiturk|tivibu|elektrik|dogalgaz|igdas|izsu|iski|enerjisa|gediz/i, konu: /abonelik|yenilen|üyelik(iniz)?|aboneliğiniz|renewal|subscription/i, icerik: /aboneliğiniz|otomatik yenile|deneme süresi|subscription/i },
  { ad: 'Alışveriş', gonderen: /trendyol|hepsiburada|amazon|n11|pttavm|ciceksepeti|getir|yemeksepeti|migros|a101|bim\b|sahibinden|letgo|temu|aliexpress/i, konu: /sipariş|siparişiniz|sepet|ürün(ünüz)?|satın al/i, icerik: /siparişiniz|sipariş (no|özeti)|sepetinizdeki/i },
  { ad: 'Kargo', gonderen: /kargo|yurtici|aras|mng|surat|ptt|hepsijet|ups|dhl|fedex|trendyol ?express/i, konu: /kargo|teslimat|gönderi(niz)?|takip no/i, icerik: /kargonuz|gönderiniz|teslim edil|dağıtıma/i },
  { ad: 'Güvenlik', gonderen: /security|guvenlik|accounts\.google|no-?reply@.*(google|apple|microsoft)/i, konu: /doğrulama kodu|güvenlik (uyarısı|kodu)|şifre(nizi)? (sıfırla|değiş)|oturum açıldı|new sign-?in|security alert|verification code|2fa|tek kullanımlık|otp|şüpheli/i, icerik: /doğrulama kodu|tek kullanımlık|giriş denemesi|sign-?in|verification/i },
  { ad: 'Hesaplar', konu: /hesabınız (oluşturuldu|açıldı)|hoş ?geldiniz|welcome|üyeliğiniz|confirm your (email|account)|e-posta adresinizi doğrulayın/i, icerik: /hesabınızı etkinleştir|e-posta adresinizi doğrula/i },
  { ad: 'Yazılım', gonderen: /github|gitlab|vercel|netlify|supabase|firebase|google ?cloud|npm|figma|notion|anthropic|claude|openai|cursor|stackoverflow|docker|jira|slack/i, konu: /pull request|deploy|build|commit|issue|api key|workspace/i },
  { ad: 'Resmi', gonderen: /e-?devlet|turkiye\.gov|gib\.gov|sgk\.gov|vergi|belediye|nufus|emniyet|valilik|kaymakam|\.gov\.tr|\.bel\.tr/i, konu: /e-?devlet|vergi|sgk|belediye|tapu|emniyet|vatandaş/i, icerik: /e-?devlet|sgk|vergi dairesi|belediye/i },
  { ad: 'Seyahat', gonderen: /thy|turkishairlines|pegasus|ajet|booking|airbnb|obilet|enuygun|ucuzabilet|otel/i, konu: /uçuş|pnr|biniş kartı|rezervasyon|check-?in|otel/i, icerik: /pnr|biniş kartı|rezervasyon no/i },
  { ad: 'Sağlık', gonderen: /mhrs|enabiz|hastane|klinik|eczane|labor|saglik\.gov/i, konu: /randevu|hastane|mhrs|e-?nabız|reçete|tahlil|eczane|sonuç/i, icerik: /randevunuz|tahlil sonuc|reçete/i },
  { ad: 'Bahis', gonderen: /bet|casino|slot|iddaa|nesine|bilyoner|tuttur|misli|sahabet|matador|bahis/i, konu: /bahis|casino|slot|iddaa|freespin|deneme bonusu|çevrimsiz|yatırım bonusu/i, icerik: /freespin|çevrimsiz|bonus|bahis/i },
];

const OTOMATIK = /no-?reply|noreply|donotreply|bildirim|notification|notify|mailer|news(letter)?|b[uü]lten|info@|support@|destek@|kampanya|marketing|hello@|team@|account|billing|invoice|m[uü]steri|hizmet|iletisim|bilgi@|alert|service|sistem|order|siparis/i;
const KISISEL_ALAN = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|yandex|proton(mail)?|mail\.ru|aol)\.[a-z.]+$/i;
const REKLAM = /kampanya|indirim|fırsat|%\s?\d+|kupon|abonelikten çık|unsubscribe|son gün|kaçırma/i;

/* Basit "içerir" eşleşmesi (kullanıcı kuralları): büyük/küçük harf ve Türkçe ı/İ farkı yok sayılır. */
const duz = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/̇/g, '');
const icerir = (metin: string, aranan: string) => !aranan.trim() || aranan.split(',').map(x => duz(x.trim())).filter(Boolean).some(x => duz(metin).includes(x));

export function siniflandir(m: Mektup, ozel: Kural[] = []): Siniflama {
  const gonderen = `${m.gonderen} ${m.gonderenAdres}`, icerik = `${m.snippet} ${m.govde ?? ''}`.slice(0, 2500);
  const puan: Record<string, number> = {}, nedenler: Record<string, string[]> = {};
  const ekle = (ad: string, p: number, neden: string) => { puan[ad] = (puan[ad] ?? 0) + p; (nedenler[ad] ??= []).push(neden); };
  for (const k of KATEGORILER) {
    if (k.gonderen?.test(gonderen)) ekle(k.ad, 3, 'gönderen');
    if (k.konu?.test(m.konu)) ekle(k.ad, 2, 'konu');
    if (k.icerik?.test(icerik)) ekle(k.ad, 1, 'içerik');
  }
  const etiketler = new Set<string>();
  for (const k of KATEGORILER) { const esik = k.esik ?? 2; if ((puan[k.ad] ?? 0) >= esik) etiketler.add(k.ad); }
  // Ödeme bekleyen fatura / ekstre: tutar ve son ödeme ifadesi birlikte
  if (/son ödeme|ödenmesi gereken|vadesi|asgari ödeme|ödenecek tutar/i.test(`${m.konu} ${icerik}`) && /(?:₺|TL)\s*[\d.,]+|[\d.,]+\s*(?:₺|TL)/i.test(`${m.konu} ${icerik}`) && (etiketler.has('Fatura') || etiketler.has('Banka') || etiketler.has('Abonelik'))) {
    etiketler.add('Ödeme Bekliyor'); ekle('Ödeme Bekliyor', 3, 'son ödeme ve tutar ifadesi');
  }
  if (!etiketler.size && m.toplu) { etiketler.add('Bülten'); ekle('Bülten', 2, 'toplu posta başlığı'); }
  else if (m.toplu && REKLAM.test(`${m.konu} ${icerik}`) && !etiketler.has('Hukuk / İcra') && !etiketler.has('Ödeme Bekliyor')) { etiketler.add('Bülten'); ekle('Bülten', 2, 'toplu posta ve kampanya ifadesi'); }
  let ozelEslesti = false;
  for (const k of ozel.filter(x => x.aktif && x.etiket.trim())) {
    if ((k.gonderen.trim() || k.konu.trim() || k.icerik.trim()) && icerir(gonderen, k.gonderen) && icerir(m.konu, k.konu) && icerir(icerik, k.icerik)) { etiketler.add(k.etiket.trim()); ekle(k.etiket.trim(), 10, `kural: ${k.ad}`); ozelEslesti = true; }
  }
  const kategoriSayisi = [...etiketler].filter(e => e !== 'Bülten' && e !== 'Ödeme Bekliyor').length;
  const kisi = !ozelEslesti && !m.toplu && !OTOMATIK.test(gonderen) && (KISISEL_ALAN.test(m.gonderenAdres) || !kategoriSayisi);
  if (kisi) { etiketler.add('Kişisel'); ekle('Kişisel', 2, 'gerçek kişiden gelen, toplu olmayan ileti'); }
  const yuksek = etiketler.has('Hukuk / İcra') || etiketler.has('Ödeme Bekliyor') || etiketler.has('Kişisel') || (etiketler.has('Güvenlik') && !m.toplu);
  if (yuksek) etiketler.add('Önemli');
  const onem: Onem = yuksek ? 'yuksek' : etiketler.has('Bülten') && etiketler.size === 1 ? 'dusuk' : 'normal';
  return { etiketler: [...etiketler], nedenler, puan, onem };
}

/* Gönderen alan adına göre "kural önerisi": etiketsiz (ya da yalnız Bülten/Kişisel) iletiler arasında en az 3 kez görünen alan adları. */
export type KuralOnerisi = { alan: string; adet: number; ornekKonu: string };
export function kuralOner(liste: { mektup: Mektup; sonuc: Siniflama }[], mevcut: Kural[], enAz = 3): KuralOnerisi[] {
  const sayac = new Map<string, { adet: number; konu: string }>();
  for (const { mektup, sonuc } of liste) {
    if (sonuc.etiketler.some(e => e !== 'Bülten' && e !== 'Kişisel' && e !== 'Önemli')) continue;
    const alan = mektup.gonderenAdres.split('@')[1]?.toLowerCase();
    if (!alan || KISISEL_ALAN.test(mektup.gonderenAdres)) continue;
    const c = sayac.get(alan) ?? { adet: 0, konu: mektup.konu }; c.adet++; sayac.set(alan, c);
  }
  return [...sayac.entries()].filter(([a, c]) => c.adet >= enAz && !mevcut.some(k => k.gonderen && duz(a).includes(duz(k.gonderen)))).sort((a, b) => b[1].adet - a[1].adet).slice(0, 8)
    .map(([alan, c]) => ({ alan, adet: c.adet, ornekKonu: c.konu }));
}

export const gmailEtiketAdi = (ad: string) => (ad.startsWith(ETIKET_ONEKI) ? ad : `${ETIKET_ONEKI}${ad}`);
