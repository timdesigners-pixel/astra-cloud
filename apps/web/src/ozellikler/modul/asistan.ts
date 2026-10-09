import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { donem } from '../../kabuk/donem';
import { hataMetni } from '../../veri/hata';
import { panelGetir } from '../../veri/panel';
import { SOHBET_ROLLERI, sohbetEt, type Mesaj, type SohbetRolu } from '../../veri/sohbet';

/* Finans özeti: yalnız kullanıcı onay kutusunu işaretlerse sohbete bağlam olarak gider. İsim, IBAN ya da dosya numarası içermez. */
async function finansOzeti(): Promise<string> {
  const p = await panelGetir(donem());
  const s = [
    `Dönem: ${donem()}`, `Gelir: ${tl(p.gelir)}, gider: ${tl(p.gider)}, serbest bütçe: ${tl(p.serbest)}`, `Toplam borç: ${tl(p.borc)}`,
    `Finansal sağlık puanı: ${p.saglik}/100 (${p.saglikEtiket})`, `Açık görev: ${p.todoAcik}, gecikmiş görev: ${p.todoGecikmis}`,
    ...p.uyarilar.slice(0, 8).map(u => `Uyarı: ${u.baslik} — ${u.not}`),
  ];
  return s.join('\n');
}

export function asistanSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card asistan');
  kok.replaceChildren(kart);
  let rol: SohbetRolu = 'genel_finans', baglamIste = false, bekliyor = false;
  const mesajlar: Mesaj[] = [];

  const ust = el('div', 'tbar');
  const rolSec = el('select'); rolSec.id = 'as-rol'; rolSec.setAttribute('aria-label', 'Danışman rolü');
  SOHBET_ROLLERI.forEach(([v, a]) => { const o = el('option', '', a); o.value = v; rolSec.appendChild(o); });
  rolSec.addEventListener('change', () => { rol = rolSec.value as SohbetRolu; mesajlar.length = 0; ciz(); });
  const bag = el('label', 'ic-onay'); const bagK = el('input'); bagK.type = 'checkbox'; bagK.id = 'as-baglam';
  bagK.addEventListener('change', () => { baglamIste = bagK.checked; });
  bag.append(bagK, el('span', '', 'Güncel finans özetimi paylaş (gelir, gider, borç toplamı, uyarılar)'));
  const temizle = el('button', 'btn ghost sm', 'Sohbeti temizle'); temizle.type = 'button'; temizle.addEventListener('click', () => { mesajlar.length = 0; ciz(); });
  ust.append(rolSec, bag, el('span', 'tbar-sp'), temizle);
  const akis = el('div', 'as-akis'); akis.setAttribute('aria-live', 'polite');
  const form = el('form', 'as-form'); form.noValidate = true;
  const girdi = el('textarea'); girdi.id = 'as-girdi'; girdi.rows = 2; girdi.placeholder = 'Sorunu yaz… (Ctrl+Enter ile gönder)'; girdi.setAttribute('aria-label', 'Mesaj');
  const gonder = el('button', 'btn primary', 'Gönder'); gonder.type = 'submit'; gonder.id = 'as-gonder';
  form.append(girdi, gonder);
  const not = el('p', 'bos', 'Yanıtlar yapay zekâ tarafından üretilir; bilgilendirme amaçlıdır, hukuk ya da yatırım tavsiyesi değildir. Finans özeti yalnız yukarıdaki kutuyu işaretlersen gönderilir.');
  kart.append(ust, akis, form, not);

  function ciz() {
    akis.replaceChildren();
    const aciklama = SOHBET_ROLLERI.find(r => r[0] === rol)![2];
    if (!mesajlar.length) akis.appendChild(el('p', 'bos', `${aciklama}. Bir soru yaz.`));
    mesajlar.forEach(m => { const b = el('div', `as-mesaj ${m.rol}`); b.appendChild(el('div', 'as-metin', m.metin)); akis.appendChild(b); });
    if (bekliyor) akis.appendChild(el('p', 'bos', 'Yanıt hazırlanıyor…'));
    akis.scrollTop = akis.scrollHeight;
    gonder.disabled = bekliyor;
  }
  async function yolla() {
    const metin = girdi.value.trim();
    if (!metin || bekliyor) return;
    mesajlar.push({ rol: 'user', metin }); girdi.value = ''; bekliyor = true; ciz();
    try {
      const baglam = baglamIste ? await finansOzeti() : '';
      const r = await sohbetEt(rol, mesajlar, baglam);
      mesajlar.push({ rol: 'model', metin: r.yanit });
    } catch (e) { mesajlar.push({ rol: 'model', metin: `⚠ ${e instanceof Error ? e.message : hataMetni(e)}` }); }
    bekliyor = false; ciz();
  }
  form.addEventListener('submit', e => { e.preventDefault(); void yolla(); });
  girdi.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void yolla(); } });
  ciz();
}
