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

  // Pen Size & Color Options
  const [penColor, setPenColor] = useState<string>('rgba(250, 204, 21, 0.45)'); // Yellow
  const [penSize, setPenSize] = useState<number>(24); // Medium 24px

  const [isSaving, setIsSaving] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  // PDF.js, JSZip & Canvas Drawing State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [zipLibLoaded, setZipLibLoaded] = useState(false);
  const [renderingDoc, setRenderingDoc] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [boxStartPos, setBoxStartPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const isImage = doc?.name ? /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.name) : false;
  const isPdf = doc?.name ? /\.pdf$/i.test(doc.name) : false;
  const isOfficeDoc = doc?.name ? /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(doc.name) : false;

  // Dynamically Load PDF.js & JSZip from CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load PDF.js
    if (!(window as any).pdfjsLib) {
      const pScript = document.createElement('script');
      pScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      pScript.onload = () => {
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          setPdfLibLoaded(true);
        }
      };
      document.head.appendChild(pScript);
    } else {
      setPdfLibLoaded(true);
    }

    // Load JSZip for Word document parsing
    if (!(window as any).JSZip) {
      const zScript = document.createElement('script');
      zScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      zScript.onload = () => {
        setZipLibLoaded(true);
      };
      document.head.appendChild(zScript);
    } else {
      setZipLibLoaded(true);
    }
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

  // Helper to wrap text for Word doc canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  };

  // Render Image, PDF Page, or Real Word Text onto Canvas with PURE NATURAL ASPECT RATIO
  const renderDocumentToCanvas = async () => {
    if (!isOpen || !doc?.url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setRenderingDoc(true);

    try {
      if (isImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = doc.url;
        img.onload = () => {
          // Pure Natural Image Resolution -> Absolute 100% Original Aspect Ratio!
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistory([initialState]);
          setRenderingDoc(false);
        };
      } else if (isPdf && pdfLibLoaded && (window as any).pdfjsLib) {
        const pdfjs = (window as any).pdfjsLib;
        const loadingTask = pdfjs.getDocument(doc.url.split('#')[0]);
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);

        const pageToRender = Math.min(Math.max(1, currentPage), pdf.numPages);
        const page = await pdf.getPage(pageToRender);
        
        // Pure Natural PDF Resolution at 1.5x Scale -> Absolute 100% Original Aspect Ratio!
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
        setRenderingDoc(false);
      } else if (isOfficeDoc) {
        // Word Document: Standard A4 Portrait Aspect Ratio (800x1130)
        let extractedParagraphs: string[] = [];

        if (zipLibLoaded && (window as any).JSZip) {
          try {
            const res = await fetch(doc.url);
            const blob = await res.blob();
            const zip = await (window as any).JSZip.loadAsync(blob);
            const docXml = await zip.file('word/document.xml')?.async('string');
            if (docXml) {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(docXml, 'text/xml');
              const pNodes = Array.from(xmlDoc.getElementsByTagName('w:p'));
              extractedParagraphs = pNodes.map(p => {
                const tNodes = Array.from(p.getElementsByTagName('w:t'));
                return tNodes.map(t => t.textContent).join('');
              }).filter(t => t.trim().length > 0);
            }
          } catch (e) {
            console.warn('Word XML text extraction notice:', e);
          }
        }

        canvas.width = 800;
        canvas.height = Math.max(1130, 120 + (extractedParagraphs.length * 45));

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Paper Banner
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(`📄 Word Metin Belgesi: ${doc.name}`, 20, 31);

        // Render extracted Word text paragraphs
        let yPos = 80;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px sans-serif';
        yPos = wrapText(ctx, doc.name.replace(/\.[^/.]+$/, ''), 40, yPos, 720, 24);
        yPos += 10;

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, yPos);
        ctx.lineTo(760, yPos);
        ctx.stroke();
        yPos += 20;

        if (extractedParagraphs.length > 0) {
          ctx.fillStyle = '#334155';
          ctx.font = '13px sans-serif';
          for (const para of extractedParagraphs) {
            yPos = wrapText(ctx, para, 40, yPos, 720, 20);
            yPos += 12;
          }
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = 'italic 13px sans-serif';
          yPos = wrapText(ctx, "Word belgesi metinleri tuvale işlenmiştir. İlgili metinlerin üzerini yukarıdaki kalemi kullanarak çizebilirsiniz.", 40, yPos, 720, 20);
        }

        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
        setRenderingDoc(false);
      } else {
        setRenderingDoc(false);
      }
    } catch (err) {
      console.error('Document render error:', err);
      setRenderingDoc(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      renderDocumentToCanvas();
    }
  }, [isOpen, doc, currentPage, pdfLibLoaded, zipLibLoaded]);

  if (!isOpen || !doc) return null;

  // Exact Mouse Position Mapping without letterbox distortion
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
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
      // Freehand Highlighter Brush Stroke
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      setLastPos(currentPos);
    } else if (selectedTool === 'box' && boxStartPos && history.length > 0) {
      // Live Red Box Preview
      const lastSnapshot = history[history.length - 1];
      ctx.putImageData(lastSnapshot, 0, 0);

      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    if (selectedTool === 'box' && boxStartPos) {
      const width = currentPos.x - boxStartPos.x;
      const height = currentPos.y - boxStartPos.y;
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.strokeRect(boxStartPos.x, boxStartPos.y, width, height);
      ctx.restore();
    }

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
      // 2. Export canvas drawing for PDF/Image/Word
      else if (canvasRef.current && history.length > 1) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Highlighter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                Kanıt İşaretleme & Düzenleme Editörü
              </h3>
              <p className="text-[11px] text-slate-300 truncate max-w-md" title={doc.name}>
                {doc.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOP DRAWING & NAVIGATION TOOLBAR */}
        <div className="px-5 py-2.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 flex-shrink-0">
          
          {/* Drawing Tools & Size/Color Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Araçlar:</span>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedTool('highlighter')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${selectedTool === 'highlighter' ? 'bg-yellow-400 text-slate-950 shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  Fosforlu Kalem
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTool('box')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${selectedTool === 'box' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                >
                  <Square className="w-3.5 h-3.5" />
                  Kırmızı Kutucuk
                </button>

                {/* COLOR PICKER (FOR HIGHLIGHTER) */}
                {selectedTool === 'highlighter' && (
                  <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400">Renk:</span>
                    <button
                      type="button"
                      onClick={() => setPenColor('rgba(250, 204, 21, 0.45)')}
                      className={`w-4 h-4 rounded-full bg-yellow-400 border ${penColor.includes('250, 204') ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      title="Sarı"
                    />
                    <button
                      type="button"
                      onClick={() => setPenColor('rgba(34, 197, 94, 0.45)')}
                      className={`w-4 h-4 rounded-full bg-emerald-500 border ${penColor.includes('34, 197') ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      title="Yeşil"
                    />
                    <button
                      type="button"
                      onClick={() => setPenColor('rgba(59, 130, 246, 0.45)')}
                      className={`w-4 h-4 rounded-full bg-blue-500 border ${penColor.includes('59, 130') ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      title="Mavi"
                    />
                    <button
                      type="button"
                      onClick={() => setPenColor('rgba(244, 63, 94, 0.45)')}
                      className={`w-4 h-4 rounded-full bg-rose-500 border ${penColor.includes('244, 63') ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                      title="Pembe/Kırmızı"
                    />
                  </div>
                )}

                {/* BRUSH SIZE PICKER */}
                {selectedTool === 'highlighter' && (
                  <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setPenSize(12)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 12 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      İnce
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenSize(24)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 24 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      Orta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenSize(40)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${penSize === 40 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      Kalın
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 rounded-lg disabled:opacity-40 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Geri Al
                </button>
              </>
            )}
          </div>

          {/* PDF Page Navigation */}
          {isPdf && (
            <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-amber-400 whitespace-nowrap">
                Sayfa {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="p-0.5 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Body - Smooth Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100">
          
          {/* Note Input */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vurgu / İşaretleme Açıklama Notu:
            </label>
            <input
              type="text"
              value={highlightNote}
              onChange={e => setHighlightNote(e.target.value)}
              disabled={isReadOnly}
              placeholder="Örn: Akreditasyon kanıtı sarı fosforlu kalemle çizilmiştir."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          {/* MAIN INTERACTIVE CANVAS PREVIEW AREA WITH NATURAL ASPECT RATIO */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b pb-1.5">
              <span className="flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                {isPdf 
                  ? `PDF Sayfa ${currentPage} Çizim Tuvali:` 
                  : isOfficeDoc 
                  ? 'Word / Doküman Çizim & İşaretleme Tuvali:' 
                  : 'Görsel Çizim & İşaretleme Tuvali:'}
              </span>
              {renderingDoc && (
                <span className="text-amber-600 flex items-center gap-1 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor...
                </span>
              )}
            </div>

            {/* Scrollable Canvas Display Container with Pure Natural Resolution & Aspect Ratio */}
            <div className="overflow-y-auto overflow-x-auto flex justify-center bg-slate-900/10 rounded-lg p-3 max-h-[62vh]">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair border border-slate-300 shadow-md rounded bg-white block"
                style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
              />
            </div>
          </div>

          {/* DÜZELT / YENİSİYLE DEĞİŞTİR (Replace File Option) */}
          {!isReadOnly && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  Kanıtı Düzelt / Yenisiyle Değiştir:
                </span>
                <button
                  type="button"
                  onClick={() => setReplacingFile(!replacingFile)}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  {replacingFile ? 'İptal Et' : '🔄 Düzeltilmiş Yeni Dosya Seç'}
                </button>
              </div>

              {replacingFile && (
                <div className="p-2.5 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-lg space-y-2">
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setReplacementFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-xs text-slate-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                  {replacementFile && (
                    <div className="p-1.5 bg-white rounded border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Seçilen Yeni Dosya: {replacementFile.name} ({Math.round(replacementFile.size / 1024)} KB)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Kapat / İptal
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveAnnotated}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isSaving ? 'Kaydedildiği...' : 'İşaretleme & Düzeltmeyi Kaydet'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
