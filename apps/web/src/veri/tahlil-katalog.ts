/* Sık istenen tahlillerin adı, birimi ve genel yetişkin referans aralığı. Rapordaki aralık varsa o, yoksa buradaki kullanılır. */
export type TestBilgisi = { anahtar: string; ad: string; birim: string; alt?: number; ust?: number; takma: string[]; grup: string };

const T = (grup: string, anahtar: string, ad: string, birim: string, alt: number | undefined, ust: number | undefined, ...takma: string[]): TestBilgisi =>
  ({ grup, anahtar, ad, birim, alt, ust, takma });

export const KATALOG: TestBilgisi[] = [
  T('Hemogram', 'wbc', 'Lökosit (WBC)', '10³/µL', 4, 10, 'wbc', 'lokosit', 'beyaz küre', 'akyuvar'),
  T('Hemogram', 'rbc', 'Eritrosit (RBC)', '10⁶/µL', 4.1, 5.9, 'rbc', 'eritrosit', 'kırmızı küre', 'alyuvar'),
  T('Hemogram', 'hgb', 'Hemoglobin (HGB)', 'g/dL', 12, 17.5, 'hgb', 'hemoglobin', 'hb'),
  T('Hemogram', 'hct', 'Hematokrit (HCT)', '%', 36, 52, 'hct', 'hematokrit'),
  T('Hemogram', 'mcv', 'MCV', 'fL', 80, 100, 'mcv'),
  T('Hemogram', 'mch', 'MCH', 'pg', 27, 33, 'mch'),
  T('Hemogram', 'mchc', 'MCHC', 'g/dL', 32, 36, 'mchc'),
  T('Hemogram', 'plt', 'Trombosit (PLT)', '10³/µL', 150, 450, 'plt', 'trombosit', 'platelet'),
  T('Hemogram', 'rdw', 'RDW', '%', 11.5, 14.5, 'rdw', 'rdw-cv'),
  T('Hemogram', 'mpv', 'MPV', 'fL', 7.5, 11.5, 'mpv'),
  T('Hemogram', 'notrofil', 'Nötrofil sayısı', '10³/µL', 1.8, 7.7, 'nötrofil', 'neu#', 'neut#', 'neutrofil'),
  T('Hemogram', 'lenfosit', 'Lenfosit sayısı', '10³/µL', 1, 4.8, 'lenfosit', 'lym#', 'lenf#'),
  T('Şeker', 'glukoz', 'Açlık kan şekeri (glukoz)', 'mg/dL', 70, 100, 'glukoz', 'glikoz', 'glucose', 'açlık kan şekeri', 'kan şekeri', 'aks'),
  T('Şeker', 'hba1c', 'HbA1c', '%', 4, 5.6, 'hba1c', 'a1c', 'glikozile hemoglobin', 'glycohemoglobin'),
  T('Şeker', 'insulin', 'İnsülin', 'µIU/mL', 2.6, 24.9, 'insülin', 'insulin'),
  T('Şeker', 'homa', 'HOMA-IR', '', 0, 2.5, 'homa-ir', 'homa ir', 'homa'),
  T('Böbrek', 'ure', 'Üre', 'mg/dL', 17, 43, 'üre', 'ure'),
  T('Böbrek', 'bun', 'BUN', 'mg/dL', 6, 20, 'bun', 'kan üre azotu'),
  T('Böbrek', 'kreatinin', 'Kreatinin', 'mg/dL', 0.6, 1.3, 'kreatinin', 'creatinine'),
  T('Böbrek', 'urikasit', 'Ürik asit', 'mg/dL', 3.5, 7.2, 'ürik asit', 'urik asit', 'uric acid'),
  T('Karaciğer', 'alt', 'ALT (SGPT)', 'U/L', 0, 41, 'alt', 'sgpt', 'alanin aminotransferaz'),
  T('Karaciğer', 'ast', 'AST (SGOT)', 'U/L', 0, 40, 'ast', 'sgot', 'aspartat aminotransferaz'),
  T('Karaciğer', 'ggt', 'GGT', 'U/L', 0, 60, 'ggt', 'gama gt', 'gamma gt'),
  T('Karaciğer', 'alp', 'ALP', 'U/L', 40, 129, 'alp', 'alkalen fosfataz'),
  T('Karaciğer', 'ldh', 'LDH', 'U/L', 120, 246, 'ldh', 'laktat dehidrogenaz'),
  T('Karaciğer', 'bilirubin', 'Total bilirubin', 'mg/dL', 0.1, 1.2, 'total bilirubin', 'bilirubin total', 'bilirubin'),
  T('Karaciğer', 'direktbilirubin', 'Direkt bilirubin', 'mg/dL', 0, 0.3, 'direkt bilirubin', 'bilirubin direkt'),
  T('Karaciğer', 'protein', 'Total protein', 'g/dL', 6.4, 8.3, 'total protein', 'protein total'),
  T('Karaciğer', 'albumin', 'Albümin', 'g/dL', 3.5, 5.2, 'albümin', 'albumin'),
  T('Elektrolit', 'sodyum', 'Sodyum (Na)', 'mmol/L', 136, 145, 'sodyum', 'na', 'sodium'),
  T('Elektrolit', 'potasyum', 'Potasyum (K)', 'mmol/L', 3.5, 5.1, 'potasyum', 'k', 'potassium'),
  T('Elektrolit', 'klor', 'Klor (Cl)', 'mmol/L', 98, 107, 'klor', 'cl', 'chloride'),
  T('Elektrolit', 'kalsiyum', 'Kalsiyum (Ca)', 'mg/dL', 8.6, 10.2, 'kalsiyum', 'ca', 'calcium'),
  T('Elektrolit', 'fosfor', 'Fosfor (P)', 'mg/dL', 2.5, 4.5, 'fosfor', 'phosphorus'),
  T('Elektrolit', 'magnezyum', 'Magnezyum (Mg)', 'mg/dL', 1.6, 2.6, 'magnezyum', 'mg', 'magnesium'),
  T('Vitamin ve demir', 'demir', 'Demir', 'µg/dL', 60, 170, 'demir', 'serum demir', 'iron'),
  T('Vitamin ve demir', 'tibc', 'Demir bağlama (TIBC)', 'µg/dL', 250, 450, 'tibc', 'demir bağlama kapasitesi'),
  T('Vitamin ve demir', 'ferritin', 'Ferritin', 'ng/mL', 20, 250, 'ferritin'),
  T('Vitamin ve demir', 'b12', 'Vitamin B12', 'pg/mL', 200, 900, 'b12', 'vitamin b12', 'b-12', 'cobalamin'),
  T('Vitamin ve demir', 'folat', 'Folik asit (Folat)', 'ng/mL', 3, 17, 'folat', 'folik asit', 'folic acid'),
  T('Vitamin ve demir', 'dvit', 'D vitamini (25-OH)', 'ng/mL', 30, 100, '25-oh vitamin d', 'd vitamini', 'vitamin d', '25 oh d', '25-hidroksi vitamin d'),
  T('Vitamin ve demir', 'cinko', 'Çinko', 'µg/dL', 70, 120, 'çinko', 'cinko', 'zinc'),
  T('Hormon', 'tsh', 'TSH', 'µIU/mL', 0.27, 4.2, 'tsh', 'tiroid uyarıcı hormon'),
  T('Hormon', 'ft4', 'Serbest T4', 'ng/dL', 0.93, 1.7, 'sT4', 'ft4', 'serbest t4', 'free t4'),
  T('Hormon', 'ft3', 'Serbest T3', 'pg/mL', 2, 4.4, 'sT3', 'ft3', 'serbest t3', 'free t3'),
  T('Hormon', 'kortizol', 'Kortizol', 'µg/dL', 6.2, 19.4, 'kortizol', 'cortisol'),
  T('Hormon', 'prolaktin', 'Prolaktin', 'ng/mL', 4, 15.2, 'prolaktin', 'prolactin'),
  T('Hormon', 'psa', 'PSA (total)', 'ng/mL', 0, 4, 'psa', 'total psa', 'psa total'),
  T('Lipid', 'kolesterol', 'Total kolesterol', 'mg/dL', 0, 200, 'total kolesterol', 'kolesterol total', 'kolesterol', 'cholesterol'),
  T('Lipid', 'ldl', 'LDL kolesterol', 'mg/dL', 0, 130, 'ldl', 'ldl kolesterol', 'ldl-kolesterol'),
  T('Lipid', 'hdl', 'HDL kolesterol', 'mg/dL', 40, 100, 'hdl', 'hdl kolesterol', 'hdl-kolesterol'),
  T('Lipid', 'trigliserid', 'Trigliserid', 'mg/dL', 0, 150, 'trigliserid', 'triglycerides', 'tg'),
  T('Lipid', 'vldl', 'VLDL', 'mg/dL', 5, 40, 'vldl'),
  T('Enflamasyon', 'crp', 'CRP', 'mg/L', 0, 5, 'crp', 'c reaktif protein', 'c-reaktif protein'),
  T('Enflamasyon', 'sedim', 'Sedimantasyon', 'mm/saat', 0, 20, 'sedimantasyon', 'sedim', 'esr', 'eritrosit sedimantasyon hızı'),
  T('Enflamasyon', 'homosistein', 'Homosistein', 'µmol/L', 5, 15, 'homosistein', 'homocysteine'),
  T('Pıhtılaşma', 'inr', 'INR', '', 0.8, 1.2, 'inr'),
  T('Pıhtılaşma', 'pt', 'Protrombin zamanı (PT)', 'sn', 11, 15, 'pt', 'protrombin zamanı'),
  T('Pıhtılaşma', 'aptt', 'aPTT', 'sn', 25, 35, 'aptt', 'ptt'),
  T('Pıhtılaşma', 'fibrinojen', 'Fibrinojen', 'mg/dL', 200, 400, 'fibrinojen', 'fibrinogen'),
  T('Diğer', 'ck', 'CK (Kreatin kinaz)', 'U/L', 26, 192, 'ck', 'kreatin kinaz', 'cpk'),
  T('Diğer', 'amilaz', 'Amilaz', 'U/L', 28, 100, 'amilaz', 'amylase'),
  T('Diğer', 'lipaz', 'Lipaz', 'U/L', 13, 60, 'lipaz', 'lipase'),
];

