'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SearchFilters as Filters } from '@/types/apartment';

const NYC_NEIGHBORHOODS = [
  'Upper East Side',
  'Upper West Side',
  'Midtown',
  'Chelsea',
  'Greenwich Village',
  'East Village',
  'SoHo',
  'Tribeca',
  'Lower East Side',
  'Financial District',
  'Brooklyn Heights',
  'Williamsburg',
  'Park Slope',
  'DUMBO',
  'Bushwick',
  'Greenpoint',
  'Astoria',
  'Long Island City',
  'Harlem',
  'Washington Heights',
];

const PRICE_RANGES = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under $2,000', min: undefined, max: 2000 },
  { label: '$2,000 - $3,000', min: 2000, max: 3000 },
  { label: '$3,000 - $4,000', min: 3000, max: 4000 },
  { label: '$4,000 - $5,000', min: 4000, max: 5000 },
  { label: '$5,000+', min: 5000, max: undefined },
];

interface SearchFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSearch: () => void;
}

export default function SearchFilters({ filters, onFiltersChange, onSearch }: SearchFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleNeighborhood = (neighborhood: string) => {
    const current = filters.neighborhoods || [];
    if (current.includes(neighborhood)) {
      updateFilter('neighborhoods', current.filter(n => n !== neighborhood));
    } else {
      updateFilter('neighborhoods', [...current, neighborhood]);
    }
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const applyFilters = () => {
    setShowFilters(false);
    onSearch();
  };

  const activeFilterCount = [
    filters.minPrice || filters.maxPrice,
    filters.bedrooms !== undefined,
    filters.bathrooms !== undefined,
    filters.neighborhoods?.length,
    filters.noFeeOnly,
    filters.rentStabilizedOnly,
  ].filter(Boolean).length;

  const getPriceLabel = () => {
    if (!filters.minPrice && !filters.maxPrice) return 'Price';
    if (!filters.minPrice) return `Under $${filters.maxPrice?.toLocaleString()}`;
    if (!filters.maxPrice) return `$${filters.minPrice.toLocaleString()}+`;
    return `$${filters.minPrice.toLocaleString()} - $${filters.maxPrice.toLocaleString()}`;
  };

  const getBedsLabel = () => {
    if (filters.bedrooms === undefined) return 'Beds';
    if (filters.bedrooms === 0) return 'Studio';
    return `${filters.bedrooms}+ Beds`;
  };

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (showFilters) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showFilters]);

  return (
    <>
      {/* Quick Filters Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        {/* Price Button - Opens Filter Drawer */}
        <button
          onClick={() => setShowFilters(true)}
          className={`hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            filters.minPrice || filters.maxPrice
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          {getPriceLabel()}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {/* Beds - Quick Select */}
        <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
          {[
            { value: undefined, label: 'Any' },
            { value: 0, label: 'Studio' },
            { value: 1, label: '1+' },
            { value: 2, label: '2+' },
            { value: 3, label: '3+' },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => updateFilter('bedrooms', option.value)}
              className={`px-3 py-2.5 text-sm font-medium transition-colors ${
                filters.bedrooms === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* No Fee Toggle */}
        <button
          onClick={() => updateFilter('noFeeOnly', !filters.noFeeOnly)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            filters.noFeeOnly
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          No Fee
        </button>

        {/* More Filters Button */}
        <button
          onClick={() => setShowFilters(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeFilterCount > 0
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Search Button - Desktop */}
        <Button
          onClick={onSearch}
          className="hidden sm:flex h-10 px-6 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-sm transition-all active:scale-95 ml-auto"
        >
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Mobile Search Button - Fixed at bottom */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-30">
        <Button
          onClick={onSearch}
          className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-lg transition-all active:scale-95"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Listings
        </Button>
      </div>

      {/* Full Filter Drawer */}
      {showFilters && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setShowFilters(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] bg-white z-50 rounded-t-3xl sm:rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-full animate-slide-up sm:animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm font-medium text-red-500 hover:text-red-600"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Price Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Min</label>
                    <input
                      type="number"
                      placeholder="No min"
                      value={filters.minPrice || ''}
                      onChange={(e) => updateFilter('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Max</label>
                    <input
                      type="number"
                      placeholder="No max"
                      value={filters.maxPrice || ''}
                      onChange={(e) => updateFilter('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {PRICE_RANGES.slice(1).map((range) => (
                    <button
                      key={range.label}
                      onClick={() => {
                        updateFilter('minPrice', range.min);
                        updateFilter('maxPrice', range.max);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filters.minPrice === range.min && filters.maxPrice === range.max
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Bedrooms</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: undefined, label: 'Any' },
                    { value: 0, label: 'Studio' },
                    { value: 1, label: '1+' },
                    { value: 2, label: '2+' },
                    { value: 3, label: '3+' },
                    { value: 4, label: '4+' },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => updateFilter('bedrooms', option.value)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        filters.bedrooms === option.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bathrooms */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Bathrooms</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: undefined, label: 'Any' },
                    { value: 1, label: '1+' },
                    { value: 2, label: '2+' },
                    { value: 3, label: '3+' },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => updateFilter('bathrooms', option.value)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        filters.bathrooms === option.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Features</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      filters.noFeeOnly ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {filters.noFeeOnly && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={filters.noFeeOnly || false}
                      onChange={(e) => updateFilter('noFeeOnly', e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm text-gray-700">No broker fee</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      filters.rentStabilizedOnly ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {filters.rentStabilizedOnly && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={filters.rentStabilizedOnly || false}
                      onChange={(e) => updateFilter('rentStabilizedOnly', e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm text-gray-700">Rent stabilized</span>
                  </label>
                </div>
              </div>

              {/* Neighborhoods */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Neighborhoods</h3>
                <div className="flex flex-wrap gap-2">
                  {NYC_NEIGHBORHOODS.map((neighborhood) => (
                    <button
                      key={neighborhood}
                      onClick={() => toggleNeighborhood(neighborhood)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        filters.neighborhoods?.includes(neighborhood)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {neighborhood}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <Button
                onClick={applyFilters}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all active:scale-95"
              >
                Show Results
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Add animation keyframes */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
