'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Eye, Edit3, Lock, GraduationCap, ArrowRight, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DONEM_SECENEKLERI = [
  'I. YARIYIL',
  'II. YARIYIL',
  'III. YARIYIL',
  'IV. YARIYIL',
  'V. YARIYIL',
  'VI. YARIYIL',
  'VII. YARIYIL',
  'VIII. YARIYIL',
  'SEÇMELİ I DERSLERİ',
  'SEÇMELİ II DERSLERİ',
  'SEÇMELİ III DERSLERİ',
  'SEÇMELİ IV DERSLERİ',
  'SEÇMELİ V DERSLERİ',
  'SEÇMELİ VI DERSLERİ',
];

const DIL_SECENEKLERI = ['Türkçe', 'Arapça', 'İngilizce', 'İbranice'];

interface IzlenceListClientProps {
  initialDersler: any[];
  izlenceler: any[];
  user: any;
  kategoriler: string[];
  isAuthorizedToEdit?: boolean;
  isAdmin?: boolean;
}

const getSortOrder = (text: string) => {
  const romanVals: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  };
  if (text.includes('.')) {
    const roman = text.split('.')[0];
    return romanVals[roman] || 99;
  }
  const match = text.match(/SEÇMELİ\s+([IVX]+)/i);
  if (match && romanVals[match[1]]) return romanVals[match[1]] + 10;
  return 99;
};

