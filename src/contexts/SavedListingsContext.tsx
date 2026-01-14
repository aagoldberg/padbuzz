'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSavedListings, SavedListing } from '@/hooks/useSavedListings';

interface SavedListingsContextType {
  savedIds: Set<string>;
  savedListings: SavedListing[];
  isSaved: (id: string) => boolean;
  saveListing: (listing: {
    id: string;
    price: number;
    address: string;
    neighborhood: string;
    bedrooms: number;
    image?: string;
  }) => void;
  unsaveListing: (id: string) => void;
  toggleSaved: (listing: {
    id: string;
    price: number;
    address: string;
    neighborhood: string;
    bedrooms: number;
    image?: string;
  }) => boolean;
  loaded: boolean;
  count: number;
}

const SavedListingsContext = createContext<SavedListingsContextType | null>(null);

export function SavedListingsProvider({ children }: { children: ReactNode }) {
  const value = useSavedListings();

  return (
    <SavedListingsContext.Provider value={value}>
      {children}
    </SavedListingsContext.Provider>
  );
}

export function useSavedListingsContext() {
  const context = useContext(SavedListingsContext);
  if (!context) {
    throw new Error('useSavedListingsContext must be used within SavedListingsProvider');
  }
  return context;
}
