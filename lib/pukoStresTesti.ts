/**
 * PUKÖ Akreditasyon Stres Testi Doğrulama Modülü
 * ABYS Kalite Standartları
 *
 * Tespit Kriterleri:
 * 1. Boş PUKÖ Aşaması: Kayıt yok veya (açıklama anlamsız boş VE kanıt dizisi yok/boş).
 * 2. Metin Var, Kanıt Yok: Açıklama anlamsız boş değil VE kanıt dizisi yok/boş.
 * 3. Kanıt Var, Metinde Atıf Eksik: Kanıt dizisindeki dosyanın data-evidence-id,
 *    temizlenmiş URL veya [Kanıt N] / [Evidence N] karşılığı metinde yer almıyor.
 */

export const PUKO_ASAMALARI = ['planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk'] as const;
export type PukoAsamasi = typeof PUKO_ASAMALARI[number];

export interface KanitDosyasi {
  name?: string;
  url?: string;
  annotated_url?: string;
  size?: number;
  evidence_no?: number | string;
  evidence_id?: string;
  id?: string;
  [key: string]: any;
}

export interface PukoKayit {
  id?: string;
  alt_olcut_id: number | string;
  puko_asamasi: string;
  aciklama?: string | null;
  kanit_dosyalari?: KanitDosyasi[] | null;
  durum?: string | null;
  donem_id?: string | null;
  alt_olcutler?: {
    id?: number | string;
    kod?: string;
    olcut_adi?: string;
  } | null;
}

export interface AltOlcut {
  id: number | string;
  kod: string;
  olcut_adi: string;
}

export interface StresTestiBosAsama {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
}

export interface StresTestiMetinVarKanitYok {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
}

export interface StresTestiKanitVarAtifEksik {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
  kanit_no: string | number;
  dosya_adi: string;
}

export interface StresTestiSonucu {
  bosAsamalar: StresTestiBosAsama[];
  metinVarKanitYok: StresTestiMetinVarKanitYok[];
  kanitVarAtifEksik: StresTestiKanitVarAtifEksik[];
  toplamSorun: number;
}

/**
 * HTML etiketlerini ve özel boşluk karakterlerini ayıklayarak metnin anlamsız boş olup olmadığını belirler.
 */
export function isHtmlContentEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const cleaned = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .trim();
  return cleaned.length === 0;
}

/**
 * Kanıt dizisinin geçerli ve en az 1 elemana sahip olup olmadığını denetler.
 */
export function hasEvidenceArray(kanitlar: any): boolean {
  return Array.isArray(kanitlar) && kanitlar.length > 0;
}

/**
 * Regexp için özel karakterleri kaçırır.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * URL'den query parametreleri ve hash kısımlarını temizler.
 */
function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  return url.split('?')[0].split('#')[0].trim();
}

/**
 * Tek bir kanıtın HTML açıklama metni içerisinde usulüne uygun ve doğrulanabilir
 * bir atıf öğesi (<a> etiketi veya [Kanıt N] etiketi) barındırıp barındırmadığını denetler.
 * Yanlış pozitifleri (metin içi tesadüfi kelime/ID eşleşmelerini) engellemek için
 * serbest substring arama kesinlikle yapılmaz.
 */
