'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { UserPreferences } from '@/types/apartment';

const AMENITIES = [
  'Doorman',
  'Elevator',
  'Laundry in unit',
  'Laundry in building',
  'Dishwasher',
  'Gym',
  'Roof deck',
  'Outdoor space',
  'Parking',
  'Pet friendly',
  'Central AC',
  'Storage',
  'Bike room',
  'Concierge',
];

const PRIORITIES = [
  'Natural light',
  'Quiet neighborhood',
  'Close to subway',
  'Modern finishes',
  'Spacious layout',
  'Good views',
  'Safe area',
  'Restaurants nearby',
  'Parks nearby',
  'Work from home friendly',
];

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences | null;
  onSave: (preferences: UserPreferences) => void;
}

export default function PreferencesModal({
  isOpen,
  onClose,
  preferences,
  onSave,
}: PreferencesModalProps) {
  const [formData, setFormData] = useState<UserPreferences>(
    preferences || {
      maxPrice: 4000,
      minBedrooms: 1,
      minBathrooms: 1,
      preferredNeighborhoods: [],
      mustHaveAmenities: [],
      niceToHaveAmenities: [],
      priorities: [],
      dealBreakers: [],
      additionalNotes: '',
    }
  );

  if (!isOpen) return null;

  const toggleItem = (array: string[], item: string, field: keyof UserPreferences) => {
    const current = formData[field] as string[];
    if (current.includes(item)) {
      setFormData({ ...formData, [field]: current.filter(i => i !== item) });
    } else {
      setFormData({ ...formData, [field]: [...current, item] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold">AI Preferences</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-gray-600">
            Tell us what you&apos;re looking for. Our AI will analyze apartments and rate how well they match your needs.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Budget
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <Input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: parseInt(e.target.value) || 0 })}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Bedrooms
              </label>
              <select
                value={formData.minBedrooms}
                onChange={(e) => setFormData({ ...formData, minBedrooms: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="0">Studio</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Bathrooms
              </label>
              <select
                value={formData.minBathrooms}
                onChange={(e) => setFormData({ ...formData, minBathrooms: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3+</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Must-Have Amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleItem(formData.mustHaveAmenities, amenity, 'mustHaveAmenities')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.mustHaveAmenities.includes(amenity)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nice-to-Have Amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.filter(a => !formData.mustHaveAmenities.includes(a)).map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleItem(formData.niceToHaveAmenities, amenity, 'niceToHaveAmenities')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.niceToHaveAmenities.includes(amenity)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Priorities
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => toggleItem(formData.priorities, priority, 'priorities')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    formData.priorities.includes(priority)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Breakers (comma-separated)
            </label>
            <Input
              type="text"
              value={formData.dealBreakers.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                dealBreakers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., basement unit, no natural light, near highway"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={formData.additionalNotes || ''}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              placeholder="Any other requirements or preferences..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              Save Preferences
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
