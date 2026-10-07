import { el } from '../../ortak/dom';
import { kacis as esc } from '../../ortak/kacis';
import { tl } from '../../ortak/bicim';
import { bildir } from '../../ortak/bildirim';
import { bugunAnahtari } from '../../ortak/zaman';
import { git } from '../../kabuk/yonlendirici';
import { siralaBildirim, type Bildirim, type Kategori, type Siralama } from '../../veri/bildirim';
import {
  durumYukle, gizle, gizlenenleriGeriGetir, gizliSayisi, gorunenler, okunanlariSifirla, okunduMu, okunduYaz, tumunuOkunduYap,
} from '../../veri/bildirim-durum';
import { hataMetni } from '../../veri/hata';
import { istemciAl } from '../../veri/istemci';
import { kayitEkle, kayitGuncelle } from '../../veri/kayit';
import { sonrakiTarih } from '../notlar/todo';
import { odemeIsaretle } from '../../veri/odemeler';
import type { Panel } from '../../veri/panel';
import { destekleniyor, izinDurumu, izinIste, testGonder } from '../../veri/tarayici-bildirimi';

/* Bildirim Merkezi: N tuşu ya da zil ile açılır. Uyarılar panel hesabından gelir; okundu ve kaldırıldı
   işaretleri ayarlar tablosunda durur. Kartlardaki hızlı eylemler (ödendi, görevi tamamla) verinin kendisini değiştirir. */
type Kaynak = { panel: () => Panel | null; yenile: () => Promise<Panel | null>; degisti: () => void };
type Filtre = 'all' | 'urgent' | Kategori;

let kaynak: Kaynak | null = null;
let kutu: HTMLElement | null = null;
let acik = false;
let filtre: Filtre = 'all';
let arama = '';
let siralama: Siralama = 'vade';
let oncekiOdak: Element | null = null;

const SEKMELER: { kod: Filtre; ad: string }[] = [
  { kod: 'all', ad: 'Tümü' }, { kod: 'urgent', ad: '🚨 Acil & Bugün' }, { kod: 'borc', ad: '💳 Borç & Ödemeler' },
  { kod: 'gider', ad: '📄 Giderler & Bütçe' }, { kod: 'hukuk', ad: '⚖️ İcra & Hukuk' }, { kod: 'todo', ad: '✓ Görevler & Ajanda' }, { kod: 'diger', ad: '• Diğer' },
];
const SIRALAMALAR: { kod: Siralama; ad: string; ipucu: string }[] = [
  { kod: 'vade', ad: '⚡ Son Teslim & Aciliyet', ipucu: 'Vadesi geçen ve en yakın olan üstte' },
  { kod: 'tutar', ad: '💰 Tutar (Büyükten Küçüğe)', ipucu: 'En yüksek tutarlılar önce' },
  { kod: 'ad', ad: '🔤 İsim', ipucu: 'Ada göre alfabetik' },
];

export function bildirimMerkeziKur(k: Kaynak) { kaynak = k; }

const tum = (): Bildirim[] => kaynak?.panel()?.bildirimler ?? [];
const filtrele = (liste: Bildirim[]): Bildirim[] => {
  let f = liste;
  if (filtre === 'urgent') f = f.filter(b => b.seviye === 'red');
  else if (filtre !== 'all') f = f.filter(b => b.kategori === filtre);
  const q = arama.trim().toLocaleLowerCase('tr');
  if (q) f = f.filter(b => `${b.baslik} ${b.not} ${b.etiket}`.toLocaleLowerCase('tr').includes(q));
  return siralaBildirim(f, siralama);
};

