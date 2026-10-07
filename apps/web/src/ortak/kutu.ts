import { h } from './dom';

type Soru = { baslik: string; etiket: string; deger?: string; tip?: 'text' | 'number' | 'textarea'; ipucu?: string; kaydet?: string; sinir?: number };

/* Tek alanlı soru kutusu; iptalde null döner. (Tarayıcının prompt'u kullanılmaz.) */
export function degerSor(s: Soru): Promise<string | null> {
  return new Promise(coz => {
    const dlg = h('dialog', { sinif: 'kutu' });
    dlg.setAttribute('aria-label', s.baslik);
    const girdi = s.tip === 'textarea' ? h('textarea') : h('input');
    if (girdi instanceof HTMLInputElement) girdi.type = s.tip ?? 'text';
    if (girdi instanceof HTMLTextAreaElement) girdi.rows = 4;
    girdi.value = s.deger ?? '';
    if (s.sinir) girdi.maxLength = s.sinir;
    girdi.id = 'soru-girdi';
    const etiket = h('label', { sinif: 'alan' }, h('span', {}, s.etiket), girdi, s.ipucu ? h('small', {}, s.ipucu) : null);
    const kaydet = h('button', { sinif: 'btn primary', tip: 'submit' }, s.kaydet ?? 'Kaydet');
    const vazgec = h('button', { sinif: 'btn ghost', tip: 'button' }, 'Vazgeç');
    const form = h('form', {}, h('h2', {}, s.baslik), etiket, h('div', { sinif: 'form-dugmeler' }, kaydet, vazgec));
    form.noValidate = true;
    let sonuc: string | null = null;
    form.addEventListener('submit', e => { e.preventDefault(); sonuc = girdi.value; dlg.close(); });
    vazgec.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { dlg.remove(); coz(sonuc); });
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    dlg.showModal();
    girdi.focus();
  });
}
