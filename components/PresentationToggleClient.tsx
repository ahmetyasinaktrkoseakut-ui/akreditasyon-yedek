'use client';

import React from 'react';
import { usePresentationMode } from '@/contexts/PresentationModeContext';
import { Presentation, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PresentationToggleClient() {
  const { isPresentationMode, setIsPresentationMode } = usePresentationMode();
  const t = useTranslations('PresentationMode');

  return (
    <button
      type="button"
      onClick={() => setIsPresentationMode(prev => !prev)}
      title={isPresentationMode ? t('exit') : t('badge')}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
        isPresentationMode
          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm animate-pulse'
          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
    >
      <Presentation className={`w-4 h-4 ${isPresentationMode ? 'text-slate-950' : 'text-blue-600'}`} />
      <span className="hidden md:inline">
        {isPresentationMode ? t('exit') : t('badge')}
      </span>
      {isPresentationMode && (
        <span className="w-2 h-2 rounded-full bg-slate-950"></span>
      )}
    </button>
  );
}
