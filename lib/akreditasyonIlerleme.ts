/**
 * Akreditasyon Hazırlık Kokpiti İlerleme ve Tamamlanma Hesaplama Modülü
 *
 * Kural:
 * Bir alt ölçüt şu iki şarttan biri sağlandığında TAMAMLANMIŞ kabul edilir:
 * 1. Seçili dönemde Özdeğerlendirme Raporu (ÖDR) onaylanmışsa (onay_durumu = 'onaylandi'), VEYA
 * 2. Seçili dönemde 5 PUKÖ aşamasının her biri ('planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk') 'Onaylandı' durumundaysa.
 */

export const ZORUNLU_PUKO_ASAMALARI = ['planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk'] as const;

export interface AltOlcutBasit {
  id: number | string;
  kod: string;
  olcut_adi?: string;
  ana_baslik_id?: number | string;
}

export interface PukoDurumKayit {
  alt_olcut_id: number | string;
  puko_asamasi: string;
  durum?: string | null;
  donem_id?: string | null;
}

export interface OdrDurumKayit {
  alt_olcut_id: number | string;
  onay_durumu?: string | null;
  donem_id?: string | null;
}

export interface BaslikIlerleme {
  harf: string;
  ad: string;
  toplam: number;
  tamamlanan: number;
  yuzde: number;
}

export interface IlerlemeSonucu {
  toplamOlcut: number;
  tamamlananOlcut: number;
  genelYuzde: number;
  basliklar: BaslikIlerleme[];
  kapsamEtiketi: string;
  tamamlananOlcutIdleri: Set<number | string>;
}

const BASLIK_ADLARI: Record<string, string> = {
  A: 'Liderlik, Yönetişim ve Kalite',
  B: 'Eğitim ve Öğretim',
  C: 'Araştırma ve Geliştirme',
  D: 'Toplumsal Katkı',
  E: 'Yönetim Sistemi',
};

/**
 * Verilen PUKÖ ve ÖDR kayıtları ile kapsamdaki alt ölçütlere göre tamamlanma oranlarını hesaplar.
 */
export function hesaplaAkreditasyonIlerleme(params: {
  kapsamdakiOlcutler: AltOlcutBasit[];
  pukoKayitlari?: PukoDurumKayit[];
  odrKayitlari?: OdrDurumKayit[];
  kapsamTuru: 'kurumsal' | 'koordinator' | 'birim' | 'beklemede';
  ekBilgi?: string;
}): IlerlemeSonucu {
  const { kapsamdakiOlcutler, pukoKayitlari = [], odrKayitlari = [], kapsamTuru, ekBilgi } = params;

  if (!kapsamdakiOlcutler || kapsamdakiOlcutler.length === 0) {
    return {
      toplamOlcut: 0,
      tamamlananOlcut: 0,
      genelYuzde: 0,
      basliklar: [],
      kapsamEtiketi: kapsamTuru === 'beklemede' ? 'Beklemede (Atama Yok)' : 'Kapsamda Ölçüt Bulunmuyor',
      tamamlananOlcutIdleri: new Set(),
    };
  }

  // 1. ÖDR Onaylı Ölçütleri Topla
  const onayliOdrSet = new Set<string>();
  odrKayitlari.forEach(odr => {
    const rawDurum = (odr.onay_durumu || '').trim().toLowerCase();
    if (rawDurum === 'onaylandi' || rawDurum === 'onaylandı') {
      onayliOdrSet.add(String(odr.alt_olcut_id));
    }
  });

  // 2. Ölçüt bazında onaylı PUKÖ aşamalarını topla
  const onayliPukoAsamalarMap = new Map<string, Set<string>>();
  pukoKayitlari.forEach(p => {
    const rawDurum = (p.durum || '').trim();
    const isOnaylandi = rawDurum.toLocaleLowerCase('tr') === 'onaylandı' || rawDurum.toLowerCase() === 'onaylandi';

    if (isOnaylandi && p.puko_asamasi) {
      const key = String(p.alt_olcut_id);
      if (!onayliPukoAsamalarMap.has(key)) {
        onayliPukoAsamalarMap.set(key, new Set());
      }
      onayliPukoAsamalarMap.get(key)!.add(p.puko_asamasi.trim().toLowerCase());
    }
  });

  // 3. Kapsamdaki alt ölçütlerin tamamlanıp tamamlanmadığını denetle
  const tamamlananSet = new Set<number | string>();

  kapsamdakiOlcutler.forEach(olcut => {
    const key = String(olcut.id);

    // Kriter A: ÖDR Onaylandı mı?
    if (onayliOdrSet.has(key)) {
      tamamlananSet.add(olcut.id);
      return;
    }

    // Kriter B: 5 PUKÖ aşamasının hepsi onaylı mı?
    const onayliAsamalar = onayliPukoAsamalarMap.get(key);
    if (onayliAsamalar) {
      const hepsiOnayli = ZORUNLU_PUKO_ASAMALARI.every(asama => onayliAsamalar.has(asama));
      if (hepsiOnayli) {
        tamamlananSet.add(olcut.id);
      }
    }
  });

  const toplamOlcut = kapsamdakiOlcutler.length;
  const tamamlananOlcut = tamamlananSet.size;
  const genelYuzde = toplamOlcut > 0 ? parseFloat(((tamamlananOlcut / toplamOlcut) * 100).toFixed(1)) : 0;

  // 4. A-E Başlık Dağılımını Hesapla
  const baslikMap: Record<string, { toplam: number; tamamlanan: number }> = {
    A: { toplam: 0, tamamlanan: 0 },
    B: { toplam: 0, tamamlanan: 0 },
    C: { toplam: 0, tamamlanan: 0 },
    D: { toplam: 0, tamamlanan: 0 },
    E: { toplam: 0, tamamlanan: 0 },
  };

  kapsamdakiOlcutler.forEach(olcut => {
    const harf = olcut.kod ? olcut.kod.trim().charAt(0).toUpperCase() : '';
    if (baslikMap[harf]) {
      baslikMap[harf].toplam += 1;
      if (tamamlananSet.has(olcut.id)) {
        baslikMap[harf].tamamlanan += 1;
      }
    }
  });

  const basliklar: BaslikIlerleme[] = Object.keys(baslikMap)
    .filter(harf => baslikMap[harf].toplam > 0)
    .map(harf => {
      const data = baslikMap[harf];
      const yuzde = data.toplam > 0 ? parseFloat(((data.tamamlanan / data.toplam) * 100).toFixed(1)) : 0;
      return {
        harf,
        ad: BASLIK_ADLARI[harf] || `Başlık ${harf}`,
        toplam: data.toplam,
        tamamlanan: data.tamamlanan,
        yuzde,
      };
    });

  let kapsamEtiketi = '';
  switch (kapsamTuru) {
    case 'kurumsal':
      kapsamEtiketi = 'Kurum Geneli (Tüm Ölçütler)';
      break;
    case 'koordinator':
      kapsamEtiketi = `Başlık Koordinatörlüğü (${ekBilgi || 'Atanan Başlık'})`;
      break;
    case 'birim':
      kapsamEtiketi = `Birim Kapsamı (${toplamOlcut} Ölçüt)`;
      break;
    case 'beklemede':
    default:
      kapsamEtiketi = 'Atama Bekleniyor';
      break;
  }

  return {
    toplamOlcut,
    tamamlananOlcut,
    genelYuzde,
    basliklar,
    kapsamEtiketi,
    tamamlananOlcutIdleri: tamamlananSet,
  };
}
