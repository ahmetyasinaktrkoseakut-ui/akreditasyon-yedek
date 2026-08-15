'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Plus, Info, Save, Link as LinkIcon, Settings, CalendarDays, ExternalLink, Trash2, Pencil, Eye } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { logAction } from '@/lib/logger';
import StepPanel from '@/components/StepPanel';
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor';
import { getLocalizedField } from '@/lib/i18n-utils';
import { validateFileSize, getAssignedLetter } from '@/lib/utils';
import { usePeriod } from '@/contexts/PeriodContext';
import EvidenceAnnotatorModal from '@/components/EvidenceAnnotatorModal';
import { useRef } from 'react';

interface Eylem {
  id?: number;
  iyilestirme_alani: string;
  bulgular: string;
  eylem_faaliyet: string;
  sorumlu: string;
  takvim: string;
  basari_gostergesi: string;
  izleme_durumu: string;
  riskler: string;
}

interface PhaseClientProps {
  params: Promise<{ id: string }>;
  phaseId: string;
  phaseTitle: string;
  showEylemPlanTablosu?: boolean;
}

export default function PhaseClient({ params, phaseId, phaseTitle, showEylemPlanTablosu = false }: PhaseClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  const [aciklama, setAciklama] = useState('');
  const [riskAnalizi, setRiskAnalizi] = useState('');
  const [eylemler, setEylemler] = useState<Eylem[]>([]);
  const [dokumanlar, setDokumanlar] = useState<any[]>([]); // Array of { name: string, url: string, size?: number }
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [ustBirimOnerileri, setUstBirimOnerileri] = useState<any[]>([]);
  const [deletedDocs, setDeletedDocs] = useState<any[]>([]); // To hold docs that need physical deletion
  const t = useTranslations('Phase');
  const tStepPanel = useTranslations('StepPanel');
  const locale = useLocale();
  const router = useRouter();
  const { selectedPeriod } = usePeriod();
  
  // Onay / Ret Sistematiği
  const [pukoId, setPukoId] = useState<string | null>(null);
  const [onayDurumu, setOnayDurumu] = useState<string>('');

  // Rich Text Editor Ref for Cursor Position Evidence Tag Insertion
  const editorRef = useRef<RichTextEditorRef>(null);

  // Evidence Annotator Modal State
  const [annotatorModalOpen, setAnnotatorModalOpen] = useState(false);
  const [annotatorReadOnly, setAnnotatorReadOnly] = useState(false);
  const [selectedDocForAnnotation, setSelectedDocForAnnotation] = useState<{ doc: any; index: number } | null>(null);

  const handleInsertEvidenceAtCursor = (doc: any, idx: number) => {
    const kanitNo = idx + 1;
    const tagHtml = `<a href="${doc.url}" target="_blank" rel="noopener noreferrer" style="color: #ea580c; font-weight: bold; text-decoration: underline; margin: 0 4px;">[Kanıt ${kanitNo}]</a>&nbsp;`;
    if (editorRef.current) {
      editorRef.current.insertContent(tagHtml);
    }
  };

  const handleOpenAnnotator = (index: number, readOnly: boolean = false) => {
    setSelectedDocForAnnotation({ doc: dokumanlar[index], index });
    setAnnotatorReadOnly(readOnly);
    setAnnotatorModalOpen(true);
  };

  const handleSaveAnnotatedDoc = (updatedDoc: any, oldUrlToDelete?: string) => {
    if (selectedDocForAnnotation !== null) {
      const newDocs = [...dokumanlar];
      newDocs[selectedDocForAnnotation.index] = updatedDoc;
      setDokumanlar(newDocs);

      if (oldUrlToDelete) {
        setDeletedDocs(prev => [...prev, { url: oldUrlToDelete }]);
      }
    }
  };

  const fetchData = async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        const isAdminOrObserver = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin') || role.includes('gözlemci') || role.includes('gozlemci');
        
        if (isAdminOrObserver || selectedPeriod?.is_active === false || selectedPeriod?.is_sealed === true) {
          setIsReadOnly(true);
        }

        if (!isAdminOrObserver) {
          const { count: assignmentCount } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('alt_olcut_id', resolvedParams.id);

          let isAuthorized = (assignmentCount || 0) > 0;

          if (!isAuthorized) {
            const { data: currentOlcut } = await supabase.from('alt_olcutler').select('kod').eq('id', resolvedParams.id).maybeSingle();
            if (currentOlcut?.kod) {
              const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
              const assignedLetter = getAssignedLetter(coordData?.[0]?.baslik);
              if (assignedLetter && currentOlcut.kod.startsWith(assignedLetter)) {
                isAuthorized = true;
              }
            }
          }

          if (!isAuthorized) {
            router.replace('/olcutler');
            return;
          }
        }
      }
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).maybeSingle();
      if (olcut) setOlcutDetay(olcut);

      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', phaseId)
        .eq('donem_id', selectedPeriod?.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pukoData) {
        setPukoId(pukoData.id);
        setOnayDurumu(pukoData.durum || 'Taslak');
        setAciklama(pukoData.aciklama || '');
        setRiskAnalizi(pukoData.risk_analizi || '');
        // handle JSONB or Text array for kanit_dosyalari
        setDokumanlar(Array.isArray(pukoData.kanit_dosyalari) ? pukoData.kanit_dosyalari : []);
        // handle string array backward compatibility
        const oneriler = Array.isArray(pukoData.ust_birim_onerileri) ? pukoData.ust_birim_onerileri : [];
        setUstBirimOnerileri(oneriler.map((o: any) => typeof o === 'string' ? { birim: '', oneri: o } : o));
      } else {
        setPukoId(null);
        setOnayDurumu('');
        setUstBirimOnerileri([]);
      }

      if (showEylemPlanTablosu) {
        const { data: eylemlerData } = await supabase
          .from('eylem_planlari')
          .select('*')
          .eq('alt_olcut_id', resolvedParams.id)
          .eq('donem_id', selectedPeriod?.id)
          .order('id', { ascending: true });

        if (eylemlerData && eylemlerData.length > 0) {
          setEylemler(eylemlerData);
        } else {
          setEylemler([{ iyilestirme_alani: '', bulgular: '', eylem_faaliyet: '', sorumlu: '', takvim: '', basari_gostergesi: '', izleme_durumu: '', riskler: '' }]);
        }
      }
      
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, phaseId, selectedPeriod]);

  const handleAddEylem = () => {
    setEylemler([...eylemler, { iyilestirme_alani: '', bulgular: '', eylem_faaliyet: '', sorumlu: '', takvim: '', basari_gostergesi: '', izleme_durumu: '', riskler: '' }]);
  };

  const handleEylemChange = (index: number, field: keyof Eylem, value: string) => {
    const newEylemler = [...eylemler];
    newEylemler[index] = { ...newEylemler[index], [field]: value };
    setEylemler(newEylemler);
  };

  const handleRemoveEylem = async (index: number) => {
    if (confirm('Bu eylem planını silmek istediğinize emin misiniz?')) {
      const eylemToRemove = eylemler[index];
      
      if (eylemToRemove.id) {
        try {
          const { error } = await supabase.from('eylem_planlari').delete().eq('id', eylemToRemove.id);
          if (error) throw error;
        } catch (error: any) {
          console.error('Eylem silme hatası:', error);
          alert('Eylem silinirken hata oluştu.');
          return;
        }
      }
      
      const newEylemler = eylemler.filter((_, i) => i !== index);
      setEylemler(newEylemler.length > 0 ? newEylemler : [{ iyilestirme_alani: '', bulgular: '', eylem_faaliyet: '', sorumlu: '', takvim: '', basari_gostergesi: '', izleme_durumu: '', riskler: '' }]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!selectedPeriod) throw new Error("Aktif dönem seçili değil.");
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const upsertData: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: phaseId,
        donem_id: selectedPeriod.id,
        aciklama: aciklama,
        risk_analizi: riskAnalizi,
        kanit_dosyalari: dokumanlar
      };

      if (!isReadOnly) {
        upsertData.durum = 'Taslak';
        upsertData.red_nedeni = null;
      }

      if (phaseId === 'onlem') {
        upsertData.ust_birim_onerileri = ustBirimOnerileri;
      }
      
      const { data: existingRecord } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', phaseId)
        .eq('donem_id', selectedPeriod?.id)
        .maybeSingle();

      let savedRecordId = existingRecord?.id;

      if (existingRecord?.id) {
        const { error: updateErr } = await supabase
          .from('puko_degerlendirmeleri')
          .update(upsertData)
          .eq('id', existingRecord.id);
        if (updateErr) throw updateErr;
        
        await logAction({
          supabase,
          islemTipi: 'UPDATE',
          tabloAdi: 'puko_degerlendirmeleri',
          kayitId: existingRecord.id,
          yeniVeri: upsertData
        });
      } else {
        const { data: newRec, error: insertErr } = await supabase
          .from('puko_degerlendirmeleri')
          .insert(upsertData)
          .select('id')
          .maybeSingle();
        if (insertErr) throw insertErr;
        
        savedRecordId = newRec?.id;

        await logAction({
          supabase,
          islemTipi: 'INSERT',
          tabloAdi: 'puko_degerlendirmeleri',
          kayitId: newRec?.id,
          yeniVeri: upsertData
        });
      }

      // BİLDİRİM TETİKLEYİCİ: Eğer 'Beklemede' bir kayıt yoksa veya bu bir yeni gönderimse tetikle
      if (!isReadOnly) {
        const { data: existingNotif } = await supabase
          .from('puko_degerlendirmeleri')
          .select('id')
          .eq('alt_olcut_id', resolvedParams.id)
          .eq('donem_id', selectedPeriod?.id)
          .eq('durum', 'Beklemede')
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          // Yeni bir bildirim kaydı oluştur (Puko tablosu üzerinden yürüyoruz)
          // Zaten yukarıda upsert yaptık, bu kontrol sadece UI tarafında bildirim merkezini tetiklemek için.
          // Eğer durum zaten Beklemede olarak kaydedildiyse bildirim merkezinde görünecektir.
        }
      }

      if (showEylemPlanTablosu) {
        const toInsert = eylemler
          .filter(e => !e.id)
          .map(e => {
            const { id, ...rest } = e;
            return { ...rest, alt_olcut_id: resolvedParams.id, donem_id: selectedPeriod?.id };
          });
          
        const toUpdate = eylemler.filter(e => e.id);

        if (toInsert.length > 0) {
          const { error: eInsertErr } = await supabase.from('eylem_planlari').insert(toInsert);
          if (eInsertErr) throw eInsertErr;
        }
        for (const e of toUpdate) {
          const { id, ...updatePayload } = e;
          const { error: eUpdErr } = await supabase.from('eylem_planlari').update(updatePayload).eq('id', id);
          if (eUpdErr) throw eUpdErr;
        }
      }

      // Handle physical deletion of removed docs
      if (deletedDocs.length > 0) {
        for (const doc of deletedDocs) {
          if (doc.url) {
            let bucketPath = '';
            if (doc.url.includes('/dokumanlar/')) {
              bucketPath = doc.url.split('/dokumanlar/')[1]?.split('?')[0];
            } else {
              const urlParts = doc.url.split('/');
              bucketPath = urlParts[urlParts.length - 1]?.split('?')[0];
            }
            if (bucketPath) {
              const decodedPath = decodeURIComponent(bucketPath);
              const { error: storageError } = await supabase.storage.from('dokumanlar').remove([decodedPath]);
              if (storageError) {
                console.error('Dosya silinirken hata oluştu:', storageError);
              }
            }
            
            await logAction({
              supabase,
              islemTipi: 'DELETE',
              tabloAdi: 'dokumanlar (puko_kanit)',
              kayitId: savedRecordId || pukoId || undefined,
              eskiVeri: doc
            });
          }
        }
        setDeletedDocs([]);
      }

      alert(t('save_success'));
      fetchData(); 

    } catch (error: any) {
      let errMsg = 'Bilinmeyen Hata Oluştu.';
      if (error) {
        if (typeof error === 'string') errMsg = error;
        else if (error.message) errMsg = error.message;
        else if (error.details) errMsg = error.details;
        else if (error.hint) errMsg = error.hint;
        else errMsg = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      console.error('Save Error:', error);
      alert(`${t('save_error')}: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    
    const validation = validateFileSize(file);
    if (!validation.valid) {
      alert(validation.error);
      event.target.value = '';
      return;
    }

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${resolvedParams.id}_${phaseId}_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage.from('dokumanlar').upload(filePath, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(filePath);

      const newDoc = {
        name: file.name,
        url: publicUrlData.publicUrl,
        size: Math.round(file.size / 1024)
      };

      setDokumanlar(prev => {
        const updated = [...prev, newDoc];
        const newIdx = updated.length - 1;
        setTimeout(() => {
          handleInsertEvidenceAtCursor(newDoc, newIdx);
        }, 100);
        return updated;
      });

    } catch (error: any) {
      console.error('File upload error:', error);
      alert(`${t('upload_error')}: ${error.message}`);
    } finally {
      setUploadingDoc(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveDoc = async (index: number) => {
    if (confirm(t('delete_confirm'))) {
      const docToRemove = dokumanlar[index];
      
      // 1. Immediately delete physical file from Supabase Storage Bucket
      if (docToRemove?.url) {
        try {
          let bucketPath = '';
          if (docToRemove.url.includes('/dokumanlar/')) {
            bucketPath = docToRemove.url.split('/dokumanlar/')[1]?.split('?')[0];
          } else {
            const urlParts = docToRemove.url.split('/');
            bucketPath = urlParts[urlParts.length - 1]?.split('?')[0];
          }
          if (bucketPath) {
            const decodedPath = decodeURIComponent(bucketPath);
            await supabase.storage.from('dokumanlar').remove([decodedPath]);
          }

          // Delete annotated copy if present
          if (docToRemove.annotated_url && docToRemove.annotated_url !== docToRemove.url) {
            let annoPath = '';
            if (docToRemove.annotated_url.includes('/dokumanlar/')) {
              annoPath = docToRemove.annotated_url.split('/dokumanlar/')[1]?.split('?')[0];
            } else {
              const urlParts = docToRemove.annotated_url.split('/');
              annoPath = urlParts[urlParts.length - 1]?.split('?')[0];
            }
            if (annoPath) {
              const decodedAnnoPath = decodeURIComponent(annoPath);
              await supabase.storage.from('dokumanlar').remove([decodedAnnoPath]);
            }
          }
        } catch (err) {
          console.error('Storage deletion error:', err);
        }
      }
      
      // 2. Automatically remove inline evidence links & tags from text editor
      const kanitNo = index + 1;
      let newAciklama = aciklama;
      
      if (docToRemove?.url) {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedUrl = escapeRegExp(docToRemove.url);
        
        // Remove <a ...href="URL"...>...</a>
        const urlRegex = new RegExp(`<a\\s+[^>]*href=["']${escapedUrl}["'][^>]*>.*?<\\/a>`, 'gi');
        newAciklama = newAciklama.replace(urlRegex, '');
      }

      // Remove <a ...>[Kanıt {kanitNo}]</a>
      const tagRegex = new RegExp(`<a\\s+[^>]*>\\[Kanıt\\s+${kanitNo}\\]<\\/a>`, 'gi');
      newAciklama = newAciklama.replace(tagRegex, '');

      // Remove plain text [Kanıt {kanitNo}]
      const plainTagRegex = new RegExp(`\\[Kanıt\\s+${kanitNo}\\]`, 'gi');
      newAciklama = newAciklama.replace(plainTagRegex, '');

      setAciklama(newAciklama);

      // 3. Remove document from state
      const newDocs = dokumanlar.filter((_, i) => i !== index);
      setDokumanlar(newDocs);
    }
  };

  // Onay ve Ret işlemleri Stage 7'ye (OzdegerlendirmeRaporuClient) taşındı.

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Dynamic Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              {olcutDetay?.kod}
            </span>
            <h1 className="text-xl font-bold text-slate-800">{getLocalizedField(olcutDetay, 'olcut_adi', locale)}</h1>
          </div>
          <p className="text-sm text-slate-500">{t('process_management_desc', { phaseTitle: tStepPanel(`${phaseId}_title`) })}</p>
        </div>

        <div className="flex items-center gap-3">
          {!isReadOnly && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-200 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('saving') : t('save')}
          </button>
          )}
        </div>
      </div>

      <StepPanel activeStepId={phaseId} altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-b border-slate-200">
          
          <div className="col-span-2 p-6 lg:border-r border-slate-200">
            <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-sm">
              <Settings className="w-4 h-4 text-blue-600" />
              {tStepPanel(`${phaseId}_title`)} {t('process_description')}
              {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200">{t('readOnly')}</span>}
            </h3>
            <div className="w-full">
              <RichTextEditor ref={editorRef} content={aciklama} onChange={setAciklama} readOnly={isReadOnly} />
            </div>
            <div className="flex justify-end mt-2 text-xs text-slate-400">
              {t('word_count')} {aciklama.replace(/<[^>]*>?/gm, '').split(/\s+/).filter(w => w.length > 0).length}
            </div>

            {phaseId === 'planlama' && (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-4 text-sm">
                  <Info className="w-4 h-4 text-amber-500" />
                  {t('headers.risk_analysis') || 'Risk Analizi'}
                </h3>
                <textarea 
                  value={riskAnalizi} 
                  onChange={(e) => setRiskAnalizi(e.target.value)} 
                  disabled={isReadOnly}
                  placeholder={t('risk_analysis_placeholder') || 'Bu planlama aşamasında öngörülen riskleri ve alınacak tedbirleri belirtiniz...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 min-h-[120px] resize-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none disabled:opacity-80"
                />
              </div>
            )}
          </div>

          <div className="col-span-1 p-6 bg-[#F8FAFC]">
            <h3 className="flex items-center justify-between font-semibold text-slate-700 mb-4 text-sm">
              <span className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-500" />
                {t('related_documents')}
              </span>
            </h3>
            
            <div className="space-y-3 mb-4">
              {dokumanlar.length === 0 ? (
                <div className="text-sm text-slate-400 italic text-center py-4 bg-white border border-slate-200 border-dashed rounded-lg">
                  {t('no_document_yet')}
                </div>
              ) : (
                dokumanlar.map((doc, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-200">
                            [Kanıt {idx + 1}]
                          </span>
                          {doc.is_annotated && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                              ✓ İşaretli
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{doc.size ? `${doc.size} KB` : t('unknown_size')}</p>
                        {doc.highlight_note && (
                          <p className="text-[11px] text-amber-700 font-medium italic truncate mt-1" title={doc.highlight_note}>
                            📌 {doc.highlight_note}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.preventDefault(); handleOpenAnnotator(idx, false); }} 
                          className="p-1.5 bg-amber-50 text-amber-600 rounded flex-shrink-0 hover:bg-amber-100 transition-colors" 
                          title="İşaretle / Düzelt"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); handleOpenAnnotator(idx, true); }} 
                          className="p-1.5 bg-blue-50 text-blue-600 rounded flex-shrink-0 hover:bg-blue-100 transition-colors" 
                          title="Site İçi Görüntüle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isReadOnly && (
                          <button onClick={(e) => { e.preventDefault(); handleRemoveDoc(idx); }} className="p-1.5 bg-red-50 text-red-600 rounded flex-shrink-0 hover:bg-red-100" title="Sil">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

            {!isReadOnly && (
            <div className="relative">
              <input 
                type="file" 
                id={`doc-upload-${phaseId}`} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                onChange={handleFileUpload}
                disabled={uploadingDoc || isReadOnly}
              />
              <button disabled={uploadingDoc || isReadOnly} className="w-full py-2 border border-dashed border-blue-300 text-blue-600 text-sm font-medium rounded-lg bg-blue-50/50 hover:bg-blue-100/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploadingDoc ? t('loading') : t('add_document')}
              </button>
            </div>
            )}
          </div>
        </div>

        {phaseId === 'onlem' && (
          <div className="p-6 border-b border-slate-200 bg-amber-50/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Plus className="w-4 h-4 text-amber-600 font-normal" />
                {t('suggestions_for_upper_units')}
              </h3>
              {!isReadOnly && (
                <button 
                  onClick={() => setUstBirimOnerileri([...ustBirimOnerileri, { birim: '', oneri: '' }])}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('add_new_suggestion')}
                </button>
              )}
            </div>
            
            {ustBirimOnerileri.length === 0 ? (
              <div className="text-center py-6 bg-white border border-dashed border-slate-300 rounded-lg">
                <p className="text-sm text-slate-500">{t('suggestion_empty_desc')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ustBirimOnerileri.map((oneri, index) => (
                  <div key={index} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Gönderilen Birim:</span>
                        <input 
                          disabled={isReadOnly}
                          value={oneri.birim || ''}
                          onChange={(e) => {
                            const newOneriler = [...ustBirimOnerileri];
                            newOneriler[index] = { ...newOneriler[index], birim: e.target.value };
                            setUstBirimOnerileri(newOneriler);
                          }}
                          placeholder="Örn: Rektörlük, Kalite Koordinatörlüğü..."
                          className="flex-1 bg-transparent border-b border-slate-200 focus:border-amber-400 py-1 text-sm font-semibold text-slate-800 outline-none disabled:opacity-80"
                        />
                      </div>
                      <textarea
                        disabled={isReadOnly}
                        value={oneri.oneri || ''}
                        onChange={(e) => {
                          const newOneriler = [...ustBirimOnerileri];
                          newOneriler[index] = { ...newOneriler[index], oneri: e.target.value };
                          setUstBirimOnerileri(newOneriler);
                        }}
                        placeholder={t('suggestion_placeholder')}
                        className="w-full bg-slate-50 rounded-lg p-3 text-sm text-slate-700 resize-none outline-none disabled:opacity-80 border border-slate-200 focus:border-amber-400"
                        rows={3}
                      />
                    </div>
                    {!isReadOnly && (
                      <button 
                        onClick={() => {
                          const newOneriler = ustBirimOnerileri.filter((_, i) => i !== index);
                          setUstBirimOnerileri(newOneriler);
                        }}
                        className="absolute top-2 right-2 p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Öneriyi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showEylemPlanTablosu && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
                <CalendarDays className="w-4 h-4 text-blue-600 font-normal" />
                {t('action_plan')}
              </h3>
              {!isReadOnly && (
              <button 
                onClick={handleAddEylem}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('add_new_action')}
              </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-[#F8FAFC] text-slate-600 text-xs font-semibold whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '13%'}}>{t('headers.iyilestirme_alani')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '15%'}}>{t('headers.bulgular')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '15%'}}>{t('headers.eylem_faaliyet')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '10%'}}>{t('headers.sorumlu')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '8%'}}>{t('headers.takvim')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '13%'}}>{t('headers.basari_gostergesi')}</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '13%'}}>Riskler</th>
                    <th className="px-4 py-3 border-b border-r border-slate-200" style={{width: '13%'}}>{t('headers.izleme')}</th>
                    <th className="px-4 py-3 border-b border-slate-200" style={{width: '5%'}}>İşlem</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {eylemler.map((eylem, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.iyilestirme_alani} onChange={(e) => handleEylemChange(index, 'iyilestirme_alani', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.bulgular} onChange={(e) => handleEylemChange(index, 'bulgular', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.eylem_faaliyet} onChange={(e) => handleEylemChange(index, 'eylem_faaliyet', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.sorumlu} onChange={(e) => handleEylemChange(index, 'sorumlu', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.takvim} onChange={(e) => handleEylemChange(index, 'takvim', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.basari_gostergesi} onChange={(e) => handleEylemChange(index, 'basari_gostergesi', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.riskler} onChange={(e) => handleEylemChange(index, 'riskler', e.target.value)} /></td>
                      <td className="p-2 border-r border-slate-100"><textarea disabled={isReadOnly} className="w-full h-full min-h-[60px] p-2 text-xs border-transparent rounded resize-none focus:ring-1 focus:ring-blue-500 disabled:bg-transparent disabled:opacity-80" value={eylem.izleme_durumu} onChange={(e) => handleEylemChange(index, 'izleme_durumu', e.target.value)} /></td>
                      <td className="p-2 text-center">
                        {!isReadOnly && (
                          <button onClick={() => handleRemoveEylem(index)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Eylemi Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ortak Kaydet Butonu */}
        {!isReadOnly && (
        <div className="flex justify-end p-6 pt-0 mt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
        )}

      </div>
    </div>

    {/* Evidence Annotator Modal */}
    <EvidenceAnnotatorModal
      isOpen={annotatorModalOpen}
      onClose={() => {
        setAnnotatorModalOpen(false);
        setSelectedDocForAnnotation(null);
      }}
      doc={selectedDocForAnnotation?.doc || null}
      docIndex={selectedDocForAnnotation?.index ?? -1}
      onSaveAnnotatedDoc={handleSaveAnnotatedDoc}
      isReadOnly={isReadOnly || annotatorReadOnly}
    />
  </>
);
}
