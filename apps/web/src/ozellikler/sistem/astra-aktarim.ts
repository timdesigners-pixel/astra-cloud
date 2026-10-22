import { el } from '../../ortak/dom';
import { istemciAl } from '../../veri/istemci';
import { hataMetni } from '../../veri/hata';
import { panelSifirla } from '../../veri/panel';

type Paket = { format: 'astra-os-transfer'; version: 1; records: unknown[]; library: unknown[]; warnings?: string[] };
type Sonuc = { yeni: number; atlanacak: number; cakisma: number; toplam: number; onizleme: boolean };

export function aktarimPaneli(): HTMLElement {
  const section = el('section', 'card sistem-bolum');
  section.append(el('h2', '', 'Astra OS → canlı veri aktarımı'), el('p', 'bos', 'Depodan üretilen özel aktarım paketini seçin. Önizleme sunucuda mevcut kayıtlarla karşılaştırır. Uygulama tüm paketi tek işlemde yazar; hata olursa tamamı geri alınır. Mevcut kayıtlar değiştirilmez.'));
  const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Astra OS aktarım paketi');
  const preview = el('button', 'btn', 'Sunucuda önizle'); preview.type = 'button'; preview.disabled = true;
  const apply = el('button', 'btn primary', 'Paketi canlı kayıtlara aktar'); apply.type = 'button'; apply.disabled = true;
  const status = el('p', 'bos'); status.setAttribute('role', 'status');
  const notes = el('ul', 'bos');
  let packet: Paket | null = null, busy = false;
  file.addEventListener('change', () => {
    packet = null; apply.disabled = true; preview.disabled = !file.files?.length;
    notes.replaceChildren();
    status.textContent = 'Önce sunucu önizlemesini çalıştırın.';
  });
  async function run(dry: boolean) {
    if (busy) return;
    busy = true; preview.disabled = apply.disabled = file.disabled = true;
    try {
      if (dry) {
        const selected = file.files?.[0];
        if (!selected || selected.size > 10_000_000) throw new Error('10 MB altında bir aktarım paketi seçin.');
        const parsed = JSON.parse(await selected.text()) as Paket;
        if (parsed.format !== 'astra-os-transfer' || parsed.version !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.library)) throw new Error('Paket biçimi geçersiz.');
        packet = parsed;
        notes.replaceChildren();
        const warnings = new Map<string, number>();
        for (const warning of (parsed.warnings || []).slice(0, 100)) {
          const text = String(warning).slice(0, 500);
          warnings.set(text, (warnings.get(text) || 0) + 1);
        }
        for (const [text, count] of warnings) notes.appendChild(el('li', '', text + (count > 1 ? ` (${count} kayıt)` : '')));
      }
      if (!packet) throw new Error('Önizleme yapılmadı.');
      const { data, error } = await istemciAl().rpc('astra_os_aktar', { p_paket: packet, p_onizleme: dry });
      if (error) {
        if (error.code === 'PGRST202') throw new Error('0028_astra_os_aktarim.sql göçü sunucuda henüz uygulanmamış.');
        throw error;
      }
      const result = data as Sonuc;
      status.textContent = `${dry ? 'Önizleme' : 'Aktarım tamamlandı'}: ${result.yeni} yeni, ${result.atlanacak} mevcut/tekrar, ${result.cakisma} çakışma. ` +
        (dry ? 'Çakışma yoksa canlı aktarımı başlatabilirsiniz.' : 'Finans ve kütüphane ekranları artık bu kayıtları okuyabilir.') +
        (packet.warnings?.length ? ` Kaynak paketinde ${packet.warnings.length} eşleme notu var; numarası eksik dosyalar ve eşlenemeyen tarihsel veriler şifreli arşivde korunur.` : '');
      apply.disabled = !dry || result.cakisma > 0;
      if (!dry) { panelSifirla(); packet = null; }
    } catch (error) {
      status.textContent = hataMetni(error);
      apply.disabled = true;
    } finally { busy = false; file.disabled = false; preview.disabled = !file.files?.length; }
  }
  preview.addEventListener('click', () => void run(true));
  apply.addEventListener('click', () => void run(false));
  section.append(file, preview, apply, status, notes);
  return section;
}
