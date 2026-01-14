'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Heart, Trash2, ArrowLeft } from 'lucide-react';
import { useSavedListingsContext } from '@/contexts/SavedListingsContext';
import { Apartment } from '@/types/apartment';
import ApartmentCard from '@/components/apartments/ApartmentCard';

export default function SavedPage() {
  const { savedListings, unsaveListing, loaded, count } = useSavedListingsContext();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch full apartment data for saved listings
  useEffect(() => {
    if (!loaded) return;

    const fetchApartments = async () => {
      if (savedListings.length === 0) {
        setApartments([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch apartments by IDs
        const ids = savedListings.map(l => l.id);
        const res = await fetch(`/api/apartments?ids=${ids.join(',')}&limit=100`);
        const data = await res.json();

        // Sort by saved order
        const apartmentsMap = new Map(data.apartments.map((a: Apartment) => [a._id, a]));
        const sorted = ids
          .map(id => apartmentsMap.get(id))
          .filter((a): a is Apartment => a !== undefined);

        setApartments(sorted);
      } catch (error) {
        console.error('Error fetching saved apartments:', error);
        setApartments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApartments();
  }, [savedListings, loaded]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-gray-900">PadBuzz</span>
              </Link>
            </div>

            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to search
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-6 h-6 text-red-500 fill-current" />
            <h1 className="text-2xl font-bold text-gray-900">Saved Listings</h1>
          </div>
          <p className="text-gray-500">
            {count === 0
              ? 'No saved listings yet. Tap the heart on any listing to save it.'
              : `${count} listing${count === 1 ? '' : 's'} saved`}
          </p>
        </div>

        {/* Loading State */}
        {loading || !loaded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-6 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : apartments.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No saved listings</h2>
            <p className="text-gray-500 mb-6">
              Tap the heart icon on listings you like to save them for later.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Browse listings
            </Link>
          </div>
        ) : (
          /* Listings Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apartments.map((apartment) => (
              <ApartmentCard
                key={apartment._id}
                apartment={apartment}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
