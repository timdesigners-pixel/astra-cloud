/* Düzenleyici HTML metinle çizilir; tıklama ve değişiklik işleyicileri çizim başına bir kayıt tablosunda
   tutulur ve kök öğede olay devriyle çalıştırılır. Her tam çizimde tablo sıfırlanır. */
const tik = new Map<number, (el: HTMLElement) => void>();
const degis = new Map<number, (el: HTMLInputElement & HTMLSelectElement) => void>();
let sayac = 0;

export const onTik = (fn: (el: HTMLElement) => void) => { const i = ++sayac; tik.set(i, fn); return `data-o="${i}"`; };
export const onDegis = (fn: (el: HTMLInputElement & HTMLSelectElement) => void) => { const i = ++sayac; degis.set(i, fn); return `data-d="${i}"`; };
export const olaySifirla = () => { tik.clear(); degis.clear(); };

export function olaylariBagla(kok: HTMLElement) {
  kok.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-o]');
    if (!t || !kok.contains(t)) return;
    tik.get(Number(t.dataset.o))?.(t);
  });
  kok.addEventListener('change', e => {
    const t = (e.target as HTMLElement).closest<HTMLInputElement & HTMLSelectElement>('[data-d]');
    if (!t || !kok.contains(t)) return;
    degis.get(Number(t.dataset.d))?.(t);
  });
}