export const yalin = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9#+ -]/g, ' ').replace(/\s+/g, ' ').trim();

const INDEKS = new Map<string, TestBilgisi>();
KATALOG.forEach(t => { INDEKS.set(yalin(t.ad), t); t.takma.forEach(a => INDEKS.set(yalin(a), t)); });
export const testBilgisi = (anahtar: string) => KATALOG.find(t => t.anahtar === anahtar);

/** Rapordaki ad katalogdaki bir teste uyuyorsa onu bulur (tam eşleşme, yoksa en uzun içerilen ad). */
export function testBul(ad: string): TestBilgisi | null {
  const y = yalin(ad);
  if (!y) return null;
  const tam = INDEKS.get(y);
  if (tam) return tam;
  let en: [number, TestBilgisi] | null = null;
  for (const [a, t] of INDEKS) {
    if (a.length < 4) continue;
    if (y.includes(a) && (!en || a.length > en[0])) en = [a.length, t];
  }
  return en ? en[1] : null;
}

/** Katalogda olmayan testler için kararlı bir anahtar. */
export const serbestAnahtar = (ad: string) => 'x-' + yalin(ad).replace(/ /g, '-').slice(0, 70);

export type Durum = 'dusuk' | 'normal' | 'yuksek' | 'bilinmiyor';
export function durumHesapla(deger: number | null, alt: number | null | undefined, ust: number | null | undefined): Durum {
  if (deger === null) return 'bilinmiyor';
  if (alt === null || alt === undefined) { if (ust === null || ust === undefined) return 'bilinmiyor'; return deger > ust ? 'yuksek' : 'normal'; }
  if (deger < alt) return 'dusuk';
  if (ust !== null && ust !== undefined && deger > ust) return 'yuksek';
  return 'normal';
}
export const DURUM_ADI: Record<Durum, string> = { dusuk: 'Düşük', normal: 'Normal', yuksek: 'Yüksek', bilinmiyor: '—' };