export default function IzlenceListClient({
  initialDersler,
  izlenceler,
  user,
  kategoriler,
  isAuthorizedToEdit,
  isAdmin = false,
}: IzlenceListClientProps) {
  const router = useRouter();
  const [addedCourses, setAddedCourses] = useState<any[]>([]);
  const [deletedKods, setDeletedKods] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('HEPSİ');

  // Yönetici: Yeni Ders Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingKod, setDeletingKod] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    kod: '',
    ad: '',
    yariyil: 'I. YARIYIL',
    tur: 'Z',
    dil: 'Türkçe',
    t: '2',
    u: '0',
    l: '0',
    kredi: '2',
    akts: '3',
  });

  const derslerList = useMemo(() => {
    const deletedSet = new Set(deletedKods);
    const existingKods = new Set(initialDersler.map(d => d.kod));
    const filteredBase = initialDersler.filter(d => !deletedSet.has(d.kod));
    const extraAdded = addedCourses.filter(d => !deletedSet.has(d.kod) && !existingKods.has(d.kod));
    return [...filteredBase, ...extraAdded];
  }, [initialDersler, addedCourses, deletedKods]);

  const allKategoriler = useMemo(() => {
    const merged = Array.from(new Set([...kategoriler, ...derslerList.map(d => d.yariyil).filter(Boolean)]));
    return merged.sort((a, b) => getSortOrder(a) - getSortOrder(b));
  }, [kategoriler, derslerList]);

  const filteredDersler = useMemo(() => {
    return derslerList.filter(ders => {
      const matchesSearch =
        (ders.ad || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ders.kod || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesKategori = selectedKategori === 'HEPSİ' || ders.yariyil === selectedKategori;
      return matchesSearch && matchesKategori;
    });
  }, [derslerList, searchTerm, selectedKategori]);

  const activeKategoriler = useMemo(() => {
    if (selectedKategori !== 'HEPSİ') return [selectedKategori];
    return allKategoriler;
  }, [allKategoriler, selectedKategori]);

  const isTrulyFilled = (icerik: any) => {
    if (!icerik) return false;
    return Boolean(
      (icerik.amac && String(icerik.amac).trim().length > 0) ||
      (icerik.ogretimElemani && String(icerik.ogretimElemani).trim().length > 0) ||
      (Array.isArray(icerik.ogrenimCiktilari) && icerik.ogrenimCiktilari.some((oc: any) => oc && oc.cikti && String(oc.cikti).trim().length > 0))
    );
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/dersler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kod: newCourse.kod.trim(),
          ad: newCourse.ad.trim(),
          yariyil: newCourse.yariyil,
          tur: newCourse.tur,
          dil: newCourse.dil,
          t: Number(newCourse.t || 0),
          u: Number(newCourse.u || 0),
          l: Number(newCourse.l || 0),
          kredi: Number(newCourse.kredi || 0),
          akts: Number(newCourse.akts || 0),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Ders eklenirken bir hata oluştu.');
        return;
      }

      if (json.data) {
        setDeletedKods(prev => prev.filter(k => k !== json.data.kod));
        setAddedCourses(prev => [...prev, json.data]);
      }
      toast.success('Ders başarıyla eklendi.');
      setIsAddModalOpen(false);
      setNewCourse({
        kod: '',
        ad: '',
        yariyil: newCourse.yariyil,
        tur: 'Z',
        dil: 'Türkçe',
        t: '2',
        u: '0',
        l: '0',
        kredi: '2',
        akts: '3',
      });
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (ders: any) => {
    const confirmed = window.confirm(
      `"${ders.kod} - ${ders.ad}" dersini silmek istediğinize emin misiniz?\n\nDİKKAT: Bu işlem derse bağlı tüm doldurulmuş izlence kayıtlarını da kalıcı olarak siler.`
    );
    if (!confirmed) return;

    setDeletingKod(ders.kod);
    try {
      const res = await fetch(`/api/dersler?kod=${encodeURIComponent(ders.kod)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Ders silinirken bir hata oluştu.');
        return;
      }

      setDeletedKods(prev => [...prev, ders.kod]);
      setAddedCourses(prev => prev.filter(item => item.kod !== ders.kod));
      toast.success(`"${ders.ad}" dersi silindi.`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Silme işlemi sırasında bağlantı hatası oluştu.');
    } finally {
      setDeletingKod(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-blue-100 flex flex-col md:flex-row gap-4 items-center sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Ders adı veya kodu ile ara..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="text-blue-600 w-5 h-5 hidden md:block" />
          <select
            className="flex-1 md:flex-none bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 cursor-pointer"
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
          >
            <option value="HEPSİ">TÜM DÖNEMLER</option>
            {allKategoriler.map(kat => (
              <option key={kat} value={kat}>{kat}</option>
            ))}
          </select>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                if (selectedKategori !== 'HEPSİ' && DONEM_SECENEKLERI.includes(selectedKategori)) {
                  setNewCourse(prev => ({ ...prev, yariyil: selectedKategori }));
                }
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm px-4 py-3 rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Yeni Ders Ekle
            </button>
          )}
        </div>
      </div>

      {/* Curriculum Tables */}
      <div className="space-y-12">
        {activeKategoriler.map((kat) => {
          const katDersleri = filteredDersler.filter(d => d.yariyil === kat);
          if (katDersleri.length === 0) return null;

          return (
            <div key={kat} className="overflow-hidden shadow-2xl border border-blue-100 rounded-2xl bg-white transition-all hover:shadow-blue-900/5">
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 py-4 text-center">
                <h2 className="text-lg font-black text-white tracking-[0.2em] uppercase">{kat}</h2>
              </div>

              <div className="overflow-x-auto">
                {/* Masaüstü Görünüm (Tablo) */}
                <table className="w-full border-collapse text-[13px] hidden md:table">
                  <thead>
                    <tr className="bg-slate-50 text-blue-900 font-bold border-b border-blue-100">
                      <th rowSpan={2} className="p-4 w-28 text-center">Ders Kodu</th>
                      <th rowSpan={2} className="p-4 w-16 text-center border-x border-blue-50">Türü</th>
                      <th rowSpan={2} className="p-4 text-left">Dersin Adı</th>
                      <th colSpan={3} className="p-2 text-center bg-blue-50/50 border-x border-blue-50 text-[10px] tracking-widest uppercase">Kredi Dağılımı</th>
                      <th rowSpan={2} className="p-4 w-24 text-center border-x border-blue-50">Ders Dili</th>
                      <th rowSpan={2} className="p-4 w-16 text-center">Kredi</th>
                      <th rowSpan={2} className="p-4 w-16 text-center border-l border-blue-50">AKTS</th>
                      {isAdmin && (
                        <th rowSpan={2} className="p-4 w-20 text-center border-l border-blue-50">İşlem</th>
                      )}
                    </tr>
                    <tr className="bg-slate-50 text-blue-900 font-bold border-b border-blue-100">
                      <th className="p-2 w-12 text-center border-x border-blue-50 bg-blue-50/30">T</th>
                      <th className="p-2 w-12 text-center border-r border-blue-50 bg-blue-50/30">U</th>
                      <th className="p-2 w-12 text-center border-r border-blue-50 bg-blue-50/30">L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {katDersleri.map((ders, idx) => {
                      const izlence = (izlenceler || []).find(i => i.ders_id === ders.kod);
                      const isFilled = isTrulyFilled(izlence?.icerik);

                      const isPlaceholder = ders.kod === '-' || ders.ad.toLowerCase().includes('seçmeli');
                      const canEdit = isAuthorizedToEdit && !isPlaceholder;
                      const canView = isFilled && !isPlaceholder;
                      const canDelete = isAdmin && ders.kod !== '-';

                      return (
                        <tr key={`${ders.kod}-${ders.ad}-${idx}`} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="p-4 text-center font-mono font-bold text-slate-400 group-hover:text-blue-600 transition-colors">{ders.kod}</td>
                          <td className="p-4 text-center font-black text-blue-900 border-x border-slate-50">{ders.tur}</td>
                          <td className="p-4 font-bold">
                            {canEdit ? (
                              <Link href={`/ders-izlenceleri?kod=${ders.kod}`} className="text-blue-700 hover:text-blue-900 flex items-center justify-between group/link">
                                <span className="group-hover/link:underline">{ders.ad}</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  DÜZENLE <Edit3 className="w-3 h-3" />
                                </div>
                              </Link>
                            ) : canView ? (
                              <Link href={`/izlenceler/${ders.kod}`} className="text-blue-700 hover:text-blue-900 flex items-center justify-between group/link">
                                <span className="group-hover/link:underline">{ders.ad}</span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  GÖRÜNTÜLE <Eye className="w-3 h-3" />
                                </div>
                              </Link>
                            ) : (
                              <div className="text-slate-400 flex items-center justify-between">
                                <span>{ders.ad}</span>
                                {!isPlaceholder && (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300">
                                    <Lock className="w-3 h-3" /> HENÜZ DOLMADI
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold border-x border-slate-50">{ders.t}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50">{ders.u}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50">{ders.l}</td>
                          <td className="p-4 text-center font-bold border-r border-slate-50 text-slate-500">{ders.dil || 'Türkçe'}</td>
                          <td className="p-4 text-center font-bold text-blue-900">{ders.kredi}</td>
                          <td className="p-4 text-center font-black text-blue-900 border-l border-slate-50 bg-blue-50/20">{ders.akts}</td>
                          {isAdmin && (
                            <td className="p-3 text-center border-l border-slate-50">
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCourse(ders)}
                                  disabled={deletingKod === ders.kod}
                                  title="Dersi Sil"
                                  className="inline-flex items-center justify-center p-2 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {deletingKod === ders.kod ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobil Görünüm (Kartlar) */}
                <div className="grid grid-cols-1 gap-4 p-4 md:hidden bg-slate-50">
                  {katDersleri.map((ders, idx) => {
                    const izlence = (izlenceler || []).find(i => i.ders_id === ders.kod);
                    const isFilled = isTrulyFilled(izlence?.icerik);

                    const isPlaceholder = ders.kod === '-' || ders.ad.toLowerCase().includes('seçmeli');
                    const canEdit = isAuthorizedToEdit && !isPlaceholder;
                    const canView = isFilled && !isPlaceholder;
                    const canDelete = isAdmin && ders.kod !== '-';

                    return (
                      <div key={`mobile-${ders.kod}-${idx}`} className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-blue-700 text-sm">{ders.kod}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase mt-1">{ders.tur} • {ders.dil || 'Türkçe'}</span>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-1 rounded">Kredi: {ders.kredi}</div>
                            <div className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-1 rounded">AKTS: {ders.akts}</div>
                          </div>
                        </div>

                        <h3 className="font-bold text-slate-800 text-sm mb-4 leading-snug">{ders.ad}</h3>

                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 gap-2">
                          <div className="flex gap-2 text-[11px] font-black text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded">T: {ders.t}</span>
                            <span className="bg-slate-100 px-2 py-1 rounded">U: {ders.u}</span>
                            <span className="bg-slate-100 px-2 py-1 rounded">L: {ders.l}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCourse(ders)}
                                disabled={deletingKod === ders.kod}
                                title="Dersi Sil"
                                className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                              >
                                {deletingKod === ders.kod ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            {canEdit ? (
                              <Link href={`/ders-izlenceleri?kod=${ders.kod}`} className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-amber-100">
                                DÜZENLE <Edit3 className="w-3 h-3" />
                              </Link>
                            ) : canView ? (
                              <Link href={`/izlenceler/${ders.kod}`} className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-emerald-100">
                                GÖRÜNTÜLE <Eye className="w-3 h-3" />
                              </Link>
                            ) : (
                              <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                <Lock className="w-3 h-3" /> HENÜZ DOLMADI
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {filteredDersler.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <GraduationCap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest">Aradığınız kriterlere uygun ders bulunamadı.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedKategori('HEPSİ'); }}
              className="mt-4 text-blue-600 font-black hover:underline flex items-center gap-2 mx-auto"
            >
              Tüm dersleri göster <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Yönetici: Yeni Ders Ekleme Modalı */}
      {isAdmin && isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Yeni Ders / Şube Ekle</h3>
                <p className="text-xs text-slate-500 mt-0.5">Eklenen ders seçtiğiniz dönemin tablosunda anında görünür.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Dönem (Yarıyıl)</label>
                  <select
                    required
                    value={newCourse.yariyil}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, yariyil: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {DONEM_SECENEKLERI.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ders Kodu</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 181115041-B"
                    value={newCourse.kod}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, kod: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Dersin Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Din Eğitimi (B Şubesi)"
                  value={newCourse.ad}
                  onChange={(e) => setNewCourse(prev => ({ ...prev, ad: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ders Türü</label>
                  <select
                    value={newCourse.tur}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, tur: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="Z">Z (Zorunlu)</option>
                    <option value="S">S (Seçmeli)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ders Dili</label>
                  <select
                    value={newCourse.dil}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, dil: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {DIL_SECENEKLERI.map(dil => (
                      <option key={dil} value={dil}>{dil}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {[
                  { key: 't', label: 'T' },
                  { key: 'u', label: 'U' },
                  { key: 'l', label: 'L' },
                  { key: 'kredi', label: 'Kredi' },
                  { key: 'akts', label: 'AKTS' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">{label}</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={(newCourse as Record<string, string>)[key]}
                      onChange={(e) => setNewCourse(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-center text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Dersi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
