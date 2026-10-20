/* Statik kaynak taraması (yalnız OKUR; yazmaz, silmez, kopyalamaz). Tarama BEYAZ LİSTE ile sınırlıdır: yollar kullanıcıdan DEĞİL,
   sabit uygulama adları + sabit dosya adları + `detay/NN.json` desenden kurulur; kullanıcı girdisi yalnız kök dizindir.
   Sembolik bağlantılar izlenmez (reddedilir). `index.html` ve başka her şey yok sayılır (legacy uygulama kodu zaten CL'de var).
   İçerik DEĞERİ hiçbir yere taşınmaz: yalnız boyut, sha256 ve "JSON olarak ayrışıyor mu" bilgisi. */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { STATIK_AZAMI_BAYT, STATIK_UYGULAMALAR, type StatikDosya, type StatikSorunKodu, type StatikUygulama } from '../donusum/statik-plan-hesap.ts';
import { GirdiHatasi } from './girdi-hata.ts';

export type TaranmisDosya = {
  bilgi: StatikDosya;
  /* Yükleme anında içeriği diskten yeniden okur (bellekte tutulmaz). */
  oku: () => Uint8Array;
};

export type StatikTaramaSonucu = {
  dosyalar: TaranmisDosya[];
  /* Beyaz liste dışı olduğu için yok sayılan girdi sayısı (ad yazılmaz). */
  yoksayilan: number;
  sorunlar: StatikSorunKodu[];
};

type DurumBilgisi = { dosyaMi: boolean; dizinMi: boolean; baglantiMi: boolean; boyut: number };

function durumAl(yol: string): DurumBilgisi | null {
  try {
    const d = lstatSync(yol);
    return { dosyaMi: d.isFile(), dizinMi: d.isDirectory(), baglantiMi: d.isSymbolicLink(), boyut: d.size };
  } catch {
    /* Yok ya da okunamıyor: çağıran "yok" olarak ele alır. */
    return null;
  }
}

function dizinAdlari(yol: string): string[] {
  try {
    return readdirSync(yol).sort();
  } catch {
    return [];
  }
}

/* Kök çözümü: `<kaynak>/public/apps` (eski repo kökü) ya da `<kaynak>` (doğrudan public/apps). Her ikisinde de beyaz listeli klasör aranır. */
export function statikKokCoz(kaynak: string): string {
  if (typeof kaynak !== 'string' || kaynak.trim() === '') throw new GirdiHatasi('GIRDI_YOLU_YOK');
  const adaylar = [join(kaynak, 'public', 'apps'), kaynak];
  for (const aday of adaylar) {
    const dizinMi = durumAl(aday)?.dizinMi === true;
    if (dizinMi && STATIK_UYGULAMALAR.some((u) => durumAl(join(aday, u))?.dizinMi === true)) return aday;
  }
  throw new GirdiHatasi('STATIK_KAYNAK_YOK');
}

function dosyaTara(kok: string, uygulama: StatikUygulama, goreli: string, sonuc: StatikTaramaSonucu): void {
  const tam = join(kok, uygulama, ...goreli.split('/'));
  const d = durumAl(tam);
  if (d === null) {
    sonuc.sorunlar.push('DOSYA_YOK');
    return;
  }
  if (d.baglantiMi || !d.dosyaMi) {
    sonuc.sorunlar.push('SEMBOLIK_BAGLANTI');
    return;
  }
  const oku = (): Uint8Array => readFileSync(tam);
  let sha = '';
  let jsonGecerli = false;
  /* Sınırı aşan dosya okunup özetlenmez (plan zaten sorun işaretler). */
  if (d.boyut <= STATIK_AZAMI_BAYT) {
    const bayt = oku();
    sha = sha256HexBayt(bayt);
    try {
      JSON.parse(Buffer.from(bayt).toString('utf8'));
      jsonGecerli = true;
    } catch {
      /* Ayrışmayan JSON: yalnız bayrak; hata metni içerik parçası taşıyabilir, atılır. */
    }
  }
  sonuc.dosyalar.push({ bilgi: { yol: `${uygulama}/${goreli}`, uygulama, boyut: d.boyut, sha256: sha, json_gecerli: jsonGecerli }, oku });
}

export function statikTara(kaynak: string): StatikTaramaSonucu {
  const kok = statikKokCoz(kaynak);
  const sonuc: StatikTaramaSonucu = { dosyalar: [], yoksayilan: 0, sorunlar: [] };
  for (const uygulama of STATIK_UYGULAMALAR) {
    const klasor = join(kok, uygulama);
    const k = durumAl(klasor);
    if (k === null || !k.dizinMi) {
      sonuc.sorunlar.push(k?.baglantiMi === true ? 'SEMBOLIK_BAGLANTI' : 'UYGULAMA_YOK');
      continue;
    }
    for (const ad of dizinAdlari(klasor)) {
      if (ad !== 'hero.json' && ad !== 'kucuk.json' && ad !== 'detay') sonuc.yoksayilan += 1;
    }
    dosyaTara(kok, uygulama, 'hero.json', sonuc);
    dosyaTara(kok, uygulama, 'kucuk.json', sonuc);

    const detayDizini = join(klasor, 'detay');
    const dd = durumAl(detayDizini);
    if (dd === null || !dd.dizinMi) {
      sonuc.sorunlar.push(dd?.baglantiMi === true ? 'SEMBOLIK_BAGLANTI' : 'DETAY_YOK');
      continue;
    }
    let detaySayisi = 0;
    for (const ad of dizinAdlari(detayDizini)) {
      if (!/^[0-9]{2}\.json$/.test(ad)) {
        sonuc.yoksayilan += 1;
        continue;
      }
      detaySayisi += 1;
      dosyaTara(kok, uygulama, `detay/${ad}`, sonuc);
    }
    if (detaySayisi === 0) sonuc.sorunlar.push('DETAY_YOK');
  }
  return sonuc;
}
