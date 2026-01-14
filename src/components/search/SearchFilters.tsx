'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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

interface SearchFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onSearch: () => void;
}

export default function SearchFilters({ filters, onFiltersChange, onSearch }: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const hasActiveFilters = Object.values(filters).some(v =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== false)
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-2 sm:p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[280px] flex items-center bg-gray-50 rounded-xl px-4 py-2 border border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all">
          <div className="flex flex-col flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Price Range</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice || ''}
                onChange={(e) => updateFilter('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 placeholder:font-normal"
              />
              <span className="text-gray-300 font-light">—</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice || ''}
                onChange={(e) => updateFilter('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 placeholder:font-normal text-right"
              />
            </div>
          </div>
        </div>

        <div className="w-full sm:w-40 flex flex-col bg-gray-50 rounded-xl px-4 py-2 border border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Bedrooms</span>
          <select
            value={filters.bedrooms || ''}
            onChange={(e) => updateFilter('bedrooms', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 appearance-none cursor-pointer"
          >
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1+ Bed</option>
            <option value="2">2+ Beds</option>
            <option value="3">3+ Beds</option>
          </select>
        </div>

        <div className="w-full sm:w-40 flex flex-col bg-gray-50 rounded-xl px-4 py-2 border border-transparent focus-within:border-indigo-100 focus-within:bg-white transition-all">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Bathrooms</span>
          <select
            value={filters.bathrooms || ''}
            onChange={(e) => updateFilter('bathrooms', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 appearance-none cursor-pointer"
          >
            <option value="">Any</option>
            <option value="1">1+ Bath</option>
            <option value="2">2+ Baths</option>
            <option value="3">3+ Baths</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`h-12 px-4 rounded-xl font-semibold text-sm ${showAdvanced ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>

          <Button 
            onClick={onSearch} 
            className="h-12 px-8 rounded-xl bg-gray-900 hover:bg-black text-white font-bold shadow-lg shadow-gray-200 transition-all active:scale-95"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div className="px-6 py-6 border-t border-gray-50 bg-gray-50/30">
          <div className="flex flex-wrap gap-8 mb-8">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Features</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.noFeeOnly || false}
                      onChange={(e) => updateFilter('noFeeOnly', e.target.checked)}
                      className="peer w-5 h-5 opacity-0 absolute cursor-pointer"
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                      <div className="w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 mb-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">No Fee Only</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.rentStabilizedOnly || false}
                      onChange={(e) => updateFilter('rentStabilizedOnly', e.target.checked)}
                      className="peer w-5 h-5 opacity-0 absolute cursor-pointer"
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                      <div className="w-1.5 h-3 border-r-2 border-b-2 border-white rotate-45 mb-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Rent Stabilized</span>
                </label>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="ml-auto self-end">
                <button 
                  onClick={clearFilters} 
                  className="text-sm font-bold text-red-500 hover:text-red-600 underline underline-offset-4 decoration-2"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-4">Neighborhoods</span>
            <div className="flex flex-wrap gap-2">
              {NYC_NEIGHBORHOODS.map((neighborhood) => (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filters.neighborhoods?.includes(neighborhood)
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105'
                      : 'bg-white border border-gray-100 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
                >
                  {neighborhood}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
