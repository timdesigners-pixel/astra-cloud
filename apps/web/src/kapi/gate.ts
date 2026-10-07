import { SURUM } from './surum';

const MIN = 4;
const MAX = 8;
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/* Erişim jetonu yalnız bellekte durur; sayfa yenilenince PIN yeniden istenir. */
let oturum: { access_token: string; refresh_token: string } | null = null;
export const oturumAl = () => oturum;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function noktalar(n: number) {
  $('gdots').innerHTML = Array.from({ length: MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
}

function mesaj(t: string, tip = '') {
  const el = $('gmsg');
  el.textContent = t;
  el.className = 'g-msg' + (tip ? ' ' + tip : '');
}

function salla() {
  const p = document.querySelector('.g-lock') as HTMLElement;
  p.classList.remove('g-shake');
  void p.offsetWidth;
  p.classList.add('g-shake');
}

function ac() {
  const g = $('gate');
  document.body.classList.remove('g-locked');
  document.body.classList.add('g-reveal');
  g.classList.add('g-open');
  const sure = matchMedia('(prefers-reduced-motion: reduce)').matches ? 60 : 960;
  setTimeout(() => {
    g.remove();
    document.body.classList.remove('g-reveal');
  }, sure);
}

const saat = (t: string) =>
  new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

async function pinIleAc(pin: string): Promise<{ ok: true } | { hata: string }> {
  if (!SB_URL || !SB_ANON) return { hata: 'sunucu bağlantısı yapılandırılmamış' };
  let r: Response;
  try {
    r = await fetch(`${SB_URL}/functions/v1/pin-giris`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      body: JSON.stringify({ pin }),
    });
  } catch {
    return { hata: 'bağlantı yok — sunucuya ulaşılamadı' };
  }
  const g = await r.json().catch(() => ({}));
  if (r.ok) {
    oturum = { access_token: g.access_token, refresh_token: g.refresh_token };
    return { ok: true };
  }
  if (r.status === 401) return { hata: g.kalan ? `PIN hatalı · ${g.kalan} deneme kaldı` : 'PIN hatalı' };
  if (r.status === 423) return { hata: `çok fazla hatalı deneme — kasa ${saat(g.kilitBitis)}'e kadar kilitli` };
  return { hata: 'giriş şu an yapılamıyor' };
}

export function kapiyiBaslat() {
  $('gsurum').textContent = SURUM;
  const inp = $<HTMLInputElement>('gpin');
  let kilitli = false;
  const yenile = () => noktalar(inp.value.length);
  yenile();

  const bas = (d: string) => {
    if (kilitli || inp.value.length >= MAX) return;
    inp.value += d; yenile(); mesaj('');
  };
  const sil = () => { inp.value = inp.value.slice(0, -1); yenile(); mesaj(''); };
  const onayla = async () => {
    const pin = inp.value;
    if (kilitli) return;
    if (pin.length < MIN) { mesaj(`en az ${MIN} hane gerekli`, 'err'); salla(); return; }
    kilitli = true;
    mesaj('bulut kasası açılıyor…', 'ok');
    const s = await pinIleAc(pin);
    kilitli = false;
    if ('ok' in s) { mesaj('açılıyor', 'ok'); ac(); return; }
    inp.value = ''; yenile(); salla(); mesaj(s.hata, 'err');
  };

  $('gpad').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.d) bas(b.dataset.d);
    else if (b.dataset.a === 'sil') sil();
    else if (b.dataset.a === 'gir') void onayla();
  });
  document.querySelector('[data-a="unuttum"]')!.addEventListener('click', () =>
    mesaj("PIN hiçbir yerde saklanmaz; sıfırlama sunucu yöneticisinden (tools/pin-kur --sifirla)", 'err'));
  addEventListener('keydown', e => {
    if (!document.getElementById('gate')) return;
    if (/^[0-9]$/.test(e.key)) bas(e.key);
    else if (e.key === 'Backspace') sil();
    else if (e.key === 'Enter') void onayla();
  });
}
