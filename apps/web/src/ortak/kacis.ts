const KACIS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/* Metni HTML içine güvenle yazmak için. */
export const kacis = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => KACIS[c]!);