export function isEvidenceCitedInHtml(html: string | null | undefined, kanit: KanitDosyasi): boolean {
  if (!html || !kanit) return false;

  // 1. data-evidence-id niteliğine sahip gerçek <a> etiketi eşleşmesi
  const evidenceId = kanit.evidence_id || kanit.id;
  if (evidenceId && typeof evidenceId === 'string' && evidenceId.trim() !== '') {
    const trimmedId = evidenceId.trim();
    const idRegex = new RegExp(`<a\\b[^>]*\\bdata-evidence-id=["']${escapeRegExp(trimmedId)}["'][^>]*>`, 'i');
    if (idRegex.test(html)) {
      return true;
    }
  }

  // 2. data-evidence-no niteliği veya doğrulanmış [Kanıt N] / [Evidence N] etiketi
  if (kanit.evidence_no !== undefined && kanit.evidence_no !== null) {
    const n = String(kanit.evidence_no).trim();
    if (n !== '') {
      // <a data-evidence-no="N"> eşleşmesi
      const noAttrRegex = new RegExp(`<a\\b[^>]*\\bdata-evidence-no=["']${escapeRegExp(n)}["'][^>]*>`, 'i');
      if (noAttrRegex.test(html)) {
        return true;
      }

      // Tam köşeli parantezli atıf deseni: [Kanıt N], [Evidence N], [Kanit N]
      const bracketRegex = new RegExp(`\\[\\s*(?:Kanıt|Kanit|Evidence)\\s*${escapeRegExp(n)}\\s*\\]`, 'i');
      if (bracketRegex.test(html)) {
        return true;
      }
    }
  }

  // 3. Kanıt dosyasının URL'sine bağlanan gerçek <a href="..."> öğesi eşleşmesi
  const testUrls: string[] = [];
  if (kanit.url) testUrls.push(normalizeUrl(kanit.url));
  if (kanit.annotated_url) testUrls.push(normalizeUrl(kanit.annotated_url));

  for (const rawUrl of testUrls) {
    if (rawUrl && rawUrl.length > 5) {
      const candidates = [
        rawUrl,
        encodeURI(rawUrl),
        decodeURIComponent(rawUrl)
      ];
      for (const cand of candidates) {
        const hrefRegex = new RegExp(`<a\\b[^>]*\\bhref=["']${escapeRegExp(cand)}(?:[?#][^"']*)?["'][^>]*>`, 'i');
        if (hrefRegex.test(html)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Tek bir aşama için anlık stres testi değerlendirmesi (PhaseClient kayıt sonrası bildirim için).
 */
export function degerlendirTekAsama(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  pukoAsamasi: string;
  aciklama?: string | null;
  kanitDosyalari?: KanitDosyasi[] | null;
}): {
  isEmpty: boolean;
  isTextWithoutEvidence: boolean;
  uncitedEvidences: StresTestiKanitVarAtifEksik[];
} {
  const { altOlcutId, kod, olcutAdi, pukoAsamasi, aciklama, kanitDosyalari } = params;
  const textEmpty = isHtmlContentEmpty(aciklama);
  const hasEvidences = hasEvidenceArray(kanitDosyalari);

  // 1. Boş aşama
  if (textEmpty && !hasEvidences) {
    return { isEmpty: true, isTextWithoutEvidence: false, uncitedEvidences: [] };
  }

  // 2. Metin var, kanıt yok
  if (!textEmpty && !hasEvidences) {
    return { isEmpty: false, isTextWithoutEvidence: true, uncitedEvidences: [] };
  }

  // 3. Kanıt var, atıf denetimi
  const uncitedEvidences: StresTestiKanitVarAtifEksik[] = [];
  if (hasEvidences && kanitDosyalari) {
    kanitDosyalari.forEach((ev, idx) => {
      const cited = isEvidenceCitedInHtml(aciklama, ev);
      if (!cited) {
        uncitedEvidences.push({
          alt_olcut_id: altOlcutId,
          kod,
          olcut_adi: olcutAdi,
          puko_asamasi: pukoAsamasi,
          kanit_no: ev.evidence_no ?? (idx + 1),
          dosya_adi: ev.name || `Kanıt ${idx + 1}`,
        });
      }
    });
  }

  return {
    isEmpty: false,
    isTextWithoutEvidence: false,
    uncitedEvidences,
  };
}

/**
 * Seçili döneme ait tüm alt ölçüt ve PUKÖ aşamalarını tarayan kapsamlı stres testi fonksiyonu.
 */
export function calistirPukoStresTesti(
  pukoKayitlari: PukoKayit[],
  altOlcutler: AltOlcut[]
): StresTestiSonucu {
  const bosAsamalar: StresTestiBosAsama[] = [];
  const metinVarKanitYok: StresTestiMetinVarKanitYok[] = [];
  const kanitVarAtifEksik: StresTestiKanitVarAtifEksik[] = [];

  // Hızlı erişim için map oluştur: key = `${alt_olcut_id}_${puko_asamasi}`
  const pukoMap = new Map<string, PukoKayit>();
  pukoKayitlari.forEach(p => {
    const key = `${p.alt_olcut_id}_${p.puko_asamasi}`;
    pukoMap.set(key, p);
  });

  // Her alt ölçüt ve 5 PUKÖ aşaması taranır
  altOlcutler.forEach(olcut => {
    PUKO_ASAMALARI.forEach(asama => {
      const key = `${olcut.id}_${asama}`;
      const record = pukoMap.get(key);

      // Kayıt yoksa doğrudan boş aşama sayılır
      if (!record) {
        bosAsamalar.push({
          alt_olcut_id: olcut.id,
          kod: olcut.kod,
          olcut_adi: olcut.olcut_adi,
          puko_asamasi: asama,
        });
        return;
      }

      const textEmpty = isHtmlContentEmpty(record.aciklama);
      const hasEvidences = hasEvidenceArray(record.kanit_dosyalari);

      // 1. Kayıt var ama açıklama boş ve kanıt yok
      if (textEmpty && !hasEvidences) {
        bosAsamalar.push({
          alt_olcut_id: olcut.id,
          kod: olcut.kod,
          olcut_adi: olcut.olcut_adi,
          puko_asamasi: asama,
        });
        return;
      }

      // 2. Metin var, kanıt yok
      if (!textEmpty && !hasEvidences) {
        metinVarKanitYok.push({
          alt_olcut_id: olcut.id,
          kod: olcut.kod,
          olcut_adi: olcut.olcut_adi,
          puko_asamasi: asama,
        });
        return;
      }

      // 3. Kanıt var, atıf eksik kontrolü
      if (hasEvidences && record.kanit_dosyalari) {
        record.kanit_dosyalari.forEach((ev, idx) => {
          const cited = isEvidenceCitedInHtml(record.aciklama, ev);
          if (!cited) {
            kanitVarAtifEksik.push({
              alt_olcut_id: olcut.id,
              kod: olcut.kod,
              olcut_adi: olcut.olcut_adi,
              puko_asamasi: asama,
              kanit_no: ev.evidence_no ?? (idx + 1),
              dosya_adi: ev.name || `Kanıt ${idx + 1}`,
            });
          }
        });
      }
    });
  });

  return {
    bosAsamalar,
    metinVarKanitYok,
    kanitVarAtifEksik,
    toplamSorun: bosAsamalar.length + metinVarKanitYok.length + kanitVarAtifEksik.length,
  };
}
