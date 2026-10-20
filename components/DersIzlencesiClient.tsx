'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  Save, ArrowLeft, Plus, Trash2, 
  BookOpen, Clock, Target, ListChecks, 
  FileText, BarChart3, Settings, ShieldCheck,
  ChevronRight, ChevronLeft, GraduationCap, Check,
  Lock, Upload, Download, Eye, FileCheck, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePeriod } from '@/contexts/PeriodContext';
import { useTranslations } from 'next-intl';

interface Course {
  kod: string;
  ad: string;
  t: number;
  u: number;
  l: number;
  kredi: number;
  akts: number;
  dil: string;
  yariyil: string;
  tur: string;
}

interface SinavDosyasi {
  name: string;
  url: string;
  storagePath?: string;
  size?: number;
  mime_type?: string;
  uploaded_at?: string;
}

interface OgrenciKagidi extends SinavDosyasi {
  duzey: 'en_yuksek' | 'orta' | 'en_dusuk';
}

interface SinavArsiviState {
  id?: string;
  vize_sorulari: SinavDosyasi | null;
  final_sorulari: SinavDosyasi | null;
  cevap_anahtari: SinavDosyasi | null;
  ogrenci_kagitlari: OgrenciKagidi[];
}

const DEFAULT_POLICIES = `• Ders Süresi ve İşleyişi: Ders toplamda 3 saat sürecek şekilde planlanmıştır ve 1 saatlik iki blok halinde işlenecektir. Bloklar arasında 15 dakikalık bir ara verilecektir.
• Dijital Araçların Kullanımı: Ders sırasında cep telefonu, tablet, dizüstü bilgisayar vb. kişisel elektronik/dijital cihazlarla dersin herhangi bir bölümünü kaydedemezsiniz.
• Devam Durumu: Eskişehir Osmangazi Üniversitesi Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği 16. Madde gereği "Öğrenci, teorik ders çalışmalarının %70'ine, laboratuvar ve uygulama çalışmalarının %80'ine devam etmek zorundadır."
• Öğrenci Merkezli Öğrenme: Ders, öğrenci merkezli bir yaklaşımla yürütülecektir. Bu kapsamda öğrencilerin katılımı desteklenecek, öğrenme sürecine dair sorumluluk almaları beklenecek ve ders sürecine dair geri bildirimleri alınacaktır.
• Engelli Öğrenci Desteği: Sizin için engel oluşturabilecek durumlarla (görme, işitme vb.) ilgili olarak doğrudan benimle iletişime geçebilirsiniz.
• Sözlü ve Yazılı İletişim Etiği: Sınıf tartışmaları sırasında birbirinize saygı göstererek ve nefret söylemi kullanmadan yorumlar yapabilirsiniz. Sunumlarınızda veya yazılı ödevlerinizde herhangi bir kaynağı kullanırken yazarları ve web materyallerini referans göstermeyi unutmayın.
• Grup Çalışmaları ve Ekip Çalışması Etiği: Grup çalışmaları sırasında tüm öğrencilerin eşit katılım göstermesi ve iş birliği içinde çalışması beklenmektedir.
• Ödev Teslimi: Özellikle vize sonrası ek puan talebinde bulunan öğrenciler için ekstra ödev seçenekleri sunulabilir. Bu ödevler, öğretim elemanı tarafından belirlenecek bir konu çerçevesinde hazırlanmalı ve teslim edilmelidir.
• Yapay Zeka Kullanımı: Bu derste yapay zeka araçları sınırlı ve sorumlu biçimde kullanılabilir. Yapay zeka, öğrencinin kendi öğrenme sürecini destekleyen bir yardımcı olarak görülür; öğrencinin yerine düşünme, analiz etme veya akademik üretim yapma aracı değildir.`;

const AKTS_ROWS = [
  "Ders Süresi (Sınav Haftası Dahil Haftalık Toplam Ders Saati)",
  "Sınıf Dışı Ders Çalışma Süresi (Tekrar, Pekiştirme, Ön Çalışma vb.)",
  "Ödev", "Kısa Sınav", "Kısa Sınav Hazırlık", "Sözlü Sınav", "Sözlü Sınav Hazırlık",
  "Rapor (Hazırlık ve Sunum Süresi Dahil)", "Proje (Hazırlık ve Sunum Süresi Dahil)",
  "Sunum (Hazırlık Süresi Dahil)", "Ara Sınav", "Ara Sınav Hazırlık",
  "Yarıyıl Sonu Sınavı", "Yarıyıl Sonu Sınavı Hazırlık"
];

