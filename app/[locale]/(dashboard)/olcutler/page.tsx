'use client';
// DEFINITIVE FIX: 2026-05-09 19:29 - Role & UUID Alignment Fix

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { Loader2, ChevronRight, AlertCircle, CheckCircle2, TrendingUp, Award, Layers } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';
import { getAssignedLetter } from '@/lib/utils';
import { hesaplaAkreditasyonIlerleme, IlerlemeSonucu } from '@/lib/akreditasyonIlerleme';

export default function OlcutlerPage() {
  const t = useTranslations('Criteria');
  const tKokpit = useTranslations('Cockpit');
  const { selectedPeriod } = usePeriod();
  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [anaBasliklar, setAnaBasliklar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [kokpitData, setKokpitData] = useState<IlerlemeSonucu | null>(null);
  const locale = useLocale();

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) return; 
      try {
        setIsLoading(true);
        setErrorStatus(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Profil ve Rolü Al
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = (profile?.rol || '').toLowerCase().trim();
        setUserRole(profile?.rol || '');
        const isAdmin = role.includes('yonetici') || role.includes('admin') || role.includes('yönetici') || role.includes('gozlemci') || role.includes('gözlemci');

        // 2. Koordinatörlük Tablosunu Kontrol Et (Rolden bağımsız - kesin çözüm)
        const { data: coordData } = await supabase
          .from('baslik_koordinatorleri')
          .select('baslik')
          .eq('kullanici_id', user.id);

        const hasCoordinatorRecord = coordData && coordData.length > 0;

        let finalOlcutler: any[] = [];

        if (isAdmin) {
          const { data } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
          finalOlcutler = data || [];
        } else if (hasCoordinatorRecord) {
          // KOORDİNATÖR AKIŞI (Rol 'BirimSorumlusu' olsa bile buraya girecek)
          const assignedLetter = getAssignedLetter(coordData[0]?.baslik);

          if (!assignedLetter) {
            // Eşleşme yoksa bile boş sayfa gelmesin, hata verelim
            setErrorStatus(`HATA: '${coordData[0].baslik}' başlığı sistem harfleriyle (A-E) eşleşmedi!`);
          } else {
            const { data: allAlt } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
            if (allAlt) {
              finalOlcutler = allAlt.filter(o => o.kod && o.kod.startsWith(assignedLetter));
              setOpenGroups({ [assignedLetter]: true });
            }
          }
        } else {
          // BİRİM KULLANICISI AKIŞI
          const { data } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcutler(*)')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);
          if (data) {
            finalOlcutler = data.map((i: any) => i.alt_olcutler).filter(Boolean);
          }
        }

        setOlcutler(finalOlcutler);

        // 3. PUKÖ Verilerini Çek ve Akreditasyon Hazırlık Kokpitini Hesapla
        let calculatedKapsamTuru: 'kurumsal' | 'koordinator' | 'birim' | 'beklemede' = 'beklemede';
        let calculatedEkBilgi: string | undefined = undefined;

        if (isAdmin) {
          calculatedKapsamTuru = 'kurumsal';
        } else if (hasCoordinatorRecord) {
          calculatedKapsamTuru = 'koordinator';
          calculatedEkBilgi = coordData?.[0]?.baslik;
        } else if (finalOlcutler.length > 0) {
          calculatedKapsamTuru = 'birim';
        } else {
          calculatedKapsamTuru = 'beklemede';
        }

        if (calculatedKapsamTuru !== 'beklemede' && finalOlcutler.length > 0) {
          const [pukoRes, odrRes] = await Promise.all([
            supabase
              .from('puko_degerlendirmeleri')
              .select('alt_olcut_id, puko_asamasi, durum, donem_id')
              .eq('donem_id', selectedPeriod.id),
            supabase
              .from('ozdegerlendirme_raporlari')
              .select('alt_olcut_id, onay_durumu, donem_id')
              .eq('donem_id', selectedPeriod.id),
          ]);

          const sonuc = hesaplaAkreditasyonIlerleme({
            kapsamdakiOlcutler: finalOlcutler,
            pukoKayitlari: pukoRes.data || [],
            odrKayitlari: odrRes.data || [],
            kapsamTuru: calculatedKapsamTuru,
            ekBilgi: calculatedEkBilgi,
          });
          setKokpitData(sonuc);
        } else {
          setKokpitData(null);
        }

        if (finalOlcutler.length > 0) {
          const assignedLetters = Array.from(new Set(finalOlcutler.map((o: any) => o.kod?.charAt(0)).filter(Boolean)));
          if (assignedLetters.length > 0) {
            const { data: baslikData } = await supabase.from('ana_basliklar').select('*').in('kod', assignedLetters);
            if (baslikData) setAnaBasliklar(baslikData);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-3xl font-black text-slate-900 mb-8 border-b pb-4">{t('title')}</h2>

      {/* 1. Aşama: Akreditasyon Hazırlık Kokpiti */}
      {kokpitData && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm mb-8 transition-all hover:shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{tKokpit('title')}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tKokpit('active_period')}: <span className="font-bold text-slate-700">{selectedPeriod?.donem_adi}</span> • {kokpitData.kapsamEtiketi}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">{tKokpit('completed_criteria')}</span>
                <span className="text-lg font-black text-slate-800">
                  {kokpitData.tamamlananOlcut} <span className="text-slate-400 font-normal text-sm">/ {kokpitData.toplamOlcut} {tKokpit('criteria_unit')}</span>
                </span>
              </div>
              <div className="h-10 w-px bg-slate-200"></div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">{tKokpit('general_readiness')}</span>
                <span className="text-2xl font-black text-blue-600">
                  %{kokpitData.genelYuzde.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Genel İlerleme Çubuğu */}
          <div className="mt-6">
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, kokpitData.genelYuzde))}%` }}
              />
            </div>
          </div>

          {/* A-E Başlık Dağılımı Kartları */}
          {kokpitData.basliklar.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
              {kokpitData.basliklar.map(b => (
                <div key={b.harf} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                      {b.harf}
                    </span>
                    <span className="text-xs font-black text-slate-700">
                      %{b.yuzde.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600 truncate mb-2" title={b.ad}>
                    {b.ad}
                  </p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, b.yuzde))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold mt-2">
                    {b.tamamlanan}/{b.toplam} Ölçüt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {errorStatus && (
        <div className="mb-8 p-6 bg-red-600 text-white rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-8 h-8 flex-shrink-0" />
          <h3 className="font-bold">{errorStatus}</h3>
        </div>
      )}

      {userRole === 'Beklemede' ? (
        <div className="p-12 bg-indigo-50 border border-indigo-200 rounded-3xl text-center max-w-2xl mx-auto shadow-sm">
          <p className="text-indigo-900 font-bold text-lg">Hesabınız Başarıyla Oluşturuldu</p>
          <p className="text-slate-600 mt-2 text-sm font-medium">Hesabınız şu an bekleme durumundadır. Bir yönetici size bir ölçüt atadığında, sistemdeki birim sorumlusu yetkileriniz otomatik olarak aktifleşecektir.</p>
        </div>
      ) : (
        olcutler.length === 0 && !errorStatus && (
          <div className="p-10 bg-amber-50 border border-amber-200 rounded-3xl text-center">
            <p className="text-amber-800 font-bold text-lg italic">Şu an için atanmış bir ölçütünüz bulunmuyor.</p>
          </div>
        )
      )}

      <div className="space-y-4">
        {Object.entries(
          olcutler.reduce((acc, o) => {
            const k = o.kod ? o.kod.split('.')[0] : 'Diğer';
            if (!acc[k]) acc[k] = [];
            acc[k].push(o);
            return acc;
          }, {} as Record<string, any[]>)
        ).sort().map(([harf, items_raw]) => {
          const items = items_raw as any[];
          const b = anaBasliklar.find(x => x.kod === harf);
          const title = getLocalizedField(b, 'baslik_adi', locale) || harf;
          return (
            <div key={harf} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <button onClick={() => toggleGroup(harf)} className="w-full p-6 flex justify-between items-center hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold">{harf}</div>
                  <span className="font-bold text-slate-800">{title}</span>
                </div>
                <ChevronRight className={`transition-all ${openGroups[harf] ? 'rotate-90' : ''}`} />
              </button>
              {openGroups[harf] && (
                <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t">
                  {items.map((o: any) => (
                    <Link key={o.id} href={`/olcutler/${o.id}/uygulama`} className="p-4 bg-white border rounded-xl hover:border-indigo-500 shadow-sm transition-all">
                      <p className="text-sm font-bold text-slate-700">{o.kod} {getLocalizedField(o, 'olcut_adi', locale)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
