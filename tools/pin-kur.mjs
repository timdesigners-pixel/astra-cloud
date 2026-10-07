// Kullanım: SUPABASE_URL=… SERVICE_ROLE_KEY=… ASTRA_PIN_BIBER=… SAHIP_ID=… node tools/pin-kur.mjs
// PIN terminalde gizli sorulur; hiçbir yere yazılmaz, yalnız HMAC etiketi kaydedilir.
import { createHmac } from 'node:crypto';
import { createInterface } from 'node:readline';

const { SUPABASE_URL, SERVICE_ROLE_KEY, ASTRA_PIN_BIBER, SAHIP_ID } = process.env;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ASTRA_PIN_BIBER || !SAHIP_ID) {
  console.error('Eksik ortam değişkeni: SUPABASE_URL, SERVICE_ROLE_KEY, ASTRA_PIN_BIBER, SAHIP_ID');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.stdoutMuted = true;
rl._writeToOutput = s => { if (!rl.stdoutMuted) rl.output.write(s); };
const pin = await new Promise(r => rl.question('PIN (6-8 hane): ', r));
rl.close();
console.log();

const zayif = ['111111', '123456', '000000', '654321'];
if (!/^[0-9]{6,8}$/.test(pin) || zayif.includes(pin) || /^(\d)\1+$/.test(pin)) {
  console.error('PIN 6-8 hane olmalı ve zayıf (111111, 123456, aynı rakam…) olmamalı.');
  process.exit(1);
}

const etiket = createHmac('sha256', ASTRA_PIN_BIBER).update(`${SAHIP_ID}:${pin}`).digest('hex');
const r = await fetch(`${SUPABASE_URL}/rest/v1/pin_giris?on_conflict=sahip_id`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
  },
  body: JSON.stringify({ sahip_id: SAHIP_ID, pin_etiketi: etiket, deneme: 0, kilit_bitis: null, kilit_kat: 0 }),
});
console.log(r.ok ? 'PIN kaydedildi.' : `Hata: ${r.status} ${await r.text()}`);
