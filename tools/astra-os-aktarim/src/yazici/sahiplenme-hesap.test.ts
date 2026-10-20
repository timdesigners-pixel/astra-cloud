import { describe, it, expect } from 'vitest';
import type { BegeniPlanKaydi, UygulamaPlanKaydi } from '../plan/plan-tipleri.ts';
import { hedefDurumuKur, sahiplenmeKarariVer } from './sahiplenme-hesap.ts';

function uyg(uygulama: string, anahtar: string): UygulamaPlanKaydi {
  return { tablo: 'uygulama_durumu', koleksiyon: 'apps', kaynak_id: `${uygulama}/${anahtar}`, uygulama, anahtar, deger: '1' };
}
function begeni(kod: string): BegeniPlanKaydi {
  return {
    tablo: 'begeniler', koleksiyon: 'ilgi_urunleri', kaynak_id: kod,
    satir: {
      kod, sira: 1, kategori: 'diger', ad: 'x', resim: null, rozet: null, fiyat: null, fiyat_etiketi: null, ozellikler: [], notlar: null, baglantilar: [],
      oncelik: 'medium', favori: false, puan: null, hedef_fiyat: null, fiyat_gecmisi: [], ilk_fiyat: null, ekstra: { eski: { koleksiyon: 'ilgi_urunleri', id: kod } },
    },
  };
}

describe('hedefDurumuKur', () => {
  it('uygulama anahtarlarını kümeye, beğeni kodlarını kimlik listesine çevirir (aynı kod birden çok satır olabilir)', () => {
    const h = hedefDurumuKur({ odeme: ['a', 'b'], bahis: [] }, [{ id: 'i1', kod: 'k1' }, { id: 'i2', kod: 'k1' }, { id: 'i3', kod: 'k2' }]);
    expect([...h.uygulamaAnahtarlari.get('odeme')!]).toEqual(['a', 'b']);
    expect(h.uygulamaAnahtarlari.get('bahis')!.size).toBe(0);
    expect(h.begeniKodlari.get('k1')).toEqual(['i1', 'i2']);
    expect(h.begeniKodlari.get('k2')).toEqual(['i3']);
  });
});

describe('sahiplenmeKarariVer', () => {
  const bos = hedefDurumuKur({}, []);

  it('aktif eşleşme varsa her zaman ATLA (hedef durumundan bağımsız)', () => {
    expect(sahiplenmeKarariVer(uyg('odeme', 'a'), true, bos)).toEqual({ karar: 'ATLA' });
    expect(sahiplenmeKarariVer(begeni('k1'), true, hedefDurumuKur({}, [{ id: 'i', kod: 'k1' }]))).toEqual({ karar: 'ATLA' });
  });

  it('uygulama_durumu: hedefte yoksa YAZ', () => {
    expect(sahiplenmeKarariVer(uyg('odeme', 'a'), false, bos)).toEqual({ karar: 'YAZ' });
    expect(sahiplenmeKarariVer(uyg('odeme', 'a'), false, hedefDurumuKur({ odeme: ['b'], bahis: ['a'] }, []))).toEqual({ karar: 'YAZ' });
  });

  it('uygulama_durumu: hedefte aynı anahtar varsa SAHIPLEN (yazma yok; kaynak kimliği hedef_ref olur)', () => {
    expect(sahiplenmeKarariVer(uyg('odeme', 'a'), false, hedefDurumuKur({ odeme: ['a'] }, []))).toEqual({ karar: 'SAHIPLEN', hedef_id: null, hedef_ref: 'odeme/a' });
  });

  it('begeniler: aday yoksa YAZ, tek aday varsa SAHIPLEN, birden çok aday varsa BELIRSIZ', () => {
    expect(sahiplenmeKarariVer(begeni('k1'), false, hedefDurumuKur({}, [{ id: 'i', kod: 'baska' }]))).toEqual({ karar: 'YAZ' });
    expect(sahiplenmeKarariVer(begeni('k1'), false, hedefDurumuKur({}, [{ id: 'i1', kod: 'k1' }]))).toEqual({ karar: 'SAHIPLEN', hedef_id: 'i1', hedef_ref: null });
    expect(sahiplenmeKarariVer(begeni('k1'), false, hedefDurumuKur({}, [{ id: 'i1', kod: 'k1' }, { id: 'i2', kod: 'k1' }]))).toEqual({ karar: 'BELIRSIZ' });
  });

  it('kod eşleşmesi büyük/küçük harfe ve boşluğa duyarlıdır (otomatik bulanık eşleme yok)', () => {
    expect(sahiplenmeKarariVer(begeni('K1'), false, hedefDurumuKur({}, [{ id: 'i1', kod: 'k1' }]))).toEqual({ karar: 'YAZ' });
  });
});
