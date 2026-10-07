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
