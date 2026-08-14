'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, Highlighter, Pencil, Trash2, Check, RefreshCw, Eye, FileText, Image as ImageIcon, Sparkles, Square, RotateCcw } from 'lucide-react';
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
  const [pageNumber, setPageNumber] = useState<number | string>('');
  const [selectedTool, setSelectedTool] = useState<'highlighter' | 'box'>('highlighter');
  const [isSaving, setIsSaving] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  // Canvas State for Freehand Image Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [boxStartPos, setBoxStartPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isImage = doc?.name ? /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name) : false;
  const isPdf = doc?.name ? /\.pdf$/i.test(doc.name) : false;
  const isOfficeDoc = doc?.name ? /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(doc.name) : false;

  useEffect(() => {
    if (doc) {
      setHighlightNote(doc.highlight_note || '');
      setPageNumber(doc.page_number || '');
      setReplacementFile(null);
      setReplacingFile(false);
      setImageLoaded(false);
      setHistory([]);
    }
  }, [doc]);

  // Load Image onto Canvas when modal opens
  useEffect(() => {
    if (isOpen && isImage && doc?.url && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = doc.url;
      img.onload = () => {
        const maxWidth = 1000;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageLoaded(true);

        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
      };
    }
  }, [isOpen, isImage, doc]);

  if (!isOpen || !doc) return null;

  // Canvas Mouse Coordinates Helper
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  // Canvas Freehand Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly || !canvasRef.current) return;
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    setBoxStartPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPos || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    if (selectedTool === 'highlighter') {
      // Freehand Highlighter Brush Stroke (Yellow Marker)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)'; // Semi-transparent bright yellow
      ctx.lineWidth = 24;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      setLastPos(currentPos);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    if (selectedTool === 'box' && boxStartPos) {
      // Draw Red Border Highlight Rectangle Box
      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626'; // Bold Red
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }

    // Save state snapshot for Undo
    const snapshot = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHistory(prev => [...prev, snapshot]);

    setIsDrawing(false);
    setLastPos(null);
    setBoxStartPos(null);
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

      // 1. If user uploaded a new replacement file ("Düzelt / Yenisiyle Değiştir")
      if (replacementFile) {
        oldUrlToDelete = doc.url; // Mark old file for deletion from Supabase Storage

        const fileExt = replacementFile.name.split('.').pop();
        const newFileName = `duzeltilmis_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
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
          const cleanName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const newFileName = `isaretli_${Date.now()}_${cleanName}.png`;
          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, blob);
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
            finalUrl = publicUrlData.publicUrl;
          }
        }
      }

      // Format final PDF URL with target page number parameter `#page=X`
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

  const pdfPreviewUrl = isPdf ? `${doc.url.split('#')[0]}${pageNumber ? `#page=${pageNumber}` : ''}` : '';
  const officePreviewUrl = isOfficeDoc ? `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Highlighter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Kanıt İşaretleme & Düzenleme Editörü
              </h3>
              <p className="text-xs text-slate-300 truncate max-w-lg" title={doc.name}>
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
              <strong>Kanıt Vurgulama & Düzeltme Rehberi:</strong> Belgenizin ilgili sayfasını (örn: Sayfa 5), gösterilmek istenen paragraf notunu ekleyebilir veya canlı önizleme ekranından belgeyi inceleyebilirsiniz. <strong>"Düzelt / Yenisiyle Değiştir"</strong> butonu ile bilgisayarınızdaki yeni dosyayı yüklediğinizde <strong>eski dosya sunucudan otomatik silinir.</strong>
            </div>
          </div>

          {/* Form Fields: Page & Highlight Note */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            
            {/* Page Number / Section input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                İlgili Sayfa No / Bölüm:
              </label>
              <input
                type="text"
                value={pageNumber}
                onChange={e => setPageNumber(e.target.value)}
                disabled={isReadOnly}
                placeholder="Örn: 5 veya Paragraf 2"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-semibold"
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
                placeholder="Örn: 5. sayfadaki 2. paragraf akreditasyon kalite kanıtıdır."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* LIVE PREVIEW & DRAWING AREA */}
          {isImage ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-amber-600" />
                  Görsel Üzerinde Serbest Çizim & Fosforlu Kalem İşaretleme:
                </span>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTool('highlighter')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 ${selectedTool === 'highlighter' ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                      Fosforlu Kalem
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTool('box')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 ${selectedTool === 'box' ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <Square className="w-3.5 h-3.5" />
                      Kırmızı Kutucuk
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length <= 1}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-40 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Geri Al
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto flex justify-center bg-slate-900/5 rounded-lg p-2 min-h-[350px]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
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
                  PDF Belgesi Canlı Önizleme & Sayfa Odaklama:
                </span>
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Yeni Sekmede Aç {pageNumber ? `(Sayfa ${pageNumber})` : ''}
                </a>
              </div>
              
              {/* PDF LIVE IFRAME PREVIEW */}
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900 min-h-[450px]">
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-[480px] border-0"
                  title="PDF Canlı Önizleme"
                />
              </div>
            </div>
          ) : isOfficeDoc ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Word / Office Belgesi Canlı Önizleme:
                </span>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Orijinal Dosyayı İndir
                </a>
              </div>

              {/* OFFICE DOCS LIVE GOOGLE VIEWER PREVIEW */}
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 min-h-[450px]">
                <iframe
                  src={officePreviewUrl}
                  className="w-full h-[480px] border-0"
                  title="Word Canlı Önizleme"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  Belge Önizleme:
                </span>
              </div>
              <div className="p-6 bg-slate-50 rounded-lg text-xs text-slate-600 flex flex-col items-center justify-center gap-2 min-h-[180px] text-center border border-dashed border-slate-300">
                <p className="font-bold text-slate-800 text-sm">📄 {doc.name}</p>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                  Belgeyi Yeni Sekmede Görüntüle
                </a>
              </div>
            </div>
          )}

          {/* DÜZELT / YENİSİYLE DEĞİŞTİR (Replace File Option) */}
          {!isReadOnly && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  Kanıtı Düzelt / Yenisiyle Değiştir (Eski Dosya Sunucudan Otomatik Silinir):
                </span>
                <button
                  type="button"
                  onClick={() => setReplacingFile(!replacingFile)}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  {replacingFile ? 'İptal Et' : '🔄 Düzeltilmiş Yeni Dosya Seç'}
                </button>
              </div>

              {replacingFile && (
                <div className="p-4 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-xl space-y-3">
                  <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                    Bilgisayarınızda düzelttiğiniz yeni kanıt dosyasını seçin. <strong>İşlemi kaydettiğinizde eski dosya sunucudan tamamen silinecektir.</strong>
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
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Seçilen Yeni Dosya: {replacementFile.name} ({Math.round(replacementFile.size / 1024)} KB)
                    </div>
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
              {isSaving ? 'Kaydediliyor...' : 'İşaretleme & Düzeltmeyi Kaydet'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
