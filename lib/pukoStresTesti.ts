/**
 * Akreditasyon ve ÖDR Stres Testi Doğrulama Modülü
 *
 * Kullanıcı Talebine Uygun Ölçüt Bazlı Tespit Kriterleri:
 * 1. ÖDR'ye Alınmamış Ölçüt: Seçili dönemde henüz Özdeğerlendirme Raporu (ÖDR) oluşturulmamış / ÖDR'si boş olan alt ölçütler.
 * 2. Aşamalarda Kanıt Var, ÖDR'de Yok: PUKÖ aşamalarında kanıt yüklenmiş ancak bu kanıt ölçütün ÖDR raporuna aktarılmamış / atıf verilmemiş.
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
}

export interface OdrKayit {
  id?: string;
  alt_olcut_id: number | string;
  icerik?: string | null;
  kanitlar?: any[] | null;
  onay_durumu?: string | null;
  donem_id?: string | null;
}

export interface AltOlcut {
  id: number | string;
  kod: string;
  olcut_adi: string;
}

export interface OdrAlinmamisOlcut {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asama_sayisi: number;
  puko_kanit_sayisi: number;
}

export interface AsamadaVarOdrdeYokKanit {
  alt_olcut_id: number | string;
  kod: string;
  olcut_adi: string;
  puko_asamasi: string;
  kanit_adi: string;
  kanit_url: string;
}

export interface StresTestiSonucu {
  odrAlinmamisOlcutler: OdrAlinmamisOlcut[];
  asamadaVarOdrdeYok: AsamadaVarOdrdeYokKanit[];
  toplamSorun: number;
}

/**
 * HTML etiketlerini ve özel boşluk karakterlerini ayıklayarak metnin anlamsız boş olup olmadığını belirler.
 */
export function isHtmlContentEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const stripped = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length === 0;
}

/**
 * Dosya adındaki işaretleme eki (_isaretli, _annotated), zaman damgası ve uzantıyı temizleyerek temel doküman kimliğini çıkarır.
 */
export function normalizeDocKey(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/_isaretli|_annotated/g, '')
    .replace(/[0-9]{10,}_/g, '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9ğüşıöç]/g, '')
    .trim();
}

/**
 * Ölçüt bazlı PUKÖ - ÖDR Stres Testini çalıştırır.
 */
