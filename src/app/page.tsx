'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Sparkles, Bell, Settings, Info } from 'lucide-react';
import Link from 'next/link';
import SearchFilters from '@/components/search/SearchFilters';
import PreferencesModal from '@/components/search/PreferencesModal';
import ApartmentCard from '@/components/apartments/ApartmentCard';
import Button from '@/components/ui/Button';
import { Apartment, ApartmentWithAnalysis, SearchFilters as Filters, UserPreferences, AIAnalysis } from '@/types/apartment';

export default function HomePage() {
  const [apartments, setApartments] = useState<ApartmentWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchApartments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '12');

      if (filters.minPrice) params.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString());
      if (filters.bedrooms) params.set('bedrooms', filters.bedrooms.toString());
      if (filters.bathrooms) params.set('bathrooms', filters.bathrooms.toString());
      if (filters.neighborhoods?.length) params.set('neighborhoods', filters.neighborhoods.join(','));
      if (filters.noFeeOnly) params.set('noFeeOnly', 'true');
      if (filters.rentStabilizedOnly) params.set('rentStabilizedOnly', 'true');

      const res = await fetch(`/api/apartments?${params}`);
      const data = await res.json();

      setApartments(data.apartments || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching apartments:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  useEffect(() => {
    const savedPrefs = localStorage.getItem('padbuzz_preferences');
    if (savedPrefs) {
      setPreferences(JSON.parse(savedPrefs));
    }
  }, []);

  const handleSavePreferences = (prefs: UserPreferences) => {
    setPreferences(prefs);
    localStorage.setItem('padbuzz_preferences', JSON.stringify(prefs));
  };

  const handleAnalyze = async (apartment: Apartment) => {
    if (!preferences) {
      setShowPreferences(true);
      return;
    }

    setAnalyzingIds(prev => new Set(prev).add(apartment._id));

    try {
      const res = await fetch(`/api/apartments/${apartment._id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      const data = await res.json();

      setApartments(prev =>
        prev.map(apt =>
          apt._id === apartment._id
            ? {
                ...apt,
                aiAnalysis: data.analysis as AIAnalysis,
                matchScore: data.matchScore,
                dealScore: data.dealScore,
                comparativeStats: data.comparativeStats,
              }
            : apt
        )
      );
    } catch (error) {
      console.error('Error analyzing apartment:', error);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(apartment._id);
        return next;
      });
    }
  };

  const handleAnalyzeAll = async () => {
    if (!preferences) return;

    const unanalyzed = apartments.filter(apt => !apt.aiAnalysis);
    if (unanalyzed.length === 0) return;

    setAnalyzingAll(true);

    // Analyze in batches of 3 to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < unanalyzed.length; i += batchSize) {
      const batch = unanalyzed.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (apartment) => {
          try {
            const res = await fetch(`/api/apartments/${apartment._id}/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ preferences }),
            });

            const data = await res.json();

            setApartments(prev =>
              prev.map(apt =>
                apt._id === apartment._id
                  ? {
                      ...apt,
                      aiAnalysis: data.analysis as AIAnalysis,
                      matchScore: data.matchScore,
                      dealScore: data.dealScore,
                      comparativeStats: data.comparativeStats,
                    }
                  : apt
              )
            );
          } catch (error) {
            console.error('Error analyzing apartment:', apartment._id, error);
          }
        })
      );
    }

    setAnalyzingAll(false);
  };

  const handleSearch = () => {
    setPage(1);
    fetchApartments();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PadBuzz</span>
              <span className="hidden sm:inline-block text-sm text-gray-500 ml-2">
                AI-Powered Apartment Search
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={preferences ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setShowPreferences(true)}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                {preferences ? 'Edit Preferences' : 'Set AI Preferences'}
              </Button>

              <Link href="/about">
                <Button variant="ghost" size="sm">
                  <Info className="w-4 h-4" />
                </Button>
              </Link>

              <Button variant="ghost" size="sm">
                <Bell className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        {!preferences && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 mb-8 text-white">
            <h1 className="text-3xl font-bold mb-3">Find Your Perfect Apartment with AI</h1>
            <p className="text-indigo-100 text-lg mb-6 max-w-2xl">
              Tell us what you&apos;re looking for, and our AI will analyze listings, review photos,
              and rate how well each apartment matches your needs. Get instant alerts for exceptional deals.
            </p>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowPreferences(true)}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Set Your Preferences
            </Button>
          </div>
        )}

        {/* AI Status */}
        {preferences && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">AI Mode Active</p>
                <p className="text-sm text-gray-600">
                  Budget: ${preferences.maxPrice.toLocaleString()}/mo &bull;
                  {' '}{preferences.minBedrooms}+ beds &bull;
                  {' '}{preferences.mustHaveAmenities.length} must-haves
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreferences(true)}>
              Edit
            </Button>
          </div>
        )}

        {/* Search Filters */}
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
        />

        {/* Results */}
        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
                  <div className="h-56 bg-gray-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : apartments.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-600">
                  Showing {apartments.length} apartments
                </p>
                {preferences && (
                  <Button
                    onClick={handleAnalyzeAll}
                    disabled={analyzingAll || analyzingIds.size > 0}
                    loading={analyzingAll}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {analyzingAll ? 'Analyzing...' : 'Analyze All with AI'}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apartments.map((apartment) => (
                  <ApartmentCard
                    key={apartment._id}
                    apartment={apartment}
                    analysis={apartment.aiAnalysis}
                    dealScore={apartment.dealScore}
                    comparativeStats={apartment.comparativeStats}
                    onAnalyze={() => handleAnalyze(apartment)}
                    analyzing={analyzingIds.has(apartment._id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No apartments found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your filters or check back later for new listings.
              </p>
              <Button variant="outline" onClick={() => setFilters({})}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Preferences Modal */}
      <PreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        preferences={preferences}
        onSave={handleSavePreferences}
      />
    </div>
  );
}
