import { describe, it, expect } from 'vitest';
import { argumanAyristir, KOMUTLAR } from './arguman-hesap.ts';
import { KullanimHatasi, type KullanimHataKodu } from './komut-hata.ts';

const UUID = '11111111-1111-4111-8111-000000000001';

function kod(argv: string[]): KullanimHataKodu {
  try {
    argumanAyristir(argv);
  } catch (e) {
    expect(e).toBeInstanceOf(KullanimHatasi);
    return (e as KullanimHatasi).kod;
  }
  throw new Error('KullanimHatasi bekleniyordu');
}

describe('argumanAyristir: yardım ve komut seçimi', () => {
  it('argümansız çağrı yardım gösterir', () => {
    expect(argumanAyristir([]).komut).toBe('yardim');
  });
  it('--yardim ve -h her yerde yardım gösterir (diğer hatalardan önce)', () => {
    expect(argumanAyristir(['--yardim']).komut).toBe('yardim');
    expect(argumanAyristir(['-h']).komut).toBe('yardim');
    expect(argumanAyristir(['yaz', '--yardim']).komut).toBe('yardim');
    expect(argumanAyristir(['yaz', '-h', '--bilinmeyen']).komut).toBe('yardim');
  });
  it('yardim komutu çalışır', () => {
    expect(argumanAyristir(['yardim']).komut).toBe('yardim');
  });
  it('komut yoksa varsayılan kuru-calistir olur', () => {
    const { komut, secenek } = argumanAyristir(['--dalga', 'a', '--girdi', 'x.json']);
    expect(komut).toBe('kuru-calistir');
    expect([secenek.dalga, secenek.girdi]).toEqual(['a', 'x.json']);
  });
  it.each(KOMUTLAR.filter((k) => k !== 'yardim').map((k) => [k]))('%s komutu tanınır', (komut) => {
    const ek: Record<string, string[]> = {
      'kuru-calistir': ['--dalga', 'a', '--girdi', 'g.json'],
      yaz: ['--dalga', 'a', '--girdi', 'g.json'],
      dogrula: ['--dalga', 'a', '--girdi', 'g.json'],
      'geri-al': ['--dalga', 'a'],
      'yetim-tara': [],
      'statik-yukle': ['--kaynak', 'k'],
    };
    expect(argumanAyristir([komut, ...(ek[komut] ?? [])]).komut).toBe(komut);
  });
  it('bilinmeyen komut KOMUT_BILINMIYOR verir', () => {
    for (const k of ['foo', 'Yaz', 'kuru_calistir', 'drop', '']) expect(kod([k, '--dalga', 'a'])).toBe('KOMUT_BILINMIYOR');
  });
});

describe('argumanAyristir: bayraklar', () => {
  it('bilinmeyen bayrak BAYRAK_BILINMIYOR verir (yazım hatası, tek tire, konumsal argüman)', () => {
    for (const b of ['--foo', '--dalgaa', '-x', '--GIRDI', 'serbest']) expect(kod(['yetim-tara', b])).toBe('BAYRAK_BILINMIYOR');
  });
  it('değerli bayrağın değeri yoksa BAYRAK_DEGERI_YOK verir', () => {
    expect(kod(['kuru-calistir', '--dalga'])).toBe('BAYRAK_DEGERI_YOK');
    expect(kod(['kuru-calistir', '--dalga', '--girdi', 'x'])).toBe('BAYRAK_DEGERI_YOK');
    expect(kod(['yetim-tara', '--baslangic'])).toBe('BAYRAK_DEGERI_YOK');
  });
  it('--bayrak=deger biçimini ve değerin içindeki = işaretini destekler', () => {
    const { secenek } = argumanAyristir(['kuru-calistir', '--dalga=b', '--girdi=a=b.json']);
    expect([secenek.dalga, secenek.girdi]).toEqual(['b', 'a=b.json']);
  });
  it('mantıksal bayraklar', () => {
    const { secenek } = argumanAyristir(['yetim-tara', '--json', '--sessiz', '--uygulama-durumlarini-sil', '--yetim-temizle', '--baslangic', '2026-06-01T00:00:00Z']);
    expect([secenek.json, secenek.sessiz, secenek.uygulamaDurumlariniSil, secenek.yetimTemizle]).toEqual([true, true, true, true]);
    const { secenek: bos } = argumanAyristir(['yetim-tara']);
    expect([bos.json, bos.sessiz, bos.uygulamaDurumlariniSil, bos.yetimTemizle]).toEqual([false, false, false, false]);
  });
});

