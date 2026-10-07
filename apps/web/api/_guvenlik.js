/* Sunucu uçlarının ortak kötüye kullanım koruması (alt çizgili dosya Vercel'de uç olarak yayınlanmaz, yalnız içe aktarılır).
 *   · hizSayaci: IP başına pencere içi istek sınırı. */
export function hizSayaci(sinir, pencereMs = 10 * 60 * 1000){
  const sayac = new Map();
  return req => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || '?';
    const simdi = Date.now();
    const k = sayac.get(ip) || {bas: simdi, n: 0};
    if(simdi - k.bas > pencereMs){ k.bas = simdi; k.n = 0; }
    k.n++; sayac.set(ip, k);
    if(sayac.size > 5000) for(const [a, v] of sayac) if(simdi - v.bas > pencereMs) sayac.delete(a);
    return k.n > sinir;
  };
}

/* Uç yalnız giriş yapmış kullanıcıya yanıt verir: istekteki Supabase jetonu Supabase'e doğrulatılır. */
export async function oturumVar(req, getir = fetch){
  const m = String(req.headers.authorization || '').match(/^Bearer (\S+)$/);
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anahtar = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if(!m || !url || !anahtar) return false;
  try{
    const r = await getir(url.replace(/\/$/, '') + '/auth/v1/user', {headers: {apikey: anahtar, Authorization: 'Bearer ' + m[1]}, signal: AbortSignal.timeout(5000)});
    return r.ok;
  }catch(e){ return false; }
}
