'use client';

import { ReactNode } from 'react';
import { SavedListingsProvider } from '@/contexts/SavedListingsContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SavedListingsProvider>
      {children}
    </SavedListingsProvider>
  );
}
