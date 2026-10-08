import './icra-form.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { tl, gun as tarihYaz } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { icraGeriAl, icraKaydet, icraSil, type IcraAlanlari, type IcraDosyasi } from '../../veri/icra';
import type { Kisi } from '../../veri/kisiler';
import { girdi, kutu, secim } from '../notlar/ortak';

/* İcra dosyası ekleme / düzenleme / silme formu ve toplu doğrulama sihirbazı. Yazma sunucu işleviyle yapılır; yalnız değişen alanlar gönderilir. */
const TAKIP_TURLERI = ['İlamsız', 'İlamlı', 'Kambiyo', 'Tahliye', 'Talimat', 'Mükerrer'];
const sayiOku = (s: string): number | null | undefined => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const sayiYaz = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

type FormSecenek = { mevcut?: IcraDosyasi; kisiler: Kisi[]; kaydedildi: (d: IcraDosyasi, yeni: boolean) => void; silindi: (d: IcraDosyasi) => void };

export function icraFormu(o: FormSecenek) {
  const m = o.mevcut;
  const d = kutu(m ? 'İcra dosyasını düzenle' : 'Yeni icra dosyası');
  d.dlg.classList.add('genis');
  const no = girdi('ic-no', 'text', m?.dosya_no ?? ''); no.maxLength = 80; no.placeholder = '2024/12345';
  const daire = girdi('ic-daire', 'text', m?.icra_dairesi ?? ''); daire.maxLength = 160; daire.placeholder = 'İzmir 3. İcra Dairesi';
  const rol = secim('ic-rol', [['Borçlu', 'Borçlu olduğum'], ['Alacaklı', 'Alacaklı olduğum']], m?.taraf_rolu ?? 'Borçlu');
  const tur = secim('ic-tur', [['', '—'], ...TAKIP_TURLERI.map(x => [x, x] as [string, string])], m?.takip_turu ?? '');
  const yol = girdi('ic-yol', 'text', m?.takip_yolu ?? ''); yol.maxLength = 160;
  const durum = secim('ic-durum', [['acik', 'Açık'], ['kapandi', 'Kapalı']], m?.durum ?? 'acik');
  const uyap = girdi('ic-uyap', 'text', m?.uyap_durum ?? ''); uyap.maxLength = 160; uyap.placeholder = 'Örn. Açık (Durdurulmuş : Takibe İtiraz)';
  const taraf = girdi('ic-taraf', 'text', m?.karsi_taraf ?? ''); taraf.maxLength = 300; taraf.placeholder = 'Alacaklı (borçlu olduğunda) ya da borçlu (alacaklı olduğunda)';
  const kisiSecenek = (liste: Kisi[]) => [['', '—'], ...liste.map(k => [k.id, k.ad] as [string, string])] as [string, string][];
  const alacakli = secim('ic-alacakli', kisiSecenek(o.kisiler), m?.alacakli_id ?? '');
  const avukat = secim('ic-avukat', kisiSecenek(o.kisiler.filter(k => k.alt_tur === 'avukat').concat(o.kisiler.filter(k => k.alt_tur !== 'avukat'))), m?.avukat_id ?? '');
  const oncelik = secim('ic-oncelik', [['', '—'], ['1', 'Acil'], ['2', 'Büyük'], ['3', 'Küçük'], ['4', 'Bağlı']], m?.oncelik ? String(m.oncelik) : '');
  d.alan('Dosya numarası', no, 'Şifreli saklanır'); d.alan('İcra dairesi', daire); d.alan('Rolün', rol); d.alan('Takip türü', tur, 'Süre ve zamanaşımı hesapları buna göre yapılır');
  d.alan('Takip yolu', yol); d.alan('Durum', durum); d.alan('UYAP durumu', uyap, 'İtiraz / durdurulmuş gibi ibareler bakiyeyi 0 sayar'); d.alan('Karşı taraf', taraf);
  d.alan('Alacaklı (rehberden)', alacakli); d.alan('Avukat', avukat); d.alan('Öncelik', oncelik);

  const para = (id: string, deger: number | null | undefined) => { const i = girdi(id, 'text', sayiYaz(deger)); i.inputMode = 'decimal'; return i; };
  const guncel = para('ic-guncel', m?.guncel_toplam_borc);
  const alanlar: [string, string, HTMLInputElement, keyof IcraAlanlari][] = [
    ['Güncel toplam borç', 'bu dosyanın bugünkü bakiyesi', guncel, 'guncel_toplam_borc'],
    ['Asıl alacak', '', para('ic-asil', m?.gercek_asil_alacak), 'gercek_asil_alacak'],
    ['Faiz tutarı', '', para('ic-faiz', m?.faiz_tutari), 'faiz_tutari'],
    ['Faiz oranı (%)', '', para('ic-oran', m?.faiz_orani), 'faiz_orani'],
    ['Vekâlet ücreti', '', para('ic-vekalet', m?.vekalet_ucreti), 'vekalet_ucreti'],
    ['Masraf', '', para('ic-masraf', m?.masraf), 'masraf'],
    ['Vergi', '', para('ic-vergi', m?.vergi), 'vergi'],
    ['Tahsil harcı', '', para('ic-harc', m?.tahsil_harci), 'tahsil_harci'],
    ['Toplam alacak', '', para('ic-toplam', m?.toplam_alacak), 'toplam_alacak'],
    ['Yatan para', '', para('ic-yatan', m?.yatan_para), 'yatan_para'],
    ['Tahsilat', '', para('ic-tahsilat', m?.tahsilat), 'tahsilat'],
    ['Reddiyat', '', para('ic-reddiyat', m?.reddiyat), 'reddiyat'],
  ];
  const tutarKap = el('details', 'ic-detay'); tutarKap.open = !m;
  tutarKap.appendChild(el('summary', '', 'Tutarlar'));
  const tutarIc = el('div', 'ic-grid');
  alanlar.forEach(([et, ip, g]) => { const l = el('label', 'alan'); l.append(el('span', '', et), g); if (ip) l.appendChild(el('small', '', ip)); tutarIc.appendChild(l); });
  tutarKap.appendChild(tutarIc); d.f.appendChild(tutarKap);

  const tarih = (id: string, v: string | null | undefined) => girdi(id, 'date', v ?? '');
  const tarihler: [string, HTMLInputElement, keyof IcraAlanlari][] = [
    ['Açılış tarihi', tarih('ic-acilis', m?.acilis_tarihi), 'acilis_tarihi'], ['Son işlem tarihi', tarih('ic-sonislem', m?.son_islem_tarihi), 'son_islem_tarihi'],
    ['Tebliğ tarihi', tarih('ic-teblig', m?.tebligat_tarihi), 'tebligat_tarihi'], ['Kapanış tarihi', tarih('ic-kapanis', m?.kapanis_tarihi), 'kapanis_tarihi'],
    ['UYAP tarihi', tarih('ic-uyaptarih', m?.uyap_tarihi), 'uyap_tarihi'],
  ];
  const tarihKap = el('details', 'ic-detay'); tarihKap.open = !m;
  tarihKap.appendChild(el('summary', '', 'Tarihler'));
  const tarihIc = el('div', 'ic-grid');
  tarihler.forEach(([et, g]) => { const l = el('label', 'alan'); l.append(el('span', '', et), g); tarihIc.appendChild(l); });
  tarihKap.appendChild(tarihIc); d.f.appendChild(tarihKap);

  const dogruladi = el('input'); dogruladi.type = 'checkbox'; dogruladi.id = 'ic-dogrulandi';
  const dl = el('label', 'ic-onay'); dl.append(dogruladi, ' Bakiyeyi UYAP\'tan bugün doğruladım');
  d.f.appendChild(dl);
  guncel.addEventListener('input', () => { dogruladi.checked = true; });

  if (m) {
    const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
    sil.addEventListener('click', async () => {
      if (!(await onayla({ baslik: 'Dosya silinsin mi?', metin: 'Dosya ve bağlı borç kaydı listelerden kalkar. Geri alabilirsin.', evet: 'Sil' }))) return;
      sil.disabled = true;
      try {
        await icraSil(m);
        d.dlg.close(); o.silindi(m);
        bildir('Dosya silindi', async () => { try { await icraGeriAl(m.id); bildir('Geri alındı'); o.kaydedildi(m, false); } catch (e) { bildir(hataMetni(e), undefined, true); } });
      } catch (e) { sil.disabled = false; d.hatayaz(hataMetni(e)); if (e instanceof CakismaHatasi) { d.dlg.close(); o.kaydedildi(m, false); } }
    });
    d.dugmeler.appendChild(sil);
  }

  d.f.addEventListener('submit', async e => {
    e.preventDefault();
    const dosyaNo = no.value.trim();
    if (!dosyaNo) { d.hatayaz('Dosya numarası boş olamaz.'); no.focus(); return; }
    const g: Record<string, unknown> = {};
    const degisti = <K extends keyof IcraAlanlari>(k: K, yeni: IcraAlanlari[K] | undefined, eski: unknown) => { if (yeni !== undefined && (m === undefined || (yeni ?? null) !== (eski ?? null))) g[k] = yeni; };
    degisti('icra_dairesi', daire.value.trim() || null, m?.icra_dairesi);
    degisti('taraf_rolu', rol.value, m?.taraf_rolu);
    degisti('takip_turu', tur.value || null, m?.takip_turu);
    degisti('takip_yolu', yol.value.trim() || null, m?.takip_yolu);
    degisti('durum', durum.value as 'acik' | 'kapandi', m?.durum);
    degisti('uyap_durum', uyap.value.trim() || null, m?.uyap_durum);
    degisti('karsi_taraf', taraf.value.trim() || null, m?.karsi_taraf);
    degisti('alacakli_id', alacakli.value || null, m?.alacakli_id);
    degisti('avukat_id', avukat.value || null, m?.avukat_id);
    degisti('oncelik', oncelik.value ? Number(oncelik.value) : null, m?.oncelik);
    for (const [et, , girdiH, anahtar] of alanlar) {
      const v = sayiOku(girdiH.value);
      if (v === undefined) { d.hatayaz(`"${et}" sayı olmalı.`); girdiH.focus(); return; }
      degisti(anahtar, v as never, (m as unknown as Record<string, unknown> | undefined)?.[anahtar]);
    }
    for (const [, girdiH, anahtar] of tarihler) degisti(anahtar, (girdiH.value || null) as never, (m as unknown as Record<string, unknown> | undefined)?.[anahtar]);
    if (dogruladi.checked) g.dogrulama_tarihi = bugunAnahtari();
    d.kaydet.disabled = true; d.hata.hidden = true;
    try {
      const kayit = await icraKaydet(m ?? null, dosyaNo !== m?.dosya_no ? dosyaNo : null, g as IcraAlanlari);
      d.dlg.close(); bildir('Kaydedildi'); o.kaydedildi(kayit, !m);
    } catch (err) {
      d.kaydet.disabled = false;
      if (err instanceof CakismaHatasi) { d.dlg.close(); bildir(hataMetni(err), undefined, true); o.kaydedildi(m!, false); return; }
      d.hatayaz(hataMetni(err));
    }
  });
  d.bitir();
}

