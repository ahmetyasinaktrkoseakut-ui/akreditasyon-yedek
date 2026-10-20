'use client';

import React, { createContext, useContext, useState } from 'react';

interface PresentationModeContextType {
  isPresentationMode: boolean;
  setIsPresentationMode: (val: boolean | ((prev: boolean) => boolean)) => void;
}

const PresentationModeContext = createContext<PresentationModeContextType>({
  isPresentationMode: false,
  setIsPresentationMode: () => {},
});

export function PresentationModeProvider({ children }: { children: React.ReactNode }) {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  return (
    <PresentationModeContext.Provider value={{ isPresentationMode, setIsPresentationMode }}>
      {children}
    </PresentationModeContext.Provider>
  );
}

export function usePresentationMode() {
  return useContext(PresentationModeContext);
}
