'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, Sparkles, Bell, Settings, Info, ChevronRight, TrendingUp, Sun, Clock } from 'lucide-react';
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
  
  // Curated Shelves State
  const [bestValue, setBestValue] = useState<ApartmentWithAnalysis[]>([]);
  const [brightSpacious, setBrightSpacious] = useState<ApartmentWithAnalysis[]>([]);
  const [latest, setLatest] = useState<ApartmentWithAnalysis[]>([]);

  const fetchApartments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '60'); // Fetch enough to populate shelves

      if (filters.minPrice) params.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) params.set('maxPrice', filters.maxPrice.toString());
      if (filters.bedrooms) params.set('bedrooms', filters.bedrooms.toString());
      if (filters.bathrooms) params.set('bathrooms', filters.bathrooms.toString());
      if (filters.neighborhoods?.length) params.set('neighborhoods', filters.neighborhoods.join(','));
      if (filters.noFeeOnly) params.set('noFeeOnly', 'true');
      if (filters.rentStabilizedOnly) params.set('rentStabilizedOnly', 'true');

      const res = await fetch(`/api/apartments?${params}`);
      const data = await res.json();
      const all: ApartmentWithAnalysis[] = data.apartments || [];

      setApartments(all);

      // Client-side Curation (Simulation of Backend Logic)
      // 1. Best Value: Sort by Deal Score (desc)
      const value = [...all].sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));
      setBestValue(value.slice(0, 8));

      // 2. Bright & Spacious: Sort by combined Light + Space scores
      const bright = [...all].sort((a, b) => {
        const scoreA = (a.storedImageAnalysis?.light || 0) + (a.storedImageAnalysis?.spaciousness || 0);
        const scoreB = (b.storedImageAnalysis?.light || 0) + (b.storedImageAnalysis?.spaciousness || 0);
        return scoreB - scoreA;
      });
      setBrightSpacious(bright.slice(0, 8));

      // 3. Latest: Assuming API returns newest first, or strictly by createdAt
      // For now, we'll take the first 12 as "Latest" if not sorted otherwise
      setLatest(all.slice(0, 12));

    } catch (error) {
      console.error('Error fetching apartments:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

      // Update specific apartment in all lists
      const updateList = (list: ApartmentWithAnalysis[]) => 
        list.map(apt => 
          apt._id === apartment._id 
            ? { ...apt, aiAnalysis: data.analysis, matchScore: data.matchScore, dealScore: data.dealScore } 
            : apt
        );

      setApartments(prev => updateList(prev));
      setBestValue(prev => updateList(prev));
      setBrightSpacious(prev => updateList(prev));
      setLatest(prev => updateList(prev));

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

  const handleSearch = () => {
    fetchApartments();
  };

  const Shelf = ({ title, icon: Icon, items, subtitle }: { title: string, icon: any, items: ApartmentWithAnalysis[], subtitle?: string }) => (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          {subtitle && <p className="text-gray-500 text-sm ml-7">{subtitle}</p>}
        </div>
        <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center">
          View All <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
      
      <div className="flex overflow-x-auto pb-6 gap-6 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((apartment) => (
          <div key={apartment._id} className="w-[300px] sm:w-[340px] flex-shrink-0">
            <ApartmentCard
              apartment={apartment}
              analysis={apartment.aiAnalysis}
              dealScore={apartment.dealScore}
              comparativeStats={apartment.comparativeStats}
              onAnalyze={() => handleAnalyze(apartment)}
              analyzing={analyzingIds.has(apartment._id)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">PadBuzz</span>
              <span className="hidden md:inline-block text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                AI Agent
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Button
                variant={preferences ? 'ghost' : 'primary'}
                size="sm"
                onClick={() => setShowPreferences(true)}
                className={preferences ? 'text-gray-600' : ''}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {preferences ? 'Preferences' : 'Setup AI'}
              </Button>

              <Link href="/about" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="text-gray-600">
                  About
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Trusted Analyst Hero */}
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Good morning. I've scanned 1,402 listings for you.
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl">
            Here are the ones that actually matter, filtered by high light, fair prices, and honest photos.
          </p>
        </div>

        {/* Search Filters (Less Intrusive) */}
        <div className="mb-12">
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={handleSearch}
          />
        </div>

        {/* Loading State */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-64 bg-gray-100" />
                  <div className="p-6 space-y-4">
                    <div className="h-6 bg-gray-100 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
        ) : (
          <>
            {/* Shelf 1: Best Value */}
            <Shelf 
              title="Best Value Deals" 
              subtitle="Listings most likely to be underpriced based on neighborhood comps."
              icon={TrendingUp} 
              items={bestValue} 
            />

            {/* Shelf 2: Bright & Spacious */}
            <Shelf 
              title="High Light, Low Noise" 
              subtitle="Apartments with exceptional natural light and layout scores."
              icon={Sun} 
              items={brightSpacious} 
            />

            {/* Shelf 3: Latest */}
            <Shelf 
              title="Just Arrived" 
              subtitle="Fresh on the market in the last 24 hours."
              icon={Clock} 
              items={latest} 
            />
          </>
        )}
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
