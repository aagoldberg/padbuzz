'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'padbuzz_saved_listings';

export interface SavedListing {
  id: string;
  savedAt: number;
  price: number;
  address: string;
  neighborhood: string;
  bedrooms: number;
  image?: string;
}

export function useSavedListings() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const listings: SavedListing[] = JSON.parse(stored);
        setSavedListings(listings);
        setSavedIds(new Set(listings.map(l => l.id)));
      }
    } catch (e) {
      console.error('Failed to load saved listings:', e);
    }
    setLoaded(true);
  }, []);

  // Persist to localStorage
  const persist = useCallback((listings: SavedListing[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
    } catch (e) {
      console.error('Failed to save listings:', e);
    }
  }, []);

  const isSaved = useCallback((id: string) => {
    return savedIds.has(id);
  }, [savedIds]);

  const saveListing = useCallback((listing: {
    id: string;
    price: number;
    address: string;
    neighborhood: string;
    bedrooms: number;
    image?: string;
  }) => {
    setSavedListings(prev => {
      // Don't add duplicates
      if (prev.some(l => l.id === listing.id)) return prev;

      const newListing: SavedListing = {
        ...listing,
        savedAt: Date.now(),
      };
      const updated = [newListing, ...prev];
      persist(updated);
      return updated;
    });
    setSavedIds(prev => new Set(prev).add(listing.id));
  }, [persist]);

  const unsaveListing = useCallback((id: string) => {
    setSavedListings(prev => {
      const updated = prev.filter(l => l.id !== id);
      persist(updated);
      return updated;
    });
    setSavedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [persist]);

  const toggleSaved = useCallback((listing: {
    id: string;
    price: number;
    address: string;
    neighborhood: string;
    bedrooms: number;
    image?: string;
  }) => {
    if (isSaved(listing.id)) {
      unsaveListing(listing.id);
      return false;
    } else {
      saveListing(listing);
      return true;
    }
  }, [isSaved, saveListing, unsaveListing]);

  return {
    savedIds,
    savedListings,
    isSaved,
    saveListing,
    unsaveListing,
    toggleSaved,
    loaded,
    count: savedListings.length,
  };
}