function kapsayici(): HTMLElement {
  if (kutu && kutu.isConnected) return kutu;
  kutu = el('div'); kutu.id = 'notifcenter-modal'; kutu.hidden = true;
  kutu.setAttribute('role', 'dialog'); kutu.setAttribute('aria-modal', 'true'); kutu.setAttribute('aria-label', 'Bildirim Merkezi');
  document.body.appendChild(kutu);
  kutu.addEventListener('click', tikla);
  kutu.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'notif-search-input') { arama = t.value; listeCiz(); }
  });
  kutu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); bildirimMerkeziKapat(); return; }
    if (e.key !== 'Tab') return;
    /* Odak tuzağı: sekme arkadaki sayfaya kaçmasın. */
    const o = [...kutu!.querySelectorAll<HTMLElement>('button, input, a[href]')].filter(x => !x.hasAttribute('disabled') && x.offsetParent !== null);
    if (!o.length) return;
    const ilk = o[0]!, son = o[o.length - 1]!;
    if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  });
  return kutu;
}

/* ---------- çizim ---------- */
function kartHtml(b: Bildirim): string {
  const okundu = okunduMu(b);
  const pill = b.kalanGun === null ? (b.acil ? 'pill-urgent' : 'pill-none')
    : b.kalanGun < 0 ? 'pill-overdue' : b.kalanGun === 0 ? 'pill-today' : b.kalanGun <= 3 ? 'pill-urgent' : b.kalanGun <= 7 ? 'pill-soon' : 'pill-later';
  const rozet = b.seviye === 'red' ? 'notif-badge-red' : b.seviye === 'gold' ? 'notif-badge-gold' : 'notif-badge-cyan';
  const renk = b.seviye === 'red' ? 'var(--red)' : b.seviye === 'gold' ? 'var(--gold)' : 'var(--cyan)';
  const serit = b.acil ? `<span class="notif-urgent-ribbon"><span class="notif-urgent-dot"></span>${b.kalanGun !== null && b.kalanGun < 0 ? 'GECİKMİŞ' : b.kalanGun === 0 ? 'BUGÜN' : 'KRİTİK ACİL'}</span>` : '';
  const eylem = b.eylem?.tur === 'odeme' ? `<button class="notif-action-btn pay-btn" data-n="ode" data-id="${esc(b.id)}">✓ Ödendi Olarak İşaretle</button>`
    : b.eylem?.tur === 'todo' ? `<button class="notif-action-btn pay-btn" data-n="gorev" data-id="${esc(b.id)}">✓ Görevi Tamamla</button>`
    : b.eylem?.tur === 'ajanda' ? `<button class="notif-action-btn pay-btn" data-n="ajanda" data-id="${esc(b.id)}">✓ Yapıldı</button>` : '';
  return `<div class="notif-card lvl-${b.seviye}${b.acil ? ' is-urgent' : ''}${okundu ? ' is-read' : ''}" data-kart="${esc(b.id)}">
    <div class="notif-card-icon" style="color:${renk}">${esc(b.ikon)}</div>
    <div class="notif-card-main">
      <div class="notif-card-top">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${serit}<span class="notif-card-cat">${esc(b.etiket)}</span></div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${b.vade ? `<span class="notif-due-pill ${pill}" title="Son teslim / vade">📅 ${esc(b.vade)}</span>` : ''}
          <span class="notif-card-badge ${rozet}">${esc(b.rozet)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px">
        <span class="notif-card-title${b.acil ? ' urgent-title' : ''}">${esc(b.baslik)}</span>
        ${b.tutar ? `<span class="notif-card-amount${b.acil ? ' urgent-amount' : ''} gz">${esc(tl(b.tutar))}</span>` : ''}
      </div>
      <div class="notif-card-notes">${esc(b.not)}</div>
      <div class="notif-card-actions">
        <button class="notif-action-btn${b.acil ? ' pay-btn' : ''}" data-n="git" data-id="${esc(b.id)}">${esc(b.sekmeAd)} sayfasına git ›</button>
        ${eylem}
        <button class="notif-read-btn" data-n="okundu" data-id="${esc(b.id)}" title="${okundu ? 'Okunmadı yap' : 'Okundu yap'}">${okundu ? '↩ Okunmadı Yap' : '✓ Okundu'}</button>
        <button class="notif-read-btn" data-n="kaldir" data-id="${esc(b.id)}" title="Bu uyarıyı listeden kaldır (vadesi değişince yeniden gelir)" aria-label="Uyarıyı kaldır">✕ Kaldır</button>
      </div>
    </div>
  </div>`;
}

