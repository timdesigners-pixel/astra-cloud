/* Yankısız PIN istemi (yalnız etkileşimli terminalde). PIN'in önceliği: `ASTRA_PIN` ortam değişkeni; yoksa ve TTY varsa buradan; etkileşimsiz ortamda
   `null` döner (çağıran PIN_YOK hatası verir). PIN argümanla ASLA alınmaz. Değer ekrana, dosyaya, hata metnine yazılmaz; yalnız `Gizli` sarmalayıcıda döner. */
import { Gizli } from '../ayar.ts';
import { istemiBitir, pinIstemiYazdir } from '../cikti.ts';

export async function pinIste(): Promise<Gizli | null> {
  const girdi = process.stdin;
  if (!girdi.isTTY || typeof girdi.setRawMode !== 'function') return null;
  pinIstemiYazdir();
  return new Promise<Gizli | null>((coz) => {
    let tampon = '';
    const bitir = (sonuc: Gizli | null): void => {
      girdi.off('data', veri);
      girdi.setRawMode(false);
      girdi.pause();
      istemiBitir();
      coz(sonuc);
    };
    const veri = (parca: string | Buffer): void => {
      for (const ch of String(parca)) {
        if (ch === '\r' || ch === '\n') return bitir(tampon === '' ? null : new Gizli(tampon));
        if (ch === '\u0003' || ch === '\u0004') return bitir(null); /* Ctrl-C / Ctrl-D */
        if (ch === '\u007f' || ch === '\b') tampon = tampon.slice(0, -1);
        else if (/[0-9]/.test(ch) && tampon.length < 8) tampon += ch;
      }
    };
    girdi.setEncoding('utf8');
    girdi.setRawMode(true);
    girdi.resume();
    girdi.on('data', veri);
  });
}
