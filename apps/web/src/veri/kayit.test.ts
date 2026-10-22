import { beforeEach, describe, expect, it, vi } from 'vitest';
const { istemci, sorgu, range } = vi.hoisted(() => {
  const range = vi.fn();
  const sorgu = { select: vi.fn(), is: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
  for (const ad of ['select', 'is', 'eq', 'order'] as const) sorgu[ad].mockReturnValue(sorgu);
  return { istemci: { from: vi.fn().mockReturnValue(sorgu) }, sorgu, range };
});
vi.mock('./istemci', () => ({ istemciAl: () => istemci }));
import { kayitlariGetir } from './kayit';

describe('büyük kayıt listeleri', () => {
  beforeEach(() => { vi.clearAllMocks(); range.mockReset(); });
  it('4207 kaydı filtre ve kararlı sıralamayla eksiksiz okur', async () => {
    const tumu = Array.from({ length: 4207 }, (_, i) => ({ id: String(i), surum: 1 }));
    range.mockImplementation(async (ilk: number, son: number) => ({ data: tumu.slice(ilk, son + 1), error: null }));
    expect(await kayitlariGetir('zihin_sayfalari', ['baslik'], { alan: 'kutuphane' }, 'sira')).toEqual(tumu);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999]]);
    expect(sorgu.eq).toHaveBeenCalledTimes(5);
    expect(sorgu.eq).toHaveBeenCalledWith('alan', 'kutuphane');
    expect(sorgu.is).toHaveBeenCalledWith('silindi_at', null);
    expect(sorgu.order.mock.calls).toEqual(Array.from({ length: 5 }, () => [['sira'], ['id']]).flat());
  });
  it('sonraki sayfadaki hatada eksik liste döndürmez', async () => {
    const hata = new Error('ikinci sayfa alınamadı');
    range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })), error: null })
      .mockResolvedValueOnce({ data: null, error: hata });
    await expect(kayitlariGetir('zihin_sayfalari', [], {}, 'id')).rejects.toBe(hata);
    expect(sorgu.order.mock.calls).toEqual([['id'], ['id']]);
  });
  it('boş listede durur', async () => {
    range.mockResolvedValue({ data: null, error: null });
    expect(await kayitlariGetir('zihin_sayfalari', [], {}, 'id')).toEqual([]);
    expect(range).toHaveBeenCalledTimes(1);
  });
});