/* Toplu doğrulama: eski ya da hiç doğrulanmamış açık dosyalar tutara göre sırayla, tek ekranda geçilir. */
export function icraDogrulaSihirbazi(o: { liste: IcraDosyasi[]; guncellendi: (d: IcraDosyasi) => void }) {
  const kuyruk = [...o.liste];
  let i = 0, dogrulanan = 0, degisenBakiye = 0;
  const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', 'Sırayla doğrula');
  const icerik = el('div', 'ic-sihirbaz');
  dlg.appendChild(icerik);
  dlg.addEventListener('close', () => dlg.remove());

  function bitir() {
    icerik.replaceChildren(el('h2', '', 'Doğrulama tamam'), el('p', '', `${dogrulanan} dosya doğrulandı${degisenBakiye ? `, ${degisenBakiye} dosyanın bakiyesi değişti` : ''}.`));
    const k = el('button', 'btn primary', 'Kapat'); k.type = 'button'; k.addEventListener('click', () => dlg.close());
    icerik.appendChild(k);
  }
  function goster() {
    if (i >= kuyruk.length) { bitir(); return; }
    const x = kuyruk[i]!;
    icerik.replaceChildren();
    icerik.append(el('h2', '', `Sırayla doğrula · ${i + 1} / ${kuyruk.length}`), el('p', 'ic-ad gz', `${x.dosya_no ?? '—'} · ${x.icra_dairesi ?? ''}`), el('p', 'ic-not', `${x.karsi_taraf ?? ''}${x.dogrulama_tarihi ? ` · son doğrulama ${tarihYaz(x.dogrulama_tarihi)}` : ' · hiç doğrulanmadı'}`));
    const yeni = girdi('ic-sihr-tutar', 'text', sayiYaz(x.guncel_toplam_borc)); yeni.inputMode = 'decimal';
    const l = el('label', 'alan'); l.append(el('span', '', 'Güncel toplam borç (UYAP\'ta görünen)'), yeni, el('small', '', `Kayıtlı: ${tl(x.guncel_toplam_borc)}`));
    const hata = el('p', 'form-hata'); hata.hidden = true;
    const dogrula = el('button', 'btn primary', 'Doğrula ve sonrakine geç'); dogrula.type = 'button';
    const atla = el('button', 'btn ghost', 'Atla'); atla.type = 'button';
    const durdur = el('button', 'btn ghost', 'Durdur'); durdur.type = 'button';
    dogrula.addEventListener('click', async () => {
      const v = sayiOku(yeni.value);
      if (v === undefined || v === null) { hata.textContent = 'Tutarı sayı olarak yaz.'; hata.hidden = false; return; }
      dogrula.disabled = true;
      try {
        const kayit = await icraKaydet(x, null, { guncel_toplam_borc: v, dogrulama_tarihi: bugunAnahtari() });
        if ((x.guncel_toplam_borc ?? 0) !== v) degisenBakiye++;
        dogrulanan++; o.guncellendi(kayit); i++; goster();
      } catch (e) {
        dogrula.disabled = false;
        hata.textContent = e instanceof CakismaHatasi ? 'Bu dosya başka yerde değişmiş; sayfayı yenileyip tekrar dene.' : hataMetni(e); hata.hidden = false;
      }
    });
    atla.addEventListener('click', () => { i++; goster(); });
    durdur.addEventListener('click', () => dlg.close());
    const dugmeler = el('div', 'form-dugmeler'); dugmeler.append(dogrula, atla, durdur);
    icerik.append(l, hata, dugmeler);
    yeni.focus(); yeni.select();
    yeni.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); dogrula.click(); } });
  }
  document.body.appendChild(dlg); dlg.showModal();
  goster();
}