describe('argumanAyristir: --onay', () => {
  const temel = ['yaz', '--dalga', 'a', '--girdi', 'g.json'];
  it('değeri alır (ayrı ve = biçimi)', () => {
    expect(argumanAyristir([...temel, '--onay', 'ONAY-a-0123456789ab']).secenek.onay).toBe('ONAY-a-0123456789ab');
    expect(argumanAyristir([...temel, '--onay=ONAY-a-0123456789ab']).secenek.onay).toBe('ONAY-a-0123456789ab');
  });
  it('bayrak yoksa undefined, değersizse boş metin olur', () => {
    expect(argumanAyristir(temel).secenek.onay).toBeUndefined();
    expect(argumanAyristir([...temel, '--onay']).secenek.onay).toBe('');
    expect(argumanAyristir([...temel, '--onay', '--json']).secenek.onay).toBe('');
    expect(argumanAyristir([...temel, '--onay', '--json']).secenek.json).toBe(true);
  });
});

describe('argumanAyristir: sır taşıyabilecek bayraklar yasaktır, değer YANKILANMAZ', () => {
  const yasak = ['--pin', '--PIN', '--parola', '--password', '--sifre', '--token', '--anahtar', '--key', '--pinx', '--Token'];
  it.each(yasak.map((b) => [b]))('%s PIN_ARGUMANI_YASAK verir', (bayrak) => {
    expect(kod(['yaz', '--dalga', 'a', '--girdi', 'g.json', bayrak, '123456'])).toBe('PIN_ARGUMANI_YASAK');
  });
  it('--pin=123456 biçimi de reddedilir', () => {
    expect(kod(['yaz', '--pin=123456'])).toBe('PIN_ARGUMANI_YASAK');
  });
  it('yasak bayrak diğer hatalardan önce denetlenir (komut bilinmese de)', () => {
    expect(kod(['yaz', '--pin', '123456', '--dalga', 'z'])).toBe('PIN_ARGUMANI_YASAK');
  });
  it('hata mesajı bayrak adını ve değeri taşımaz', () => {
    try {
      argumanAyristir(['yaz', '--dalga', 'a', '--girdi', 'g.json', '--pin', '123456']);
    } catch (e) {
      expect((e as Error).message).toBe('KULLANIM_HATASI PIN_ARGUMANI_YASAK');
      expect((e as Error).message).not.toContain('123456');
      expect((e as Error).message.toLowerCase()).not.toContain('--pin');
    }
    try {
      argumanAyristir(['yaz', '--gizli-bayrak-123456']);
    } catch (e) {
      expect((e as Error).message).toBe('KULLANIM_HATASI BAYRAK_BILINMIYOR');
    }
  });
  it('--pin değeri başka bayrağın değeri sanılırsa sızmaz', () => {
    expect(kod(['kuru-calistir', '--dalga', 'a', '--girdi', '--pin', '123456'])).toBe('BAYRAK_DEGERI_YOK');
  });
});

