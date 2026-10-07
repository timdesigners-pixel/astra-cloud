import { el } from '../../ortak/dom';
import { git } from '../../kabuk/yonlendirici';
import { UYGULAMALAR } from './katalog';

export function modulMerkeziSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card');
  kart.style.padding = '22px';
  kart.append(el('h2', '', 'Modül Merkezi'));
  const izgara = el('div', 'modul-izgara');
  UYGULAMALAR.forEach(u => {
    const b = el('button', 'modul-kart'); b.type = 'button'; b.dataset.git = u.sekme;
    b.append(el('b', '', u.ad), el('small', '', u.not));
    b.addEventListener('click', () => git(u.sekme));
    izgara.appendChild(b);
  });
  kart.appendChild(izgara);
  kok.replaceChildren(kart);
}
