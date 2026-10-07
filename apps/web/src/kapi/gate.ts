import { SURUM } from './surum';
import { oturumKur } from '../veri/istemci';

const MIN = 6;
const MAX = 8;
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

type Oturum = { access_token: string; refresh_token: string };
type Sonuc = { durum: number; govde: Record<string, any> };

/* Erişim jetonu yalnız bellekte durur; sayfa yenilenince PIN yeniden istenir. */
let oturum: Oturum | null = null;
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
  setTimeout(() => {
    g.remove();
    document.body.classList.remove('g-reveal');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 60 : 960);
}
const saat = (t: string) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

async function sunucu(govde: object): Promise<Sonuc | null> {
  if (!SB_URL || !SB_ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/functions/v1/pin-giris`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      body: JSON.stringify(govde),
    });
    return { durum: r.status, govde: await r.json().catch(() => ({})) };
  } catch {
    return null;
  }
}

function hataMetni(s: Sonuc | null): string {
  if (!s) return SB_URL && SB_ANON ? 'bağlantı yok — sunucuya ulaşılamadı' : 'sunucu bağlantısı yapılandırılmamış';
  if (s.durum === 401 && s.govde.hata === 'kod') return 'kurulum kodu hatalı';
  if (s.durum === 401) return s.govde.kalan ? `PIN hatalı · ${s.govde.kalan} deneme kaldı` : 'PIN hatalı';
  if (s.durum === 423) return `çok fazla hatalı deneme — ${saat(s.govde.kilitBitis)}'e kadar kilitli`;
  if (s.durum === 400 && s.govde.hata) return s.govde.hata;
  if (s.durum === 500 && s.govde.hata === 'yapılandırma') return 'sunucu ayarları eksik (gizli ayarlar girilmemiş)';
  return 'giriş şu an yapılamıyor';
}

export async function kapiyiBaslat() {
  $('gsurum').textContent = SURUM;
  const inp = $<HTMLInputElement>('gpin');
  const kod = $<HTMLInputElement>('gkod');
  let kurulum = false;
  let ilkPin = '';
  let mesgul = false;

  const yenile = () => noktalar(inp.value.length);
  const kipYaz = (kur: boolean, sifirlama = false) => {
    kurulum = kur; ilkPin = ''; inp.value = ''; yenile(); mesaj('');
    kod.hidden = !kur;
    $('gbaslik').textContent = kur ? '◈ PIN Oluştur' : '◉ Kilitli';
    $('galt').textContent = kur
      ? (sifirlama ? 'PIN sıfırlamak için kurulum kodunu ve yeni PIN\'i gir.' : 'İlk kurulum: kurulum kodunu ve 6–8 haneli bir PIN gir.')
      : 'Devam etmek için PIN gir.';
    $('galtdugme').textContent = kur ? 'Vazgeç' : "PIN'i unuttum";
    if (kur) kod.focus();
  };

  yenile();
  const d = await sunucu({ islem: 'durum' });
  if (d && d.durum === 200 && d.govde.kurulu === false) kipYaz(true);

  const bas = (c: string) => {
    if (mesgul || inp.value.length >= MAX) return;
    inp.value += c; yenile(); mesaj('');
  };
  const sil = () => { inp.value = inp.value.slice(0, -1); yenile(); mesaj(''); };

  const onayla = async () => {
    const pin = inp.value;
    if (mesgul) return;
    if (pin.length < MIN) { mesaj(`en az ${MIN} hane gerekli`, 'err'); salla(); return; }
    if (kurulum) {
      if (!kod.value.trim()) { mesaj('kurulum kodunu yaz', 'err'); salla(); kod.focus(); return; }
      if (!ilkPin) { ilkPin = pin; inp.value = ''; yenile(); mesaj("PIN'i bir kez daha gir", 'ok'); return; }
      if (ilkPin !== pin) { ilkPin = ''; inp.value = ''; yenile(); mesaj('iki giriş uyuşmadı — baştan', 'err'); salla(); return; }
    }
    mesgul = true;
    mesaj(kurulum ? 'PIN kuruluyor…' : 'bulut kasası açılıyor…', 'ok');
    const s = await sunucu(kurulum ? { islem: 'kur', kod: kod.value.trim(), pin } : { pin });
    mesgul = false;
    if (s && s.durum === 200) {
      oturum = { access_token: s.govde.access_token, refresh_token: s.govde.refresh_token };
      try { await oturumKur(oturum); }
      catch (e) { console.warn('oturum kurulamadı', e); oturum = null; ilkPin = ''; inp.value = ''; yenile(); salla(); mesaj('oturum kurulamadı — sunucuya ulaşılamadı', 'err'); return; }
      kod.value = '';
      mesaj(kurulum ? 'PIN kuruldu — açılıyor' : 'açılıyor', 'ok');
      ac();
      return;
    }
    if (s && s.durum === 409) { kipYaz(true); mesaj('PIN henüz kurulmamış', 'err'); return; }
    ilkPin = ''; inp.value = ''; yenile(); salla(); mesaj(hataMetni(s), 'err');
  };

  $('gpad').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.d) bas(b.dataset.d);
    else if (b.dataset.a === 'sil') sil();
    else if (b.dataset.a === 'gir') void onayla();
  });
  $('galtdugme').addEventListener('click', () => (kurulum ? kipYaz(false) : kipYaz(true, true)));
  addEventListener('keydown', e => {
    if (!document.getElementById('gate')) return;
    if ((e.target as HTMLElement).id === 'gkod') {
      if (e.key === 'Enter') inp.focus();
      return;
    }
    if (/^[0-9]$/.test(e.key)) bas(e.key);
    else if (e.key === 'Backspace') sil();
    else if (e.key === 'Enter') void onayla();
  });
}
