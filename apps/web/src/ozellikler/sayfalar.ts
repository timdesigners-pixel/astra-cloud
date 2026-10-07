import { icraBorclariSayfasi } from './icra/icra';
import { kisilerSayfasi } from './kisiler/kisiler';

/* Veriyle çalışan sayfalar; kaydı olmayan sekmeler kabukta yer tutucu gösterir. */
export const SAYFALAR: Record<string, (kok: HTMLElement) => void> = {
  kisiler: kisilerSayfasi,
  icraborc: icraBorclariSayfasi,
};