export function calistirPukoStresTesti(params: {
  altOlcutler: AltOlcut[];
  pukoListesi: PukoKayit[];
  odrListesi: OdrKayit[];
}): StresTestiSonucu {
  const { altOlcutler, pukoListesi, odrListesi } = params;

  const odrMap = new Map<string, OdrKayit>();
  odrListesi.forEach(odr => {
    odrMap.set(String(odr.alt_olcut_id), odr);
  });

  const pukoByOlcut = new Map<string, PukoKayit[]>();
  pukoListesi.forEach(p => {
    const key = String(p.alt_olcut_id);
    if (!pukoByOlcut.has(key)) {
      pukoByOlcut.set(key, []);
    }
    pukoByOlcut.get(key)!.push(p);
  });

  const odrAlinmamisOlcutler: OdrAlinmamisOlcut[] = [];
  const asamadaVarOdrdeYok: AsamadaVarOdrdeYokKanit[] = [];

  altOlcutler.forEach(olcut => {
    const key = String(olcut.id);
    const odr = odrMap.get(key);
    const pukoStages = pukoByOlcut.get(key) || [];

    // 1. ÖDR'ye Alınmamış Ölçüt Kontrolü
    const hasValidOdr = odr && !isHtmlContentEmpty(odr.icerik);
    if (!hasValidOdr) {
      let kanitSayisi = 0;
      let asamaSayisi = 0;
      pukoStages.forEach(p => {
        if (!isHtmlContentEmpty(p.aciklama) || (p.kanit_dosyalari && p.kanit_dosyalari.length > 0)) {
          asamaSayisi++;
        }
        if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
          kanitSayisi += p.kanit_dosyalari.length;
        }
      });

      odrAlinmamisOlcutler.push({
        alt_olcut_id: olcut.id,
        kod: olcut.kod,
        olcut_adi: olcut.olcut_adi,
        puko_asama_sayisi: asamaSayisi,
        puko_kanit_sayisi: kanitSayisi,
      });
    }

    // 2. Aşamalarda Kanıt Var, ÖDR'de Yok Kontrolü
    const odrKanitlar = Array.isArray(odr?.kanitlar) ? odr.kanitlar : [];
    const odrIcerik = odr?.icerik || '';

    pukoStages.forEach(p => {
      if (p.kanit_dosyalari && Array.isArray(p.kanit_dosyalari)) {
        p.kanit_dosyalari.forEach(k => {
          const rawUrl = (k.url || k.dosya_url || k.storagePath || '').trim();
          const cleanName = (k.name || k.dosya_adi || '').trim();
          if (!rawUrl && !cleanName) return;

          // ÖDR kanıt listesinde veya içeriğinde var mı?
          const normCleanName = normalizeDocKey(cleanName);
          const inOdrList = odrKanitlar.some((ok: any) => {
            const okUrl = (ok.url || ok.dosya_url || ok.storagePath || '').trim();
            const okName = (ok.name || ok.dosya_adi || '').trim();
            if (rawUrl && okUrl && (okUrl === rawUrl || okUrl.includes(rawUrl) || rawUrl.includes(okUrl))) return true;
            if (cleanName && okName && okName.toLowerCase() === cleanName.toLowerCase()) return true;
            if (normCleanName && normalizeDocKey(okName) === normCleanName) return true;
            return false;
          });

          // ÖDR HTML içeriğinde doğrudan URL, dosya adı veya kanıt etiketi/evidence_id var mı?
          const inOdrHtml = Boolean(
            (rawUrl && odrIcerik.includes(rawUrl)) ||
            (cleanName && odrIcerik.includes(cleanName)) ||
            (normCleanName && normalizeDocKey(odrIcerik).includes(normCleanName)) ||
            (k.evidence_id && odrIcerik.includes(k.evidence_id))
          );

          if (!inOdrList && !inOdrHtml) {
            asamadaVarOdrdeYok.push({
              alt_olcut_id: olcut.id,
              kod: olcut.kod,
              olcut_adi: olcut.olcut_adi,
              puko_asamasi: p.puko_asamasi,
              kanit_adi: cleanName || rawUrl.split('/').pop() || 'Kanıt Dosyası',
              kanit_url: rawUrl,
            });
          }
        });
      }
    });
  });

  return {
    odrAlinmamisOlcutler,
    asamadaVarOdrdeYok,
    toplamSorun: odrAlinmamisOlcutler.length + asamadaVarOdrdeYok.length,
  };
}

/**
 * Tekil PUKÖ aşaması düzenlenirken geri bildirim verir (PhaseClient uyumluluğu için korunmuştur).
 */
export function degerlendirTekAsama(params: {
  altOlcutId: number | string;
  kod: string;
  olcutAdi: string;
  pukoAsamasi: string;
  aciklama: string | null | undefined;
  kanitDosyalari: KanitDosyasi[] | null | undefined;
}): {
  isEmpty: boolean;
  isTextWithoutEvidence: boolean;
  uncitedEvidences: Array<{ kanit_no: string | number; dosya_adi: string }>;
} {
  const { aciklama, kanitDosyalari } = params;
  const emptyText = isHtmlContentEmpty(aciklama);
  const evidenceList = Array.isArray(kanitDosyalari) ? kanitDosyalari : [];
  const hasEvidence = evidenceList.length > 0;

  if (emptyText && !hasEvidence) {
    return { isEmpty: true, isTextWithoutEvidence: false, uncitedEvidences: [] };
  }

  if (!emptyText && !hasEvidence) {
    return { isEmpty: false, isTextWithoutEvidence: true, uncitedEvidences: [] };
  }

  const html = aciklama || '';
  const uncited: Array<{ kanit_no: string | number; dosya_adi: string }> = [];

  evidenceList.forEach((e, idx) => {
    const n = e.evidence_no ?? (idx + 1);
    const fileName = e.name || e.dosya_adi || `Kanıt ${n}`;
    const url = e.url || '';
    const hasCitation = (url && html.includes(url)) || html.includes(`[Kanıt ${n}]`) || html.includes(`[Evidence ${n}]`);
    if (!hasCitation) {
      uncited.push({ kanit_no: n, dosya_adi: fileName });
    }
  });

  return {
    isEmpty: false,
    isTextWithoutEvidence: false,
    uncitedEvidences: uncited,
  };
}
