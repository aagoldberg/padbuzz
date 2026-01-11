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
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price Range
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={(e) => updateFilter('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-28"
            />
            <span className="text-gray-400">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={(e) => updateFilter('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-28"
            />
          </div>
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bedrooms
          </label>
          <select
            value={filters.bedrooms || ''}
            onChange={(e) => updateFilter('bedrooms', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bathrooms
          </label>
          <select
            value={filters.bathrooms || ''}
            onChange={(e) => updateFilter('bathrooms', e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
          </select>
        </div>

        <Button onClick={onSearch} className="h-[42px]">
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>

        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="h-[42px]"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          {showAdvanced ? 'Hide' : 'More'} Filters
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="h-[42px] text-red-600">
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.noFeeOnly || false}
                onChange={(e) => updateFilter('noFeeOnly', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">No Fee Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.rentStabilizedOnly || false}
                onChange={(e) => updateFilter('rentStabilizedOnly', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Rent Stabilized Only</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Neighborhoods
            </label>
            <div className="flex flex-wrap gap-2">
              {NYC_NEIGHBORHOODS.map((neighborhood) => (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    filters.neighborhoods?.includes(neighborhood)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
