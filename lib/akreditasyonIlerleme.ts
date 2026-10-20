/**
 * Akreditasyon Hazırlık Kokpiti İlerleme ve Tamamlanma Hesaplama Modülü
 *
 * Kural:
 * Bir alt ölçüt, seçili dönemde 5 PUKÖ aşamasının her biri için kaydı varsa
 * ('planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk')
 * VE her bir kaydın durum alanı 'Onaylandı' ise tamamlanmış kabul edilir.
 * ÖDR metni bu hesaba dahil DEĞİLDİR; sadece PUKÖ onaylarına dayanır.
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
 * Verilen PUKÖ kayıtları ve kapsamdaki alt ölçütlere göre tamamlanma oranlarını hesaplar.
 */
export function hesaplaAkreditasyonIlerleme(params: {
  kapsamdakiOlcutler: AltOlcutBasit[];
  pukoKayitlari: PukoDurumKayit[];
  kapsamTuru: 'kurumsal' | 'koordinator' | 'birim' | 'beklemede';
  ekBilgi?: string;
}): IlerlemeSonucu {
  const { kapsamdakiOlcutler, pukoKayitlari, kapsamTuru, ekBilgi } = params;

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

  // 1. Ölçüt bazında onaylı aşamaları topla
  // Map: alt_olcut_id -> Set<puko_asamasi> (Sadece durum === 'Onaylandı' olanlar)
  const onayliAsamalarMap = new Map<string, Set<string>>();

  pukoKayitlari.forEach(p => {
    const rawDurum = (p.durum || '').trim();
    // 'Onaylandı' durum kontrolü (büyük/küçük harf veya Türkçe karakter toleranslı)
    const isOnaylandi = rawDurum.toLocaleLowerCase('tr') === 'onaylandı' || rawDurum.toLowerCase() === 'onaylandi';

    if (isOnaylandi && p.puko_asamasi) {
      const key = String(p.alt_olcut_id);
      if (!onayliAsamalarMap.has(key)) {
        onayliAsamalarMap.set(key, new Set());
      }
      onayliAsamalarMap.get(key)!.add(p.puko_asamasi.trim().toLowerCase());
    }
  });

  // 2. Kapsamdaki alt ölçütlerin tamamlanıp tamamlanmadığını denetle
  const tamamlananSet = new Set<number | string>();

  kapsamdakiOlcutler.forEach(olcut => {
    const onayliAsamalar = onayliAsamalarMap.get(String(olcut.id));
    if (!onayliAsamalar) return;

    // 5 aşamanın ('planlama', 'uygulama', 'kontrol', 'onlem', 'olgunluk') tamamı onaylı mı?
    const hepsiOnayli = ZORUNLU_PUKO_ASAMALARI.every(asama => onayliAsamalar.has(asama));
    if (hepsiOnayli) {
      tamamlananSet.add(olcut.id);
    }
  });

  const toplamOlcut = kapsamdakiOlcutler.length;
  const tamamlananOlcut = tamamlananSet.size;
  const genelYuzde = toplamOlcut > 0 ? parseFloat(((tamamlananOlcut / toplamOlcut) * 100).toFixed(1)) : 0;

  // 3. A-E Başlık Dağılımını Hesapla
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

  // 4. Kapsam Etiketi
  let kapsamEtiketi = 'Kurumsal Kapsam (Tüm Ölçütler)';
  if (kapsamTuru === 'koordinator') {
    kapsamEtiketi = ekBilgi ? `Atanan Başlık Kapsamı: ${ekBilgi}` : 'Atanan Başlık Kapsamı';
  } else if (kapsamTuru === 'birim') {
    kapsamEtiketi = `Atanan Ölçütleriniz (${toplamOlcut} Ölçüt)`;
  } else if (kapsamTuru === 'beklemede') {
    kapsamEtiketi = 'Atama Yapılmamış (Beklemede)';
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
