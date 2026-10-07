import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

type Oturum = { access_token: string; refresh_token: string };

let istemci: SupabaseClient | null = null;

export const bagliMi = () => istemci !== null;
export const sunucuAdresi = () => (URL ?? '').replace(/\/$/, '');

export function istemciAl(): SupabaseClient {
  if (!istemci) throw new Error('oturum yok');
  return istemci;
}

/* Jeton yalnız bellekte tutulur (persistSession kapalı); sayfa yenilenince PIN yeniden istenir. */
export async function oturumKur(o: Oturum) {
  if (!URL || !ANON) throw new Error('sunucu bağlantısı yapılandırılmamış');
  const yeni = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const { error } = await yeni.auth.setSession(o);
  if (error) throw error;
  istemci = yeni;
  document.dispatchEvent(new CustomEvent('astra:oturum'));
}