const PROGRAM_OUTCOMES = [
  "İlahiyat alanına ilişkin temel kavram ve kuramları bilir, bunları kullanarak güncel olay ve olguları açıklar.",
  "Sahip olduğu yabancı dil bilgisi ile alanındaki yeni çalışmaları ve bilimsel gelişmeleri takip eder, elde ettiği yabancı literatürdeki bilgileri ilgililerle paylaşır.",
  "Sosyal, kültürel ve evrensel değerleri benimser, araştırma, iletişim ve eylemlerinde erdemli davranışlar sergiler, tarihi ve kültürel mirasın aktarımına katkı sağlar.",
  "Alanıyla ilgili karşılaştığı sorunları doğru bir şekilde tanımlar, bunlara disipliner ve disiplinlerarası çalışmalarla uygun çözüm ve alternatifler geliştirir ve bunları ilgili kurumlarla paylaşır.",
  "Değişen ve gelişen yerel / küresel sosyal ve politik konjonktürü yakından takip eder ve yeni şartlara uygun anlayış ve yaklaşımlar geliştirir.",
  "Dini anlayış ve uygulamaların bireysel, toplumsal ve evrensel boyuttaki yansımalarını fark eder. Toplumsal hayatta ortaya çıkan ihtiyaç ve sorunlara dini alandan bilimsel çözümler sunar ve bunları ilgili kurumlarla paylaşır.",
  "Alanına ilişkin eğitimsel süreçleri etkin bir şekilde planlar, bu planları uygular ve mesleki ve akademik gelişimine yönelik sosyal, kültürel ve sanatsal etkinliklere katılır.",
  "Alanına ilişkin akademik ve kültürel birikimi eleştirel bir yaklaşımla analiz eder, hayatı boyunca alanına ilişkin yeni öğrenme ortamlarına katılmaya istekli olur.",
  "Sahip olduğu bilgi ve yetkinlikleri alanıyla ilgili eğitim, araştırma ve topluma hizmet faaliyetlerinde yetkin şekilde kullanır.",
  "Alanına ilişkin gerçekleştireceği her türlü araştırma, eğitim ve topluma hizmet faaliyetlerinde birey hak ve özgürlüklerine saygı duyar, toplumsal, ahlaki ve hukuki ilkelere uygun davranışlar sergiler.",
  "Güncel bilişim ve iletişim teknolojilerine ilişkin bilgi ve becerilerini geliştirir, bunlardaki yetkinliklerini alanıyla ilgili faaliyetlerde aktif şekilde kullanır.",
  "İlahiyat alanında eğitim, araştırma ve topluma hizmet boyutlarında sorun çözme ve iyileştirmeye yönelik bireysel ve kurumsal düzeyde faaliyetler planlar ve bunların uygulanmasında sorumluluk üstlenir."
];

const DISCIPLINE_OUTCOMES = [
  "Kur'an-ı Kerim bilgisine, doğru tilavet becerisine ve yeterli ezbere sahip olma",
  "Arapça temel kaynakları okuma ve anlama yetkinliğine sahip olma",
  "İtikat, ibadet, ahlak ve muamelata dair usul ve esasları kavrama ve bu esasların dayandığı temelleri bilme",
  "Kur'an ve sünnet bütünlüğünü esas alan bir yaklaşıma sahip olma",
  "Bütüncül ve sistematik bir dini düşünce ve kavrayışa sahip olma",
  "Zaman ve mekâna göre ortaya çıkan farklı dini yaklaşımları doğru anlama ve tutarlı değerlendirme yetkinliğine sahip olma",
  "Din istismarı, şiddet, İslam karşıtlığı gibi dine ve topluma zararlı eğilimlere karşı söylem ve tutum geliştirebilme yetkinliğine sahip olma",
  "Farklı düşünce ve yorumlar karşısında saygı ve adaleti esas alma yetkinliğine sahip olma",
  "Kişi ve kurumlar yerine ilke ve değerleri üstün tutan bir anlayışa sahip olma",
  "Dinin temel kaynakları ve bilimsel verilere dayalı din eğitimi ve din hizmetleri verme yetkinliğine sahip olma",
  "Toplumun inanç, ibadet, ahlak, örf ve adetlerini İslam'ın temel kaynakları ışığında yorumlama ve toplumu aydınlatma yetkinliğine sahip olma",
  "Dini danışmanlık ve rehberlik bilgi ve becerisine sahip olma",
  "Akıl, bilgi, istişare, emanete riayet, ehliyet ve adalet gibi temel değerler/ilkeler ışığında çalışma ve sorumluluk üstlenebilme yetkinliğine sahip olma",
  "İslam kültür, sanat ve medeniyeti hakkında temel ve bütüncül bilgilere sahip olma"
];

