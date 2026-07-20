'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

export default function GlobalFileViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerType, setViewerType] = useState<'pdf' | 'image'>('pdf');
  const [viewerName, setViewerName] = useState('');

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        const url = anchor.href;
        const isDownload = anchor.hasAttribute('download');

        const isSupabaseFile = url.includes('/storage/v1/object/public/');
        const isPdf = url.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') || (isSupabaseFile && url.toLowerCase().includes('.pdf'));
        const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(url.split(/[?#]/)[0]) || (isSupabaseFile && (url.toLowerCase().includes('.png') || url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')));

        if ((isPdf || isImage) && !isDownload) {
          e.preventDefault();
          e.stopPropagation();
          setViewerUrl(url);
          setViewerType(isPdf ? 'pdf' : 'image');

          let name = 'Doküman';
          try {
            const decoded = decodeURIComponent(url);
            name = decoded.substring(decoded.lastIndexOf('/') + 1).split(/[?#]/)[0];
          } catch (_) {}
          setViewerName(name);
          setIsOpen(true);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(viewerUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = viewerName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (_) {
      window.open(viewerUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0f1e36] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50 dark:bg-[#0d1b30]">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-[#9e7f59] rounded-xl font-bold text-xs">
              {viewerType.toUpperCase()}
            </span>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[50vw]" title={viewerName}>
              {viewerName}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={viewerUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              title="Yeni Sekmede Aç"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button 
              onClick={handleDownload}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
              title="İndir"
            >
              <Download className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e2d4a] rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 dark:bg-[#0a1324] overflow-y-auto p-4 flex items-center justify-center min-h-[50vh]">
          {viewerType === 'pdf' ? (
            <iframe 
              src={`${viewerUrl}#toolbar=1`} 
              className="w-full h-[70vh] border-0 rounded-2xl bg-white" 
              title="PDF Viewer"
            />
          ) : (
            <img 
              src={viewerUrl} 
              alt={viewerName} 
              className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-md"
            />
          )}
        </div>
      </div>
    </div>
  );
}