function kartlar(liste: Bildirim[]): string {
  if (!liste.length) {
    return `<div class="notif-empty"><div class="notif-empty-icon">✓</div><b style="font-size:15.5px;color:var(--txt)">Bekleyen uyarı yok</b>
      <div style="font-size:12.5px;max-width:380px;line-height:1.5">${arama ? `"${esc(arama)}" aramasına uyan bildirim bulunamadı.` : 'Seçili kategoride geciken ya da yaklaşan bir şey görünmüyor.'}</div>
      ${arama ? '<button class="btn ghost sm" style="margin-top:6px" data-n="aramayi-temizle">Aramayı temizle</button>' : ''}</div>`;
  }
  if (!arama && filtre !== 'urgent') {
    const acil = liste.filter(b => b.acil || b.seviye === 'red'), digeri = liste.filter(b => !(b.acil || b.seviye === 'red'));
    if (acil.length && digeri.length) {
      return `<div class="notif-section-header urgent-section"><div style="display:flex;align-items:center;gap:6px"><span class="notif-urgent-dot"></span><span>🚨 ACİL EYLEM GEREKTİREN KALEMLER</span></div><span class="notif-section-badge badge-urgent">${acil.length} ACİL</span></div>`
        + acil.map(kartHtml).join('')
        + `<div class="notif-section-header" style="margin-top:14px"><div style="display:flex;align-items:center;gap:6px"><span>📅 YAKLAŞAN DİĞER KALEMLER</span></div><span class="notif-section-badge badge-normal">${digeri.length}</span></div>`
        + digeri.map(kartHtml).join('');
    }
  }
  return liste.map(kartHtml).join('');
}

function listeCiz() {
  if (!kutu) return;
  const gov = kutu.querySelector('#notif-list-body');
  if (gov) gov.innerHTML = kartlar(filtrele(gorunenler(tum())));
  /* Sayaçlar ve filtre düğmeleri de güncel kalsın; arama kutusuna dokunulmaz. */
  const gor = gorunenler(tum());
  kutu.querySelectorAll<HTMLElement>('[data-sayac]').forEach(s => {
    const kod = s.dataset.sayac as Filtre;
    s.textContent = String(kod === 'all' ? gor.length : kod === 'urgent' ? gor.filter(b => b.seviye === 'red').length : gor.filter(b => b.kategori === kod).length);
  });
}