export default function DersIzlencesiClient({ 
  dersler, 
  izlenceler, 
  currentUserId,
  defaultOgretimElemani,
  defaultEposta
}: { 
  dersler: Course[]; 
  izlenceler: any[];
  currentUserId: string;
  defaultOgretimElemani: string;
  defaultEposta: string;
}) {
  const tArsiv = useTranslations('ExamArchive');
  const { selectedPeriod } = usePeriod();
  const [activeStep, setActiveStep] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Sınav ve Değerlendirme Arşivi State
  const [sinavArsivi, setSinavArsivi] = useState<SinavArsiviState>({
    vize_sorulari: null,
    final_sorulari: null,
    cevap_anahtari: null,
    ogrenci_kagitlari: [],
  });
  const [arsivListesi, setArsivListesi] = useState<any[]>([]);
  const [selectedHocaId, setSelectedHocaId] = useState<string>(currentUserId);
  const [arsivLoading, setArsivLoading] = useState(false);
  const [arsivSaving, setArsivSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Arşiv Verilerini Çek (Birden fazla hoca desteği - maybeSingle hatası önlendi)
  useEffect(() => {
    async function fetchArsiv() {
      if (!selectedCourse?.kod) return;
      setArsivLoading(true);
      try {
        let query = supabase
          .from('ders_sinav_arsivi')
          .select('*, profiller:hoca_id(id, tam_adi, email)')
          .eq('ders_id', selectedCourse.kod);

        if (selectedPeriod?.id) {
          query = query.eq('donem_id', selectedPeriod.id);
        }

        const { data: rows, error } = await query;

        if (error) {
          // Tablo Supabase üzerinde henüz oluşturulmamışsa sessizce geç
          if (error.code !== 'PGRST205') {
            console.error('Sınav arşivi çekilemedi:', error);
          }
          return;
        }

        const allRows = Array.isArray(rows) ? rows : [];
        setArsivListesi(allRows);

        let activeRecord = allRows.find(r => r.hoca_id === selectedHocaId);
        if (!activeRecord && allRows.length > 0) {
          const ownRecord = allRows.find(r => r.hoca_id === currentUserId);
          activeRecord = ownRecord || allRows[0];
          setSelectedHocaId(activeRecord.hoca_id);
        }

        if (activeRecord) {
          setSinavArsivi({
            id: activeRecord.id,
            vize_sorulari: activeRecord.vize_sorulari || null,
            final_sorulari: activeRecord.final_sorulari || null,
            cevap_anahtari: activeRecord.cevap_anahtari || null,
            ogrenci_kagitlari: Array.isArray(activeRecord.ogrenci_kagitlari) ? activeRecord.ogrenci_kagitlari : [],
          });
        } else {
          setSinavArsivi({
            vize_sorulari: null,
            final_sorulari: null,
            cevap_anahtari: null,
            ogrenci_kagitlari: [],
          });
        }
      } catch (e) {
        console.warn('Sınav arşivi yükleme hatası:', e);
      } finally {
        setArsivLoading(false);
      }
    }
    fetchArsiv();
  }, [selectedCourse, selectedPeriod, currentUserId]);

  const handleHocaArsivChange = (targetHocaId: string) => {
    setSelectedHocaId(targetHocaId);
    const targetRecord = arsivListesi.find(r => r.hoca_id === targetHocaId);
    if (targetRecord) {
      setSinavArsivi({
        id: targetRecord.id,
        vize_sorulari: targetRecord.vize_sorulari || null,
        final_sorulari: targetRecord.final_sorulari || null,
        cevap_anahtari: targetRecord.cevap_anahtari || null,
        ogrenci_kagitlari: Array.isArray(targetRecord.ogrenci_kagitlari) ? targetRecord.ogrenci_kagitlari : [],
      });
    } else {
      setSinavArsivi({
        vize_sorulari: null,
        final_sorulari: null,
        cevap_anahtari: null,
        ogrenci_kagitlari: [],
      });
    }
  };

  // Arşivi Veritabanına Otomatik Kaydet
  const autoSaveArsiv = async (arsivToSave: SinavArsiviState) => {
    if (!selectedCourse?.kod) return;
    setArsivSaving(true);
    try {
      const payload: Record<string, any> = {
        ders_id: selectedCourse.kod,
        hoca_id: currentUserId,
        donem_id: selectedPeriod?.id || null,
        vize_sorulari: arsivToSave.vize_sorulari,
        final_sorulari: arsivToSave.final_sorulari,
        cevap_anahtari: arsivToSave.cevap_anahtari,
        ogrenci_kagitlari: arsivToSave.ogrenci_kagitlari,
        guncelleme_tarihi: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('ders_sinav_arsivi')
        .upsert(payload, { onConflict: 'ders_id,hoca_id,donem_id' })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205') {
          toast.error('Veritabanında ders_sinav_arsivi tablosu henüz mevcut değil.');
          return;
        }
        throw error;
      }
      if (data?.id) {
        setSinavArsivi(prev => ({ ...prev, id: data.id }));
      }
    } catch (err: any) {
      console.error('Arşiv kayıt hatası:', err);
      toast.error('Arşiv güncellenirken hata oluştu.');
    } finally {
      setArsivSaving(false);
    }
  };

  // Arşive Dosya Yükle
  const handleArsivUpload = async (
    field: 'vize_sorulari' | 'final_sorulari' | 'cevap_anahtari' | 'ogrenci_kagitlari',
    event: React.ChangeEvent<HTMLInputElement>,
    duzey?: 'en_yuksek' | 'orta' | 'en_dusuk'
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCourse?.kod) return;

    if (field === 'ogrenci_kagitlari' && sinavArsivi.ogrenci_kagitlari.length >= 3 && !duzey) {
      toast.error('En fazla 3 adet öğrenci kağıdı yükleyebilirsiniz.');
      return;
    }

    setUploadingField(duzey ? `${field}_${duzey}` : field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'sinav_arsivleri');
      formData.append('resource_type', 'sinav_arsivi');
      formData.append('ders_id', selectedCourse.kod);
      if (selectedPeriod?.id) {
        formData.append('donem_id', selectedPeriod.id);
      }

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Dosya yüklenemedi.');
      }

      const fileMeta: SinavDosyasi = {
        name: file.name,
        url: data.url,
        storagePath: data.storagePath,
        size: data.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
      };

      if (field === 'ogrenci_kagitlari') {
        const targetDuzey = duzey || (
          sinavArsivi.ogrenci_kagitlari.some(k => k.duzey === 'en_yuksek')
            ? (sinavArsivi.ogrenci_kagitlari.some(k => k.duzey === 'orta') ? 'en_dusuk' : 'orta')
            : 'en_yuksek'
        );

        const updatedList = [
          ...sinavArsivi.ogrenci_kagitlari.filter(k => k.duzey !== targetDuzey),
          { ...fileMeta, duzey: targetDuzey },
        ];
        const newArsiv = { ...sinavArsivi, ogrenci_kagitlari: updatedList };
        setSinavArsivi(newArsiv);
        await autoSaveArsiv(newArsiv);
      } else {
        const newArsiv = { ...sinavArsivi, [field]: fileMeta };
        setSinavArsivi(newArsiv);
        await autoSaveArsiv(newArsiv);
      }

      toast.success(tArsiv('upload_success'));
    } catch (err: any) {
      console.error('Yükleme hatası:', err);
      toast.error(err.message || 'Yükleme başarısız oldu.');
    } finally {
      setUploadingField(null);
      if (event.target) event.target.value = '';
    }
  };

  // Arşivden Dosya Sil (Fiziksel storage ve veritabanı senkronize)
  const handleArsivDelete = async (
    field: 'vize_sorulari' | 'final_sorulari' | 'cevap_anahtari' | 'ogrenci_kagitlari',
    duzey?: 'en_yuksek' | 'orta' | 'en_dusuk'
  ) => {
    if (!confirm(tArsiv('delete_confirm'))) return;

    let targetDoc: SinavDosyasi | null = null;
    if (field === 'ogrenci_kagitlari' && duzey) {
      targetDoc = sinavArsivi.ogrenci_kagitlari.find(k => k.duzey === duzey) || null;
    } else if (field !== 'ogrenci_kagitlari') {
      targetDoc = sinavArsivi[field];
    }

    // 1. Fiziksel Depo ve Yetkilendirme Temizliği (Hata durumunda işlem derhal durdurulur)
    if (targetDoc?.url) {
      try {
        const delRes = await fetch('/api/storage/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: 'sinav_arsivleri',
            storagePath: targetDoc.storagePath,
            url: targetDoc.url,
          }),
        });
        const delData = await delRes.json();
        if (!delRes.ok || !delData.success) {
          toast.error(delData.error || tArsiv('delete_failed'));
          return;
        }
      } catch (delErr: any) {
        console.error('Fiziksel dosya silme hatası:', delErr);
        toast.error('Dosya silinirken sunucuyla bağlantı kurulamadı. İşlem durduruldu.');
        return;
      }
    }

    // 2. State ve Veritabanı Güncellemesi (Yalnızca depo silme başarılı olduysa çalışır)
    let newArsiv = { ...sinavArsivi };
    if (field === 'ogrenci_kagitlari' && duzey) {
      newArsiv.ogrenci_kagitlari = sinavArsivi.ogrenci_kagitlari.filter(k => k.duzey !== duzey);
    } else if (field !== 'ogrenci_kagitlari') {
      newArsiv[field] = null;
    }
    setSinavArsivi(newArsiv);
    await autoSaveArsiv(newArsiv);
    toast.success(tArsiv('delete_success'));
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const kod = urlParams.get('kod');
    if (kod && dersler.length > 0) {
      const ders = dersler.find(d => d.kod === kod);
      if (ders) handleCourseSelect(ders);
    }
  }, [dersler]);

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    const existing = izlenceler.find(i => i.ders_id === course.kod);
    
    const defaultData = {
      ogretimElemani: defaultOgretimElemani,
      eposta: defaultEposta,
      gorusmeGunSaat: '',
      ofis: '',
      donem: course.yariyil,
      gunSaat: '',
      egitimDili: course.dil || 'Türkçe',
      ogretimTuru: 'Örgün Öğretim',
      derslik: '',
      onkosul: '-',
      amac: '',
      ogrenimCiktilari: Array(10).fill(0).map(() => ({ 
        cikti: '', bilgi: false, beceri: false, yetkinlik: false, ogretim: '', olcme: '' 
      })),
      temelKaynaklar: '',
      yardimciKaynaklar: '',
      politikalar: DEFAULT_POLICIES,
      haftalikIcerik: [
        ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 1), konu: '', kaynaklar: '', isYuku: '' })),
        { hafta: 'Arasınav', konu: 'Arasınav Haftası', kaynaklar: '', isYuku: '' },
        ...Array(7).fill(0).map((_, i) => ({ hafta: String(i + 8), konu: '', kaynaklar: '', isYuku: '' })),
        { hafta: 'Final', konu: 'Final Haftası', kaynaklar: '', isYuku: '' }
      ],
      degerlendirme: [
        { tur: 'Ara Sınav', aciklama: '', yuzde: 40 },
        { tur: 'Ödev', aciklama: '', yuzde: 0 },
        { tur: 'Sunum', aciklama: '', yuzde: 0 },
        { tur: 'Uygulama', aciklama: '', yuzde: 0 },
        { tur: 'Final', aciklama: '', yuzde: 60 },
        { tur: 'Bütünleme', aciklama: '', yuzde: 0 }
      ],
      harfNotu: 'AA: / BA: / BB: / CB: / CC: / DC: / DD:',
      aktsIsYuku: AKTS_ROWS.map(row => ({ 
        etkinlik: row, sayisi: '', suresi: '', toplam: '' 
      })),
      pcMatris: PROGRAM_OUTCOMES.map((pc, i) => ({ 
        id: `PÇ${i+1}`, metin: pc, ocValues: Array(10).fill('') 
      })),
      docMatris: DISCIPLINE_OUTCOMES.map((doc, i) => ({ 
        id: `DÖÇ${i+1}`, metin: doc, ocValues: Array(10).fill('') 
      }))
    };

    if (existing && existing.icerik && Object.keys(existing.icerik).length > 0) {
      let mergedData = { ...defaultData, ...existing.icerik };
      
      if (mergedData.haftalikIcerik) {
        const hIcerik = [...mergedData.haftalikIcerik];
        const arasInavIdx = hIcerik.findIndex(h => h.hafta === 'Arasınav');
        if (arasInavIdx !== -1 && arasInavIdx !== 7) {
          const [arasinavRow] = hIcerik.splice(arasInavIdx, 1);
          hIcerik.splice(7, 0, arasinavRow);
          let weekCounter = 1;
          hIcerik.forEach((row) => {
            if (row.hafta !== 'Arasınav' && row.hafta !== 'Final') {
              row.hafta = String(weekCounter++);
            }
          });
          mergedData.haftalikIcerik = hIcerik;
        }
      }

      // Backward compatibility for aktsIsYuku (recalc in case it was bad)
      if (mergedData.aktsIsYuku) {
        mergedData.aktsIsYuku = mergedData.aktsIsYuku.map((r: any) => ({
          ...r,
          toplam: ((parseFloat(r.sayisi) || 0) * (parseFloat(r.suresi) || 0)).toString()
        }));
      }

      setFormData(mergedData);
    } else {
      setFormData(defaultData);
    }
  };

  const handleSave = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ders_izlenceleri')
        .upsert({
          ders_id: selectedCourse.kod,
          hoca_id: currentUserId,
          icerik: formData,
          guncelleme_tarihi: new Date().toISOString()
        }, { onConflict: 'ders_id, hoca_id' });

      if (error) throw error;
      toast.success('İzlence başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      toast.error('Kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCourse || !formData) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg border border-slate-200">
          <GraduationCap className="w-20 h-20 text-blue-600 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ders İzlencesi Editörü</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">Lütfen düzenlemek istediğiniz dersi seçin.</p>
          <Link href="/izlenceler" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg">
            <ArrowLeft className="w-5 h-5" /> Eğitim Planına Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Sticky */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/izlenceler" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedCourse.kod}</h1>
            <h2 className="text-lg font-bold text-slate-800">{selectedCourse.ad}</h2>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                activeStep === step ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'
              }`}
            >
              SAYFA {step}
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
          <Save className="w-4 h-4" /> {loading ? 'KAYDEDİLİYOR...' : 'KAYDET'}
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        
        {/* Sayfa 1: Header, Bilgiler ve Öğrenim Çıktıları */}
        {activeStep === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Genel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['ogretimElemani', 'eposta', 'gorusmeGunSaat', 'ofis', 'gunSaat', 'derslik', 'onkosul'].map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {field === 'ogretimElemani' ? 'Öğretim Elemanı' : field === 'eposta' ? 'E-Posta' : field === 'gorusmeGunSaat' ? 'Görüşme Gün ve Saatleri' : field === 'onkosul' ? 'Önkoşul Dersleri' : field}
                    </label>
                    <input
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                      value={formData[field]}
                      onChange={e => setFormData({...formData, [field]: e.target.value})}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dersin Amacı</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 transition-all outline-none"
                    value={formData.amac}
                    onChange={e => setFormData({...formData, amac: e.target.value})}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Dersin Öğrenim Çıktıları</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-8">#</th>
                      <th className="border p-2 text-left">Dersin Öğrenim Çıktıları</th>
                      <th className="border p-2 w-12 text-center">Bilgi</th>
                      <th className="border p-2 w-12 text-center">Beceri</th>
                      <th className="border p-2 w-12 text-center">Yetkinlik</th>
                      <th className="border p-2 text-left">Öğretim Yöntemleri*</th>
                      <th className="border p-2 text-left">Ölçme Yöntemleri**</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.ogrenimCiktilari || []).map((oc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 text-center font-bold">{i + 1}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none focus:bg-blue-50" value={oc.cikti} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].cikti = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.bilgi} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].bilgi = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.beceri} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].beceri = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-2 text-center"><input type="checkbox" checked={oc.yetkinlik} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].yetkinlik = e.target.checked; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} className="w-4 h-4 cursor-pointer" /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.ogretim} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].ogretim = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none" value={oc.olcme} onChange={e => {
                          const newOc = [...formData.ogrenimCiktilari]; newOc[i].olcme = e.target.value; setFormData({...formData, ogrenimCiktilari: newOc});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 2: Kaynaklar ve Politikalar */}
        {activeStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Kaynakları</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Temel Ders Kitabı</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.temelKaynaklar} onChange={e => setFormData({...formData, temelKaynaklar: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yardımcı Kaynaklar</label>
                  <textarea rows={3} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.yardimciKaynaklar} onChange={e => setFormData({...formData, yardimciKaynaklar: e.target.value})} />
                </div>
              </div>
            </section>
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Politikaları</h3>
              <textarea rows={15} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-4 font-medium text-slate-700 outline-none text-sm leading-relaxed" value={formData.politikalar} onChange={e => setFormData({...formData, politikalar: e.target.value})} />
            </section>
          </div>
        )}

        {/* Sayfa 3: Haftalık İçerik ve Değerlendirme */}
        {activeStep === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Haftalık Ders İçeriği</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 w-16">Hafta</th>
                      <th className="border p-2 text-left">Konu Başlığı</th>
                      <th className="border p-2 text-left">İlgili Kaynaklar</th>
                      <th className="border p-2 w-32 text-center">Öğrenci İş Yükü</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.haftalikIcerik || []).map((row: any, i: number) => (
                      <tr key={i} className={row.hafta === 'Arasınav' || row.hafta === 'Final' ? 'bg-blue-50' : ''}>
                        <td className="border p-2 text-center font-bold">{row.hafta}</td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.konu} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].konu = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 outline-none bg-transparent" value={row.kaynaklar} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].kaynaklar = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                        <td className="border p-1"><input className="w-full p-2 text-center outline-none bg-transparent" value={row.isYuku} onChange={e => {
                          const newH = [...formData.haftalikIcerik]; newH[i].isYuku = e.target.value; setFormData({...formData, haftalikIcerik: newH});
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">Ders Değerlendirme</h3>
              <table className="w-full border-collapse border border-slate-200 text-[11px] mb-6">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border p-2 text-left">Değerlendirme Türü</th>
                    <th className="border p-2 text-left">Açıklama</th>
                    <th className="border p-2 w-20 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.degerlendirme || []).map((d: any, i: number) => (
                    <tr key={i}>
                      <td className="border p-2 font-bold">{d.tur}</td>
                      <td className="border p-1"><input className="w-full p-2 outline-none" value={d.aciklama} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].aciklama = e.target.value; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                      <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none" value={d.yuzde} onChange={e => {
                        const newD = [...formData.degerlendirme]; newD[i].yuzde = parseInt(e.target.value) || 0; setFormData({...formData, degerlendirme: newD});
                      }} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                    <td colSpan={2} className="border p-2 text-right">TOPLAM</td>
                    <td className="border p-2 text-center">{formData.degerlendirme.reduce((acc: number, d: any) => acc + d.yuzde, 0)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harf Notu Baremi</label>
                <input className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl px-5 py-3 font-bold text-slate-700 outline-none" value={formData.harfNotu} onChange={e => setFormData({...formData, harfNotu: e.target.value})} />
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 4: AKTS İş Yükü ve PÇ Matrisi (PÇ1-8) */}
        {activeStep === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-8 uppercase tracking-widest">AKTS - İş Yükü Tablosu</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 text-left">Etkinlikler</th>
                      <th className="border p-2 w-24 text-center">Sayısı</th>
                      <th className="border p-2 w-24 text-center">Süresi (Saat)</th>
                      <th className="border p-2 w-24 text-center">Toplam İş Yükü (Saat)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.aktsIsYuku || []).map((row: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 font-medium">{row.etkinlik}</td>
                        <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none bg-transparent" value={row.sayisi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; 
                          newA[i].sayisi = e.target.value; 
                          newA[i].toplam = ((parseFloat(newA[i].sayisi) || 0) * (parseFloat(newA[i].suresi) || 0)).toString();
                          setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1"><input type="number" className="w-full p-2 text-center outline-none bg-transparent" value={row.suresi} onChange={e => {
                          const newA = [...formData.aktsIsYuku]; 
                          newA[i].suresi = e.target.value; 
                          newA[i].toplam = ((parseFloat(newA[i].sayisi) || 0) * (parseFloat(newA[i].suresi) || 0)).toString();
                          setFormData({...formData, aktsIsYuku: newA});
                        }} /></td>
                        <td className="border p-1 bg-slate-50 text-slate-600 font-bold text-center">
                          {row.toplam || '0'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black text-slate-700">
                      <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü</td>
                      <td className="border p-2 text-center text-blue-600">
                        {formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-black text-slate-700">
                      <td colSpan={3} className="border p-2 text-right uppercase text-[10px] tracking-widest">Toplam İş Yükü / 30</td>
                      <td className="border p-2 text-center text-blue-600">
                        {((formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0) / 30).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-black text-slate-800">
                      <td colSpan={3} className="border p-3 text-right uppercase text-[11px] tracking-widest">Dersin AKTS Kredisi</td>
                      <td className="border p-3 text-center text-purple-700 text-lg">
                        {Math.ceil((formData.aktsIsYuku?.reduce((acc: number, row: any) => acc + (parseFloat(row.toplam) || 0), 0) || 0) / 30)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Dersin Öğrenim Çıktılarının (ÖÇ) Program Çıktıları (PÇ) ile Olan İlişkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">PÇ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Öğrenme Çıktıları</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">ÖÇ{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.pcMatris || []).map((pc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{pc.id}:</span> {pc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={pc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.pcMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, pcMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Sayfa 5: DÖÇ Matrisi (DÖÇ1-14) */}
        {activeStep === 5 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-900 pl-3 mb-4 uppercase tracking-widest">Ders Öğrenim Çıktılarının (ÖÇ) İAA Disipline Özgü Çıktılar (DÖÇ) ile Olan İlişkisi</h3>
              <p className="text-[10px] text-slate-400 mb-6 font-bold">(5: Çok yüksek, 4: Yüksek, 3: Orta, 2: Düşük, 1: Çok düşük)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-[10px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="border p-2 text-left">DÖÇ No / Metin</th>
                      <th colSpan={10} className="border p-2 text-center bg-blue-50 text-blue-900">Öğrenme Çıktıları</th>
                    </tr>
                    <tr className="bg-slate-50">
                      {Array(10).fill(0).map((_, i) => <th key={i} className="border p-1 w-8 text-center">ÖÇ{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.docMatris || []).map((doc: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2 w-64"><span className="font-black text-blue-900">{doc.id}:</span> {doc.metin}</td>
                        {Array(10).fill(0).map((_, j) => (
                          <td key={j} className="border p-1">
                            <input className="w-full text-center outline-none bg-transparent font-black" value={doc.ocValues[j]} maxLength={1} onChange={e => {
                              const newM = [...formData.docMatris]; newM[i].ocValues[j] = e.target.value; setFormData({...formData, docMatris: newM});
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Navigation Dots */}
        <div className="mt-12 flex items-center justify-between">
          <button onClick={() => setActiveStep(prev => Math.max(1, prev - 1))} disabled={activeStep === 1} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Önceki Sayfa
          </button>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${activeStep === s ? 'bg-blue-600 w-6' : 'bg-slate-300'}`} />
            ))}
          </div>
          <button onClick={() => setActiveStep(prev => Math.min(5, prev + 1))} disabled={activeStep === 5} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-black text-[10px] px-4 py-2 disabled:opacity-30 transition-colors uppercase tracking-widest">
            Sonraki Sayfa <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4. Aşama: Sınav ve Değerlendirme Arşivi (Korumalı Kurumsal Alan) */}
        <div className="mt-12 bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {tArsiv('title')}
                </h3>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  {tArsiv('badge')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tArsiv('confidential_note')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {arsivListesi.length > 1 && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-600">{tArsiv('instructor_archive_select')}</span>
                  <select
                    value={selectedHocaId}
                    onChange={e => handleHocaArsivChange(e.target.value)}
                    className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {arsivListesi.map(item => (
                      <option key={item.hoca_id} value={item.hoca_id}>
                        {item.profiller?.tam_adi || item.profiller?.email || item.hoca_id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {arsivSaving && (
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" /> {tArsiv('archive_updating')}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* 1. Vize Soruları */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tArsiv('midterm_questions')}</span>
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-[11px] text-slate-500 mb-4">{tArsiv('midterm_desc')}</p>
                {sinavArsivi.vize_sorulari ? (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4">
                    <p className="text-xs font-bold text-slate-800 truncate" title={sinavArsivi.vize_sorulari.name}>
                      {sinavArsivi.vize_sorulari.name}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {sinavArsivi.vize_sorulari.size ? `${sinavArsivi.vize_sorulari.size} KB` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs mb-4">
                    {tArsiv('not_uploaded_yet')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {sinavArsivi.vize_sorulari ? (
                  <>
                    <a
                      href={sinavArsivi.vize_sorulari.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> {tArsiv('download')}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleArsivDelete('vize_sorulari')}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title={tArsiv('remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={e => handleArsivUpload('vize_sorulari', e)}
                      disabled={uploadingField === 'vize_sorulari'}
                    />
                    <span className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center block transition-all shadow-sm">
                      {uploadingField === 'vize_sorulari' ? tArsiv('uploading') : tArsiv('upload_question_file')}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* 2. Final Soruları */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tArsiv('final_questions')}</span>
                  <FileText className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500 mb-4">{tArsiv('final_desc')}</p>
                {sinavArsivi.final_sorulari ? (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4">
                    <p className="text-xs font-bold text-slate-800 truncate" title={sinavArsivi.final_sorulari.name}>
                      {sinavArsivi.final_sorulari.name}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {sinavArsivi.final_sorulari.size ? `${sinavArsivi.final_sorulari.size} KB` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs mb-4">
                    {tArsiv('not_uploaded_yet')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {sinavArsivi.final_sorulari ? (
                  <>
                    <a
                      href={sinavArsivi.final_sorulari.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> {tArsiv('download')}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleArsivDelete('final_sorulari')}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title={tArsiv('remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={e => handleArsivUpload('final_sorulari', e)}
                      disabled={uploadingField === 'final_sorulari'}
                    />
                    <span className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center block transition-all shadow-sm">
                      {uploadingField === 'final_sorulari' ? tArsiv('uploading') : tArsiv('upload_question_file')}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* 3. Cevap Anahtarı */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tArsiv('answer_key')}</span>
                  <FileCheck className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-[11px] text-slate-500 mb-4">{tArsiv('answer_key_desc')}</p>
                {sinavArsivi.cevap_anahtari ? (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4">
                    <p className="text-xs font-bold text-slate-800 truncate" title={sinavArsivi.cevap_anahtari.name}>
                      {sinavArsivi.cevap_anahtari.name}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {sinavArsivi.cevap_anahtari.size ? `${sinavArsivi.cevap_anahtari.size} KB` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs mb-4">
                    {tArsiv('not_uploaded_yet')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {sinavArsivi.cevap_anahtari ? (
                  <>
                    <a
                      href={sinavArsivi.cevap_anahtari.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex-1 py-2 px-3 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> {tArsiv('download')}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleArsivDelete('cevap_anahtari')}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title={tArsiv('remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={e => handleArsivUpload('cevap_anahtari', e)}
                      disabled={uploadingField === 'cevap_anahtari'}
                    />
                    <span className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center block transition-all shadow-sm">
                      {uploadingField === 'cevap_anahtari' ? tArsiv('uploading') : tArsiv('upload_answer_key')}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* 4. Öğrenci Kağıtları (En fazla 3 dosya: En Yüksek, Orta, En Düşük) */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tArsiv('student_papers')}</span>
                  <GraduationCap className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-[11px] text-slate-500 mb-3">{tArsiv('student_papers_desc')}</p>

                <div className="space-y-2 mb-4">
                  {(['en_yuksek', 'orta', 'en_dusuk'] as const).map(duzey => {
                    const existingKagit = sinavArsivi.ogrenci_kagitlari.find(k => k.duzey === duzey);
                    const duzeyLabels: Record<string, { label: string; color: string }> = {
                      en_yuksek: { label: tArsiv('level_high'), color: 'bg-emerald-100 text-emerald-800' },
                      orta: { label: tArsiv('level_mid'), color: 'bg-blue-100 text-blue-800' },
                      en_dusuk: { label: tArsiv('level_low'), color: 'bg-amber-100 text-amber-800' },
                    };

                    return (
                      <div key={duzey} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${duzeyLabels[duzey].color}`}>
                            {duzeyLabels[duzey].label}
                          </span>
                          {existingKagit ? (
                            <p className="text-[11px] font-bold text-slate-800 truncate mt-1" title={existingKagit.name}>
                              {existingKagit.name}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mt-1">{tArsiv('not_uploaded_yet')}</p>
                          )}
                        </div>

                        {existingKagit ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={existingKagit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title={tArsiv('download')}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleArsivDelete('ogrenci_kagitlari', duzey)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title={tArsiv('remove')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer shrink-0">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={e => handleArsivUpload('ogrenci_kagitlari', e, duzey)}
                              disabled={uploadingField === `ogrenci_kagitlari_${duzey}`}
                            />
                            <span className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all block">
                              {uploadingField === `ogrenci_kagitlari_${duzey}` ? tArsiv('uploading') : `+ ${tArsiv('upload_file')}`}
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
