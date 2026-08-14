'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, X, Highlighter, Pencil, Trash2, Check, RefreshCw, Eye, FileText, Image as ImageIcon, Sparkles, Square, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedTool, setSelectedTool] = useState<'highlighter' | 'box'>('highlighter');
  const [isSaving, setIsSaving] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  // PDF.js & Canvas Drawing State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [renderingPdfPage, setRenderingPdfPage] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [boxStartPos, setBoxStartPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isImage = doc?.name ? /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name) : false;
  const isPdf = doc?.name ? /\.pdf$/i.test(doc.name) : false;
  const isOfficeDoc = doc?.name ? /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(doc.name) : false;

  // Dynamically Load PDF.js from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).pdfjsLib) {
      setPdfLibLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setPdfLibLoaded(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (doc) {
      setHighlightNote(doc.highlight_note || '');
      const pNum = parseInt(String(doc.page_number || 1), 10);
      setCurrentPage(isNaN(pNum) ? 1 : pNum);
      setReplacementFile(null);
      setReplacingFile(false);
      setHistory([]);
    }
  }, [doc]);

  // Render Image or PDF Page onto Canvas
  const renderDocumentToCanvas = async () => {
    if (!isOpen || !doc?.url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = doc.url;
      img.onload = () => {
        const maxWidth = 1000;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
      };
    } else if (isPdf && pdfLibLoaded && (window as any).pdfjsLib) {
      try {
        setRenderingPdfPage(true);
        const pdfjs = (window as any).pdfjsLib;
        const loadingTask = pdfjs.getDocument(doc.url.split('#')[0]);
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);

        const pageToRender = Math.min(Math.max(1, currentPage), pdf.numPages);
        const page = await pdf.getPage(pageToRender);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
      } catch (err) {
        console.error('PDF Canvas Render Error:', err);
      } finally {
        setRenderingPdfPage(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      renderDocumentToCanvas();
    }
  }, [isOpen, doc, currentPage, pdfLibLoaded]);

  if (!isOpen || !doc) return null;

  // Helper for mouse position relative to canvas
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  // Canvas Mouse Events
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
      // Smooth Freehand Yellow Highlighter Brush Stroke
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)'; // Bright semi-transparent yellow
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
      // Draw Red Border Highlight Box
      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626'; // Bold Red
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }

    // Save snapshot for Undo
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

      // 1. Replacement file upload
      if (replacementFile) {
        oldUrlToDelete = doc.url;
        const fileExt = replacementFile.name.split('.').pop();
        const newFileName = `duzeltilmis_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, replacementFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
        finalUrl = publicUrlData.publicUrl;
      } 
      // 2. Export canvas (Image or PDF page drawing)
      else if ((isImage || isPdf) && canvasRef.current && history.length > 1) {
        const canvas = canvasRef.current;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (blob) {
          oldUrlToDelete = doc.annotated_url || undefined;
          const cleanName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const newFileName = `isaretli_sayfa${currentPage}_${Date.now()}_${cleanName}.png`;
          const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(newFileName, blob);
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('dokumanlar').getPublicUrl(newFileName);
            finalUrl = publicUrlData.publicUrl;
          }
        }
      }

      let displayUrl = finalUrl;
      if (isPdf && currentPage) {
        const baseUrl = finalUrl.split('#')[0];
        displayUrl = `${baseUrl}#page=${currentPage}`;
      }

      const updatedDoc: EvidenceDoc = {
        ...doc,
        name: replacementFile ? replacementFile.name : doc.name,
        url: displayUrl,
        size: replacementFile ? Math.round(replacementFile.size / 1024) : doc.size,
        highlight_note: highlightNote,
        page_number: currentPage,
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

  const officePreviewUrl = isOfficeDoc ? `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}&embedded=true` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between">
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

        {/* TOP DRAWING & NAVIGATION TOOLBAR */}
        <div className="px-6 py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
          
          {/* Drawing Tools */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase mr-1">Çizim Araçları:</span>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedTool('highlighter')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${selectedTool === 'highlighter' ? 'bg-yellow-400 text-slate-950 shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  <Highlighter className="w-4 h-4" />
                  ✏️ Fosforlu Kalem
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTool('box')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${selectedTool === 'box' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  <Square className="w-4 h-4" />
                  🔲 Kırmızı Kutucuk
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg disabled:opacity-40 flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Geri Al
                </button>
              </>
            )}
          </div>

          {/* PDF Page Navigation */}
          {isPdf && (
            <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-amber-400 whitespace-nowrap">
                Sayfa {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-100">
          
          {/* Note Input */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vurgu / İşaretleme Açıklama Notu:
            </label>
            <input
              type="text"
              value={highlightNote}
              onChange={e => setHighlightNote(e.target.value)}
              disabled={isReadOnly}
              placeholder="Örn: Akreditasyon kanıtı sarı fosforlu kalemle çizilmiştir."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* MAIN INTERACTIVE CANVAS PREVIEW AREA */}
          {(isImage || isPdf) ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b pb-2">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-amber-600" />
                  {isPdf ? `PDF Sayfa ${currentPage} Çizim Alanı (Fareyi basılı tutarak fosforlu kalemle çizin):` : 'Görsel Çizim & İşaretleme Alanı:'}
                </span>
                {renderingPdfPage && (
                  <span className="text-amber-600 flex items-center gap-1 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sayfa Yükleniyor...
                  </span>
                )}
              </div>

              <div className="overflow-x-auto flex justify-center bg-slate-900/10 rounded-lg p-2 min-h-[420px] max-h-[550px]">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="cursor-crosshair border border-slate-300 shadow-md rounded max-w-full bg-white"
                />
              </div>
            </div>
          ) : isOfficeDoc ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b pb-2">
                <span>Word / Office Belgesi Önizleme:</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 min-h-[450px]">
                <iframe
                  src={officePreviewUrl}
                  className="w-full h-[480px] border-0"
                  title="Word Canlı Önizleme"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              📄 {doc.name} (Önizleme Desteklenmiyor)
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
                <div className="p-3 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-xl space-y-2">
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
                    <div className="p-2 bg-white rounded-lg border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
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
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
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
