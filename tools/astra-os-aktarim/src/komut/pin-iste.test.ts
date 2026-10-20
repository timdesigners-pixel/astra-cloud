import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gizli } from '../ayar.ts';
import { ciktiYakala, type CiktiYakalayici } from '../test-destek.ts';
import { pinIste } from './pin-iste.ts';

type VeriIsleyici = (parca: string | Buffer) => void;

/* process.stdin taklidi: gerçek terminal/ağ yok. Olay dinleyicileri yakalanır, ham kip çağrıları sayılır. */
function stdinTaklit(tty: boolean) {
  const isleyiciler: VeriIsleyici[] = [];
  const cagrilar: string[] = [];
  const girdi = process.stdin as unknown as Record<string, unknown>;
  const eski = {
    isTTY: Object.getOwnPropertyDescriptor(girdi, 'isTTY'),
    setRawMode: Object.getOwnPropertyDescriptor(girdi, 'setRawMode'),
  };
  Object.defineProperty(girdi, 'isTTY', { value: tty, configurable: true, writable: true });
  Object.defineProperty(girdi, 'setRawMode', { value: (kip: boolean) => void cagrilar.push(`ham:${kip}`), configurable: true, writable: true });
  const spies = [
    vi.spyOn(process.stdin, 'on').mockImplementation(((ad: string, fn: VeriIsleyici) => {
      if (ad === 'data') isleyiciler.push(fn);
      return process.stdin;
    }) as never),
    vi.spyOn(process.stdin, 'off').mockImplementation(((ad: string, fn: VeriIsleyici) => {
      if (ad === 'data') isleyiciler.splice(isleyiciler.indexOf(fn), 1);
      cagrilar.push('off');
      return process.stdin;
    }) as never),
    vi.spyOn(process.stdin, 'setEncoding').mockImplementation((() => process.stdin) as never),
    vi.spyOn(process.stdin, 'resume').mockImplementation((() => (cagrilar.push('resume'), process.stdin)) as never),
    vi.spyOn(process.stdin, 'pause').mockImplementation((() => (cagrilar.push('pause'), process.stdin)) as never),
  ];
  return {
    isleyiciler,
    cagrilar,
    yaz: (metin: string) => isleyiciler.forEach((f) => f(metin)),
    geriYukle: () => {
      for (const s of spies) s.mockRestore();
      for (const [ad, d] of Object.entries(eski)) {
        if (d) Object.defineProperty(girdi, ad, d);
        else delete girdi[ad];
      }
    },
  };
}

let yakala: CiktiYakalayici;
let taklit: ReturnType<typeof stdinTaklit>;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => {
  taklit?.geriYukle();
  yakala.birak();
});

describe('pinIste', () => {
  it('etkileşimli terminal yoksa istem göstermeden null döner', async () => {
    taklit = stdinTaklit(false);
    expect(await pinIste()).toBeNull();
    expect(yakala.satirlar).toEqual([]);
    expect(taklit.isleyiciler).toHaveLength(0);
  });

  it('terminalde sabit istemi yazar; rakamları Gizli içinde toplar; PIN ekrana yazılmaz', async () => {
    taklit = stdinTaklit(true);
    const p = pinIste();
    expect(yakala.satirlar).toEqual(['PIN (gizli, ekranda gorunmez): ']);
    taklit.yaz('123');
    taklit.yaz('456\r');
    const g = await p;
    expect(g).toBeInstanceOf(Gizli);
    expect(g!.ac()).toBe('123456');
    expect(String(g)).toBe('[gizli]');
    expect(yakala.metin()).not.toContain('123456');
    expect(yakala.satirlar.at(-1)).toBe(''); /* imleç yeni satıra */
    expect(taklit.cagrilar).toContain('ham:true');
    expect(taklit.cagrilar).toContain('ham:false');
    expect(taklit.isleyiciler).toHaveLength(0); /* dinleyici kaldırıldı */
  });

  it('geri silme (DEL ve BS) son rakamı siler; rakam olmayan karakterler yok sayılır', async () => {
    taklit = stdinTaklit(true);
    const p = pinIste();
    taklit.yaz('12a3-4\u007f5\b6');
    taklit.yaz('\n');
    expect((await p)!.ac()).toBe('1236');
  });

  it('en çok 8 rakam alınır', async () => {
    taklit = stdinTaklit(true);
    const p = pinIste();
    taklit.yaz('123456789012\r');
    expect((await p)!.ac()).toBe('12345678');
  });

  it('Ctrl-C ve Ctrl-D null döner', async () => {
    for (const tus of ['\u0003', '\u0004']) {
      taklit = stdinTaklit(true);
      const p = pinIste();
      taklit.yaz(`123${tus}`);
      expect(await p).toBeNull();
      taklit.geriYukle();
    }
  });

  it('boş girişte (yalnız Enter) null döner', async () => {
    taklit = stdinTaklit(true);
    const p = pinIste();
    taklit.yaz('\r');
    expect(await p).toBeNull();
  });
});