describe('argumanAyristir: değer doğrulamaları', () => {
  it('dalga a/b/c dışında DALGA_GECERSIZ verir', () => {
    for (const d of ['d', 'A', 'ab', '']) expect(kod(['kuru-calistir', '--dalga', d, '--girdi', 'x'])).toBe('DALGA_GECERSIZ');
  });
  it('kuru-calistir, yaz, dogrula dalga ve girdi ister', () => {
    for (const k of ['kuru-calistir', 'yaz', 'dogrula']) {
      expect(kod([k, '--girdi', 'x'])).toBe('DALGA_GEREKLI');
      expect(kod([k, '--dalga', 'a'])).toBe('GIRDI_GEREKLI');
      expect(kod([k, '--dalga', 'a', '--girdi', '   '])).toBe('GIRDI_GEREKLI');
    }
  });
  it('--aktarim UUID olmalı', () => {
    expect(kod(['geri-al', '--aktarim', 'abc'])).toBe('AKTARIM_GECERSIZ');
    expect(kod(['geri-al', '--aktarim', 'ABCDEFAB-1111-4111-8111-000000000001'])).toBe('AKTARIM_GECERSIZ');
    expect(argumanAyristir(['geri-al', '--aktarim', UUID]).secenek.aktarim).toBe(UUID);
  });
  it('geri-al ya --aktarim ya --dalga ister', () => {
    expect(kod(['geri-al'])).toBe('AKTARIM_GEREKLI');
    expect(kod(['geri-al', '--onay', 'x'])).toBe('AKTARIM_GEREKLI');
    expect(argumanAyristir(['geri-al', '--dalga', 'a']).komut).toBe('geri-al');
  });
  it('--baslangic geçerli tarih olmalı', () => {
    for (const b of ['dün', '2026-13-45', '']) expect(kod(['yetim-tara', '--baslangic', b])).toBe('BASLANGIC_GECERSIZ');
    expect(argumanAyristir(['yetim-tara', '--baslangic', '2026-06-01T00:00:00Z']).secenek.baslangic).toBe('2026-06-01T00:00:00Z');
  });
  it('--yetim-temizle --baslangic ister', () => {
    expect(kod(['yetim-tara', '--yetim-temizle'])).toBe('BASLANGIC_GEREKLI');
    expect(argumanAyristir(['yetim-tara', '--yetim-temizle', '--baslangic', '2026-06-01']).secenek.yetimTemizle).toBe(true);
    expect(argumanAyristir(['yetim-tara', '--baslangic', '2026-06-01']).secenek.yetimTemizle).toBe(false);
  });
});

describe('argumanAyristir: statik-yukle', () => {
  it('--kaynak zorunludur', () => {
    expect(kod(['statik-yukle'])).toBe('KAYNAK_GEREKLI');
    expect(kod(['statik-yukle', '--kaynak', '  '])).toBe('KAYNAK_GEREKLI');
  });
  it('--kova dosyalar kapsam dışıdır; başka kova geçersizdir; apps kabul edilir', () => {
    expect(kod(['statik-yukle', '--kaynak', 'k', '--kova', 'dosyalar'])).toBe('KAPSAM_DISI_DOSYALAR_KOVASI');
    expect(kod(['statik-yukle', '--kaynak', 'k', '--kova', 'baska'])).toBe('KOVA_GECERSIZ');
    expect(argumanAyristir(['statik-yukle', '--kaynak', 'k', '--kova', 'apps']).secenek.kova).toBe('apps');
  });
  it('--ilgi statik-yukle için kapsam dışıdır (sessizce yok sayılmaz)', () => {
    expect(kod(['statik-yukle', '--kaynak', 'k', '--ilgi', 'i.json'])).toBe('KAPSAM_DISI_ILGI');
  });
  it('--ilgi kuru-calistir için geçerlidir', () => {
    expect(argumanAyristir(['kuru-calistir', '--dalga', 'a', '--girdi', 'g', '--ilgi', 'i.json']).secenek.ilgi).toBe('i.json');
  });
  it('--onay verilirse alınır', () => {
    expect(argumanAyristir(['statik-yukle', '--kaynak', 'k', '--onay', 'ONAY-statik-0123456789ab']).secenek.onay).toBe('ONAY-statik-0123456789ab');
  });
});
