/* `statik-yukle` REZERVE: Storage yükleme (servis anahtarı, beyaz liste, sha256 doğrulama) T6 görevinde yazılacak. İskelet bilerek yok. */
import { KomutHatasi } from './komut-hata.ts';

export function statikYukle(): never {
  throw new KomutHatasi('KOMUT_T6_GOREVI', { gorev: 'T6', komut: 'statik-yukle' }, 2);
}
