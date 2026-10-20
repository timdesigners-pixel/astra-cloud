import { GirdiHatasi } from './girdi-hata.ts';
import { duzNesneMi, semaAyristir, semaKokuMu, type SemaSonucu } from './sema-ayristirici-hesap.ts';

const AZAMI_ZARF_DERINLIGI = 4;

function jsonCoz(metin: string): unknown {
  try {
    return JSON.parse(metin);
  } catch {
    /* Ayrıntı bilerek atılır: ayrıştırıcı hata metni girdiden parça içerebilir. */
    throw new GirdiHatasi('BOZUK_JSON');
  }
}

/* Girdi metnini tek `S` nesnesine çözer. SAF: dosya/ağ/ortam yok. Tanınan biçimler:
   düz S (yedek JSON veya `durum` çıktısı), `{durum: S}`, `{govde: ...}`, `{v:0, m:'<json>'}` düz zarf.
   `{v:1|2,...}` şifreli zarf çözülmez (K-3) → SIFRELI_GIRDI. */
export function girdiCoz(metin: string): SemaSonucu {
  const temiz = metin.replace(/^﻿/, '').trim();
  if (temiz === '') throw new GirdiHatasi('GIRDI_BOS');
  let kok: unknown = jsonCoz(temiz);

  for (let derinlik = 0; derinlik < AZAMI_ZARF_DERINLIGI; derinlik++) {
    /* jsonb metin olarak dışa aktarılmış olabilir: JSON içinde JSON metni. */
    if (typeof kok === 'string') {
      kok = jsonCoz(kok);
      continue;
    }
    /* SQL/REST çıktısı tek satırlık dizi olabilir: [{durum: S}]. */
    if (Array.isArray(kok) && kok.length === 1) {
      kok = kok[0];
      continue;
    }
    if (!duzNesneMi(kok)) throw new GirdiHatasi('GIRDI_BICIMI_TANINMADI');

    if (kok.v === 1 || kok.v === 2) throw new GirdiHatasi('SIFRELI_GIRDI');
    if (semaKokuMu(kok)) return semaAyristir(kok);

    if (kok.v === 0 && (typeof kok.m === 'string' || duzNesneMi(kok.m))) {
      kok = kok.m;
      continue;
    }
    if (Object.hasOwn(kok, 'durum')) {
      kok = kok.durum;
      continue;
    }
    if (Object.hasOwn(kok, 'govde')) {
      kok = kok.govde;
      continue;
    }
    throw new GirdiHatasi('GIRDI_BICIMI_TANINMADI');
  }
  throw new GirdiHatasi('GIRDI_BICIMI_TANINMADI');
}
