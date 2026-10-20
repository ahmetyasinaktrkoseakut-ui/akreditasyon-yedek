'use client';

import React from 'react';
import { usePresentationMode } from "@/contexts/PresentationModeContext";

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
  const { isPresentationMode } = usePresentationMode();

  return (
    <div className="flex h-screen bg-slate-900 text-slate-800 font-sans overflow-hidden">
      {!isPresentationMode && sidebar}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {!isPresentationMode && header}
        <div className={`flex-1 overflow-auto bg-slate-50 flex flex-col justify-between ${isPresentationMode ? 'p-0' : ''}`}>
          <div className="flex-1 flex flex-col h-full">
            {children}
          </div>
          {!isPresentationMode && footer}
        </div>
      </main>
    </div>
  );
}
