'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, Highlighter, Pencil, Trash2, Check, RefreshCw, Eye, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface EvidenceDoc {
  name: string;
  url: string;
  size?: number;
  highlight_note?: string;
  page_number?: number | string;
  is_annotated?: boolean;
  annotated_url?: string;
}

interface EvidenceAnnotatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: EvidenceDoc | null;
  docIndex: number;
  onSaveAnnotatedDoc: (updatedDoc: EvidenceDoc, oldUrlToDelete?: string) => void;
  isReadOnly?: boolean;
}

export default function EvidenceAnnotatorModal({
  isOpen,
  onClose,
  doc,
  docIndex,
  onSaveAnnotatedDoc,
  isReadOnly = false,
}: EvidenceAnnotatorModalProps) {
  const [highlightNote, setHighlightNote] = useState('');
  const [pageNumber, setPageNumber] = useState<number | string>(1);
  const [selectedTool, setSelectedTool] = useState<'highlighter' | 'box' | 'text'>('highlighter');
  const [highlightColor, setHighlightColor] = useState('#fef08a'); // Soft Yellow
  const [isSaving, setIsSaving] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  // Canvas for Image Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isImage = doc?.name ? /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name) : false;
  const isPdf = doc?.name ? /\.pdf$/i.test(doc.name) : false;

  useEffect(() => {
    if (doc) {
      setHighlightNote(doc.highlight_note || '');
      setPageNumber(doc.page_number || 1);
      setReplacementFile(null);
      setImageLoaded(false);
    }
  }, [doc]);

  // Load Image onto Canvas when modal opens for image files
  useEffect(() => {
    if (isOpen && isImage && doc?.url && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = doc.url;
      img.onload = () => {
        canvas.width = img.width > 1200 ? 1200 : img.width;
        const scale = canvas.width / img.width;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageLoaded(true);
        // Save initial state to history
        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
      };
    }
  }, [isOpen, isImage, doc]);

  if (!isOpen || !doc) return null;

  // Handle Image Canvas Drawing (Highlighter / Box)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    setIsDrawing(true);
    setDrawStart({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const currentY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const width = currentX - drawStart.x;
    const height = currentY - drawStart.y;

    if (selectedTool === 'highlighter') {
      // Draw Yellow Highlighter Bar
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)'; // Semi-transparent yellow
      ctx.fillRect(drawStart.x, drawStart.y, width || 200, height || 40);
      ctx.restore();
    } else if (selectedTool === 'box') {
      // Draw Red Border Highlight Box
      ctx.save();
      ctx.strokeStyle = '#dc2626'; // Bold Red
      ctx.lineWidth = 4;
      ctx.strokeRect(drawStart.x, drawStart.y, width || 200, height || 100);
      ctx.restore();
    }

    // Save state to history
    const newSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, newSnapshot]);
    setIsDrawing(false);
    setDrawStart(null);
  };

  const handleUndo = () => {
    if (history.length <= 1 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = history.slice(0, history.length - 1);
    const lastSnapshot = newHistory[newHistory.length - 1];
    ctx.putImageData(lastSnapshot, 0, 0);
    setHistory(newHistory);
  };

  const handleSaveAnnotated = async () => {
    setIsSaving(true);
    try {
      let finalUrl = doc.url;
      let oldUrlToDelete: string | undefined = undefined;

      // 1. If replacement file is selected (Düzelt / Yeni Dosya Yükle)
      if (replacementFile) {
        oldUrlToDelete = doc.url; // Mark old file for deletion from Supabase Storage

        const fileExt = replacementFile.name.split('.').pop();
        const newFileName = `annotated_${Date.now()}_${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, replacementFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
        finalUrl = publicUrlData.publicUrl;
      } 
      // 2. If it's an image canvas drawing, export canvas to PNG blob & upload
      else if (isImage && canvasRef.current && history.length > 1) {
        const canvas = canvasRef.current;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (blob) {
          oldUrlToDelete = doc.annotated_url || undefined;
          const newFileName = `marked_${Date.now()}_${doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.png`;
          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, blob);
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
            finalUrl = publicUrlData.publicUrl;
          }
        }
      }

      // Format final target PDF URL with #page=X if PDF
      let displayUrl = finalUrl;
      if (isPdf && pageNumber) {
        const baseUrl = finalUrl.split('#')[0];
        displayUrl = `${baseUrl}#page=${pageNumber}`;
      }

      const updatedDoc: EvidenceDoc = {
        ...doc,
        name: replacementFile ? replacementFile.name : doc.name,
        url: displayUrl,
        size: replacementFile ? Math.round(replacementFile.size / 1024) : doc.size,
        highlight_note: highlightNote,
        page_number: pageNumber,
        is_annotated: true,
        annotated_url: finalUrl !== doc.url ? finalUrl : doc.annotated_url
      };

      onSaveAnnotatedDoc(updatedDoc, oldUrlToDelete);
      onClose();
    } catch (err: any) {
      console.error('Annotation save error:', err);
      alert(`İşaretleme kaydedilirken hata oluştu: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Highlighter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Kanıt İşaretleme & Düzenleme Editörü
                <span className="px-2 py-0.5 text-xs bg-amber-500 text-slate-950 font-bold rounded-full">
                  Urfa Özel
                </span>
              </h3>
              <p className="text-xs text-slate-300 truncate max-w-md" title={doc.name}>
                {doc.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          
          {/* Top Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong>Kanıt Vurgulama Rehberi:</strong> Yüklediğiniz belgenin ilgili sayfasını (örn: 5. Sayfa), gösterilmek istenen paragrafı veya fosforlu kalemle çizilecek bölümünü belirleyebilirsiniz. <strong>"Düzelt / Yenisiyle Değiştir"</strong> seçeneği ile eski dosya sunucudan temizlenir, yenisi yerini alır.
            </div>
          </div>

          {/* Form Fields: Page & Highlight Note */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Page Number (especially for PDFs or multi-page docs) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                İlgili Sayfa No / Bölüm:
              </label>
              <input
                type="text"
                value={pageNumber}
                onChange={e => setPageNumber(e.target.value)}
                disabled={isReadOnly}
                placeholder="Örn: Sayfa 5 veya Paragraf 2"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Highlight Note */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vurgu / İşaretleme Açıklama Notu:
              </label>
              <input
                type="text"
                value={highlightNote}
                onChange={e => setHighlightNote(e.target.value)}
                disabled={isReadOnly}
                placeholder="Örn: Akreditasyon kalitesine ait karar 5. sayfadaki 2. paragrafta vurgulanmıştır."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Canvas or File Preview Area */}
          {isImage ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-amber-600" />
                  Görsel Üzerinde Çizim & Fosforlu Kalem İşaretleme:
                </span>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTool('highlighter')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${selectedTool === 'highlighter' ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      ✏️ Fosforlu Kalem
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTool('box')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${selectedTool === 'box' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      🔲 Kırmızı Kutucuk
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length <= 1}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-40"
                    >
                      ↩️ Geri Al
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto flex justify-center bg-slate-900/5 rounded-lg p-2 min-h-[300px]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  className="cursor-crosshair border border-slate-300 shadow-md rounded max-w-full"
                />
              </div>
            </div>
          ) : isPdf ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  PDF Belge Bağlantısı & Sayfa Yönlendirmesi:
                </span>
                <a
                  href={`${doc.url}#page=${pageNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Sayfa {pageNumber}'ı Aç / Gör
                </a>
              </div>
              <div className="p-4 bg-slate-100 rounded-lg text-xs text-slate-600 flex flex-col items-center justify-center gap-2 min-h-[120px] text-center border border-dashed border-slate-300">
                <p className="font-semibold text-slate-800">
                  📄 {doc.name} (PDF Belgesi)
                </p>
                <p className="max-w-md text-slate-500">
                  PDF belgesi değerlendirici veya yönetici tarafından açıldığında otomatik olarak <strong>{pageNumber}. Sayfaya</strong> odaklanacaktır.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Doküman / Word Belgesi Önizleme & İşaretleme:
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-600 flex flex-col items-center justify-center gap-2 min-h-[120px] text-center border border-dashed border-slate-300">
                <p className="font-semibold text-slate-800">📝 {doc.name}</p>
                <p className="text-slate-500">
                  Yukarıdaki sayfa ve vurgu notu alanı sayesinde bu belgenin hangi paragrafının veya bölümünün akreditasyon kanıtı olduğu belirtilmiştir.
                </p>
              </div>
            </div>
          )}

          {/* DÜZELT / YENİSİYLE DEĞİŞTİR (Replace File option) */}
          {!isReadOnly && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  Kanıtı Düzelt / Yenisiyle Değiştir (Eskisi Sunucudan Silinir):
                </span>
                <button
                  type="button"
                  onClick={() => setReplacingFile(!replacingFile)}
                  className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  {replacingFile ? 'İptal Et' : '🔄 Yeni İşaretli Dosya Yükle'}
                </button>
              </div>

              {replacingFile && (
                <div className="p-3 bg-emerald-50/50 border border-dashed border-emerald-300 rounded-lg space-y-2">
                  <p className="text-xs text-emerald-800">
                    Bilgisayarınızda önceden işaretlediğiniz veya düzelttiğiniz yeni kanıt dosyasını seçin. <strong>Eski dosya sunucudan otomatik silinecektir.</strong>
                  </p>
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setReplacementFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-xs text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                  {replacementFile && (
                    <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Seçilen Yeni Dosya: {replacementFile.name} ({Math.round(replacementFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Kapat / İptal
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveAnnotated}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSaving ? 'İşaretleme Kaydediliyor...' : 'İşaretlemeyi & Düzeltmeyi Kaydet'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