function tamCiz() {
  if (!kutu || kutu.hidden) return;
  const hepsi = tum(), gor = gorunenler(hepsi);
  const okunmamis = gor.filter(b => !okunduMu(b)).length, acil = gor.filter(b => b.seviye === 'red').length;
  const odemeler = gor.filter(b => b.eylem?.tur === 'odeme');
  const bekleyen = odemeler.reduce((t, b) => t + b.tutar, 0);
  const geciken = odemeler.filter(b => (b.kalanGun ?? 0) < 0);
  const gizli = gizliSayisi(hepsi);
  const izin = destekleniyor() ? izinDurumu() : 'unsupported';
  const odak = (kutu.querySelector('#notif-search-input') as HTMLInputElement | null) === document.activeElement;
  kutu.innerHTML = `<div class="notif-box" tabindex="-1">
    <div class="notif-head">
      <div class="notif-head-left">
        <div class="notif-bell-icon${acil ? ' has-urgent' : ''}">🔔</div>
        <div>
          <h2 class="notif-title">BİLDİRİM MERKEZİ <span class="cnt ${acil ? '' : 'bilgi'}" style="position:static;font-size:11px;padding:2px 8px;border-radius:var(--r)">${okunmamis} okunmamış / ${gor.length}</span></h2>
          <div class="notif-subtitle">Bekleyen ödeme, duruşma, görev ve bütçe uyarıları için anlık kontrol paneli</div>
        </div>
      </div>
      <div class="notif-head-right">
        <div class="notif-kbd-hint" title="Her yerde N tuşuyla açıp kapatabilirsin"><span>Kısayol:</span> <kbd>N</kbd> · <kbd>Esc</kbd></div>
        <button class="notif-close-btn" data-n="kapat" title="Kapat (Esc)" aria-label="Kapat">✕</button>
      </div>
    </div>
    <div class="notif-kpi-ribbon">
      <div class="notif-kpi-item"><div class="notif-kpi-label">Bekleyen ödemeler</div><div class="notif-kpi-value gold gz">${esc(tl(bekleyen))}</div></div>
      <div class="notif-kpi-item"><div class="notif-kpi-label">Geciken ödemeler</div><div class="notif-kpi-value ${geciken.length ? 'red' : 'green'} gz">${esc(tl(geciken.reduce((t, b) => t + b.tutar, 0)))} (${geciken.length})</div></div>
      <div class="notif-kpi-item"><div class="notif-kpi-label">Acil / kritik uyarılar</div><div class="notif-kpi-value ${acil ? 'red' : 'green'}">${acil} adet</div></div>
      <div class="notif-kpi-item"><div class="notif-kpi-label">Okunmamış uyarılar</div><div class="notif-kpi-value cyan">${okunmamis} / ${gor.length}</div></div>
    </div>
    <div class="notif-filter-bar">
      <div class="notif-cat-chips">${SEKMELER.map(s => `<button class="notif-chip${filtre === s.kod ? ' active' : ''}" data-n="filtre" data-kod="${s.kod}">${s.ad} <span class="notif-chip-cnt" data-sayac="${s.kod}"></span></button>`).join('')}</div>
      <div class="notif-actions">
        <input type="text" class="notif-search-input" id="notif-search-input" placeholder="Uyarı ara..." value="${esc(arama)}" autocomplete="off" aria-label="Uyarı ara">
        ${okunmamis > 0
          ? '<button class="btn ghost sm" data-n="hepsi-okundu" style="font-size:11px;padding:4px 9px">Tümünü Okundu Say</button>'
          : '<button class="btn ghost sm" data-n="okunanlari-sifirla" style="font-size:11px;padding:4px 9px">Okunanları Sıfırla</button>'}
        ${gizli ? `<button class="btn ghost sm" data-n="gizlileri-getir" style="font-size:11px;padding:4px 9px" title="Kaldırılan uyarıları listeye geri getir">Kaldırılanları Göster (${gizli})</button>` : ''}
      </div>
    </div>
    <div class="notif-sub-bar">
      <div class="notif-sort-group"><span class="notif-sort-label">Sırala:</span>
        ${SIRALAMALAR.map(s => `<button class="notif-sort-btn${siralama === s.kod ? ' active' : ''}" data-n="sirala" data-kod="${s.kod}" title="${esc(s.ipucu)}">${s.ad}</button>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--dim)">⚡ Vadesi geçmiş ya da 3 gün kalan kalemler en üstte vurgulanır</div>
    </div>
    <div class="notif-body" id="notif-list-body"></div>
    <div class="notif-footer">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span>🔔 <b>Masaüstü bildirimleri:</b></span>
        ${izin === 'granted' ? '<span style="color:var(--green)">✓ Açık (acil uyarılar günde bir kez gönderilir)</span> <button class="wref" data-n="test" style="color:var(--cyan);font-size:11px">Test gönder</button>'
          : izin === 'default' ? '<button class="btn sm" data-n="izin" style="background:var(--gold);color:var(--on-gold);font-size:11px;padding:3px 9px;font-weight:600">Tarayıcı izni ver</button>'
          : izin === 'denied' ? '<span style="color:var(--red)">Tarayıcıda engellendi</span>' : '<span style="color:var(--dim)">Bu cihaz desteklemiyor</span>'}
      </div>
      <div class="mono" style="font-size:11px;color:var(--dim)">Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')} · Astra Finans OS</div>
    </div>
  </div>`;
  listeCiz();
  if (odak) { const a = kutu.querySelector<HTMLInputElement>('#notif-search-input'); a?.focus(); a?.setSelectionRange(a.value.length, a.value.length); }
}

/* ---------- eylemler ---------- */
const bul = (id: string) => tum().find(b => b.id === id);

async function tazele() {
  const p = await kaynak?.yenile();
  void p;
  kaynak?.degisti();
  tamCiz();
}

async function odemeFormu(b: Bildirim) {
  if (b.eylem?.tur !== 'odeme') return;
  const eylem = b.eylem;
  const dlg = el('dialog', 'kutu'); dlg.setAttribute('aria-label', 'Ödendi olarak işaretle');
  const f = el('form'); f.noValidate = true; f.method = 'dialog';
  f.appendChild(el('h2', '', 'Ödendi olarak işaretle'));
  f.appendChild(el('p', 'alt', `${b.baslik} · ${tl(eylem.tutar)}`));
  const hata = el('p', 'form-hata'); hata.hidden = true; hata.setAttribute('role', 'alert');
  const hesap = el('select'); hesap.id = 'nm-hesap';
  const tarih = el('input'); tarih.type = 'date'; tarih.id = 'nm-tarih'; tarih.value = bugunAnahtari();
  const alan = (et: string, g: HTMLElement, ip?: string) => { const l = el('label', 'alan'); l.append(el('span', '', et), g); if (ip) l.appendChild(el('small', '', ip)); f.appendChild(l); };
  alan('Ödenen hesap', hesap, 'Tutar bu hesaptan düşer'); alan('Ödeme tarihi', tarih);
  const d = el('div', 'form-dugmeler');
  const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
  const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
  d.append(kaydet, vazgec); f.append(hata, d); dlg.appendChild(f);
  dlg.addEventListener('close', () => { dlg.remove(); });
  document.body.appendChild(dlg); dlg.showModal();
  try {
    const { data, error } = await istemciAl().from('hesaplar').select('id,ad').is('silindi_at', null).order('ad');
    if (error) throw error;
    (data ?? []).forEach(h => { const o = el('option', '', String(h.ad)); o.value = String(h.id); hesap.appendChild(o); });
    if (eylem.hesapId) hesap.value = eylem.hesapId;
    if (!data?.length) { hata.textContent = 'Önce Rehber › Banka Hesaplarım\'dan bir hesap ekle.'; hata.hidden = false; }
  } catch (e) { hata.textContent = hataMetni(e); hata.hidden = false; }
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!hesap.value) { hata.textContent = 'Hesap seç.'; hata.hidden = false; return; }
    if (!tarih.value) { hata.textContent = 'Tarih seç.'; hata.hidden = false; return; }
    kaydet.disabled = true;
    try { await odemeIsaretle(eylem.id, hesap.value, tarih.value); dlg.close(); bildir('Ödendi olarak işaretlendi'); await tazele(); }
    catch (e) { kaydet.disabled = false; hata.textContent = hataMetni(e); hata.hidden = false; }
  });
}

async function tamamla(b: Bildirim, tablo: 'todolar' | 'ajanda_olaylari') {
  const o = b.eylem; if (!o || o.tur === 'odeme') return;
  try {
    const kolon = tablo === 'todolar' ? 'id,surum,baslik,tarih,oncelik,etiket,tekrar,notlar' : 'id,surum';
    const { data: satir, error } = await istemciAl().from(tablo).select(kolon).eq('id', o.id).single();
    if (error) throw error;
    const data = satir as unknown as Record<string, unknown>;
    await kayitGuncelle(tablo, ['tamamlandi'], o.id, Number(data.surum), tablo === 'todolar' ? { tamamlandi: true, tamamlanma: new Date().toISOString() } : { tamamlandi: true });
    /* Tekrarlı görev tamamlanınca bir sonraki tarih için yenisi açılır (Todo's sayfasıyla aynı davranış). */
    if (tablo === 'todolar' && data.tekrar && data.tekrar !== 'yok' && data.tarih) {
      const sonraki = sonrakiTarih(String(data.tarih), String(data.tekrar));
      if (sonraki) await kayitEkle('todolar', ['baslik'], { baslik: data.baslik, tarih: sonraki, oncelik: data.oncelik, etiket: data.etiket, tekrar: data.tekrar, notlar: data.notlar });
    }
    bildir(tablo === 'todolar' ? `✓ ${b.baslik} görevi tamamlandı` : `✓ ${b.baslik} yapıldı olarak işaretlendi`);
    await tazele();
  } catch (e) { bildir(hataMetni(e), undefined, true); }
}

async function tikla(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (t === kutu) { bildirimMerkeziKapat(); return; }
  const dugme = t.closest<HTMLElement>('[data-n]');
  if (!dugme) return;
  const n = dugme.dataset.n, id = dugme.dataset.id ?? '', b = id ? bul(id) : undefined;
  const hepsi = tum();
  switch (n) {
    case 'kapat': bildirimMerkeziKapat(); break;
    case 'filtre': filtre = dugme.dataset.kod as Filtre; tamCiz(); break;
    case 'sirala': siralama = dugme.dataset.kod as Siralama; tamCiz(); break;
    case 'aramayi-temizle': arama = ''; tamCiz(); break;
    case 'git':
      if (b) { await okunduYaz(b, true); kaynak?.degisti(); bildirimMerkeziKapat(); git(b.sekme); }
      break;
    case 'okundu': if (b) { await okunduYaz(b, !okunduMu(b)); kaynak?.degisti(); tamCiz(); } break;
    case 'kaldir': if (b) { await gizle(b, hepsi); kaynak?.degisti(); tamCiz(); bildir('Uyarı kaldırıldı'); } break;
    case 'hepsi-okundu': await tumunuOkunduYap(hepsi); kaynak?.degisti(); tamCiz(); bildir('Tüm uyarılar okundu olarak işaretlendi'); break;
    case 'okunanlari-sifirla': await okunanlariSifirla(); kaynak?.degisti(); tamCiz(); bildir('Okunma durumları sıfırlandı'); break;
    case 'gizlileri-getir': await gizlenenleriGeriGetir(); kaynak?.degisti(); tamCiz(); break;
    case 'ode': if (b) void odemeFormu(b); break;
    case 'gorev': if (b) void tamamla(b, 'todolar'); break;
    case 'ajanda': if (b) void tamamla(b, 'ajanda_olaylari'); break;
    case 'izin': await izinIste(); kaynak?.degisti(); tamCiz(); break;
    case 'test': if (!testGonder()) bildir('Bildirim gönderilemedi', undefined, true); break;
  }
}

/* ---------- aç / kapat ---------- */
export const bildirimMerkeziAcikMi = () => acik;

export async function bildirimMerkeziAc(kategori?: Filtre) {
  if (!kaynak) return;
  const k = kapsayici();
  if (kategori) filtre = kategori;
  oncekiOdak = document.activeElement;
  acik = true; k.hidden = false;
  document.body.classList.add('palet-acik');
  k.innerHTML = '<div class="notif-box"><div class="notif-body"><p class="bos">Yükleniyor…</p></div></div>';
  try { await durumYukle(); } catch (e) { bildir(hataMetni(e), undefined, true); }
  if (!acik) return;
  tamCiz();
  k.querySelector<HTMLElement>('#notif-search-input')?.focus();
  /* Panel on saniyelik önbellekten gelmiş olabilir: arkada tazele. */
  void kaynak.yenile().then(() => { if (acik) { kaynak?.degisti(); tamCiz(); } }).catch(() => { /* eski görünüm kalır */ });
}

export function bildirimMerkeziKapat() {
  if (!acik || !kutu) return;
  acik = false; kutu.hidden = true; kutu.innerHTML = '';
  document.body.classList.remove('palet-acik');
  if (oncekiOdak instanceof HTMLElement) oncekiOdak.focus();
}

export function bildirimMerkeziDegistir() { if (acik) bildirimMerkeziKapat(); else void bildirimMerkeziAc(); }
