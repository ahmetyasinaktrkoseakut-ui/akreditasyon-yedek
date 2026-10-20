'use client';

import React from 'react';
import { usePresentationMode } from "@/contexts/PresentationModeContext";
import { EyeOff } from 'lucide-react';

export default function DashboardShellClient({
  sidebar,
  header,
  footer,
  children,
}: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isPresentationMode, setIsPresentationMode } = usePresentationMode();

  return (
    <div className={`flex h-screen bg-slate-900 text-slate-800 font-sans overflow-hidden ${isPresentationMode ? 'presentation-mode' : ''}`}>
      {!isPresentationMode && sidebar}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Sunum Modu Çıkış Çubuğu */}
        {isPresentationMode && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2.5 flex items-center justify-between text-xs font-bold tracking-wide shadow-md z-50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
              <span>DENETÇİ / SUNUM MODU AKTİF (SALT OKUNUR)</span>
            </div>
            <button
              onClick={() => setIsPresentationMode(false)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Sunum Modundan Çık</span>
            </button>
          </div>
        )}

        {header}

        {/* Scrollable İçerik ve Düzeltilmiş Alt Banner */}
        <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col min-h-0">
          <div className="flex-1 min-h-full flex flex-col justify-between">
            <div className="flex-1">
              {children}
            </div>
            {!isPresentationMode && footer}
          </div>
        </div>
      </main>
    </div>
  );
}
