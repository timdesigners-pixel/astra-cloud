import { el } from '../../ortak/dom';
import { hataMetni } from '../../veri/hata';
import { uygulamaDurumuOku, type UygulamaKaydi } from '../../veri/uygulamalar';
import { uygulamaBul, UYGULAMALAR, type Uygulama } from './katalog';
import { bosalt, kopruBagla, ORTAK, SANDBOX } from './kopru';

async function goruntu(u: Uygulama): Promise<UygulamaKaydi> {
  const v = await uygulamaDurumuOku(u.kod);
  const ortak = ORTAK[u.kod];
  if (ortak) {
    const o = await uygulamaDurumuOku(ortak.uygulama);
    if (o[ortak.anahtar] !== undefined) v[ortak.anahtar] = o[ortak.anahtar]!;
  }
  return v;
}

export function uygulamaSayfasi(sekme: string) {
  return (kok: HTMLElement) => {
    const u = uygulamaBul(sekme);
    if (!u) return;
    kopruBagla();
    const kart = el('section', 'app-kap');
    kok.replaceChildren(kart);

    if (!u.yol) {
      kart.className = 'card';
      kart.style.padding = '28px';
      kart.append(el('h2', '', u.ad), el('p', '', u.not));
      kart.lastElementChild!.setAttribute('style', 'margin:0;color:var(--dim)');
      return;
    }
    const yol = u.yol;

    async function ac() {
      kart.replaceChildren(el('p', 'bos', `${u!.ad} yükleniyor…`));
      let v: UygulamaKaydi;
      try { await bosalt(); v = await goruntu(u!); }
      catch (e) {
        const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button';
        b.addEventListener('click', () => void ac());
        kart.replaceChildren(el('p', 'bos hata', hataMetni(e)), b);
        return;
      }
      const ust = el('div', 'app-ust');
      ust.append(el('span', 'hubcrumb', '☁︎ Uygulama verisi şifreli olarak bulutta saklanır'));
      const f = el('iframe', 'app-cerceve');
      f.dataset.sandbox = '1';
      f.dataset.app = u!.kod;
      if (u!.asgariBoy) { f.dataset.asgari = String(u!.asgariBoy); f.style.minHeight = u!.asgariBoy + 'px'; }
      f.title = u!.ad;
      f.setAttribute('scrolling', 'no');
      f.setAttribute('sandbox', SANDBOX);
      if (u!.izin) f.setAttribute('allow', u!.izin);
      f.name = 'astra-depo:' + JSON.stringify({ a: u!.kod, v });
      f.src = yol;
      kart.replaceChildren(ust, f);
    }
    void ac();
  };
}

export const uygulamaSayfalari: Record<string, (kok: HTMLElement) => void> =
  Object.fromEntries(UYGULAMALAR.map(u => [u.sekme, uygulamaSayfasi(u.sekme)]));
