import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { hataMetni } from '../../veri/hata';
import { baglananHesaplar, baglantiKes, gmailBaglan, hesaplariGetir, hesaplariYaz, istemciKimligiGetir, istemciKimligiYaz, type KayitliHesap } from '../../veri/gmail';

/* Hesap şeridi: istemci kimliği, bağlı/bağsız hesaplar, hesap ekleme. Posta sayfaları ortak kullanır. */
export type HesapDurumu = { istemci: string; hesaplar: KayitliHesap[] };
export async function hesapDurumuYukle(): Promise<HesapDurumu> {
  const [istemci, hesaplar] = await Promise.all([istemciKimligiGetir(), hesaplariGetir()]);
  return { istemci, hesaplar };
}

export function hesapSeridi(d: HesapDurumu, degisti: () => void): HTMLElement {
  const kutu = el('div', 'posta-hesaplar');
  const kimlik = el('input'); kimlik.id = 'ph-kimlik'; kimlik.value = d.istemci; kimlik.placeholder = 'Google OAuth istemci kimliği (….apps.googleusercontent.com)'; kimlik.setAttribute('aria-label', 'Google OAuth istemci kimliği');
  kimlik.addEventListener('change', async () => { d.istemci = kimlik.value.trim(); try { await istemciKimligiYaz(d.istemci); bildir('Kaydedildi'); degisti(); } catch (e) { bildir(hataMetni(e), undefined, true); } });
  const satir = el('div', 'tbar'); satir.append(kimlik);
  const bagli = new Set(baglananHesaplar());
  const ekle = el('button', 'btn primary sm', '+ Hesap bağla'); ekle.type = 'button'; ekle.id = 'ph-ekle'; ekle.disabled = !d.istemci;
  ekle.addEventListener('click', async () => {
    ekle.disabled = true;
    try {
      const e = await gmailBaglan(d.istemci);
      if (!d.hesaplar.some(x => x.eposta === e)) { d.hesaplar = [...d.hesaplar, { eposta: e, ad: e }]; await hesaplariYaz(d.hesaplar); }
      bildir(`${e} bağlandı`);
    } catch (err) { bildir(err instanceof Error ? err.message : hataMetni(err), undefined, true); }
    degisti();
  });
  satir.append(el('span', 'tbar-sp'), ekle);
  kutu.appendChild(satir);
  if (!d.istemci) kutu.appendChild(el('p', 'bos', 'Önce Google Cloud\'da bir OAuth istemci kimliği (Web uygulaması) oluşturup bu sitenin adresini "Yetkili JavaScript kaynakları" listesine ekle, Gmail API\'sini etkinleştir ve kimliği yukarıya yapıştır. İzin olarak "Gmail etiketleri ve iletileri okuma/değiştirme" istenir; iletiler silinmez ya da gönderilmez.'));
  const liste = el('div', 'posta-chipler');
  d.hesaplar.forEach(h => {
    const b = bagli.has(h.eposta);
    const chip = el('span', `posta-chip ${b ? 'bagli' : ''}`); chip.dataset.hesap = h.eposta;
    chip.append(el('b', '', h.eposta), ` ${b ? '● bağlı' : '○ bağlı değil'} `);
    const dugme = el('button', 'btn ghost sm', b ? 'Çıkar' : 'Bağlan'); dugme.type = 'button';
    dugme.addEventListener('click', async () => {
      if (b) { baglantiKes(h.eposta); degisti(); return; }
      try { await gmailBaglan(d.istemci, h.eposta); } catch (err) { bildir(err instanceof Error ? err.message : hataMetni(err), undefined, true); }
      degisti();
    });
    chip.appendChild(dugme);
    if (!b) {
      const unut = el('button', 'btn ghost sm', 'Listeden sil'); unut.type = 'button';
      unut.addEventListener('click', async () => { d.hesaplar = d.hesaplar.filter(x => x.eposta !== h.eposta); try { await hesaplariYaz(d.hesaplar); } catch (e) { bildir(hataMetni(e), undefined, true); } degisti(); });
      chip.appendChild(unut);
    }
    liste.appendChild(chip);
  });
  if (!d.hesaplar.length) liste.appendChild(el('span', 'bos', 'Henüz hesap bağlanmadı.'));
  kutu.appendChild(liste);
  return kutu;
}
