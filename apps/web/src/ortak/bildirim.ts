let zaman = 0;

/* Köşede kısa süre görünen bildirim; isteğe bağlı "Geri al" düğmesi. */
export function bildir(metin: string, geriAl?: () => void | Promise<void>, hata = false) {
  let k = document.getElementById('toast');
  if (!k) {
    k = document.createElement('div');
    k.id = 'toast';
    k.setAttribute('role', 'status');
    document.body.appendChild(k);
  }
  const kutu = k;
  kutu.className = 'toast' + (hata ? ' hata' : '');
  kutu.replaceChildren(document.createTextNode(metin));
  if (geriAl) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Geri al';
    b.addEventListener('click', () => { kutu.hidden = true; void geriAl(); });
    kutu.appendChild(b);
  }
  kutu.hidden = false;
  clearTimeout(zaman);
  zaman = window.setTimeout(() => { kutu.hidden = true; }, geriAl ? 8000 : 4500);
}
