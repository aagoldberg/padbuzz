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
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 flex items-center justify-between border-b border-gray-50 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">AI Preferences</h2>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mt-0.5">Personalized Agent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50">
            <p className="text-sm text-indigo-900 leading-relaxed font-medium">
              Tell us what you&apos;re looking for. Our AI will analyze listings, photos, and descriptions to find your perfect match.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                Max Budget
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <Input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: parseInt(e.target.value) || 0 })}
                  className="pl-8 bg-gray-50/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                Bedrooms
              </label>
              <select
                value={formData.minBedrooms}
                onChange={(e) => setFormData({ ...formData, minBedrooms: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-900 appearance-none"
              >
                <option value="0">Studio</option>
                <option value="1">1 Bed</option>
                <option value="2">2 Beds</option>
                <option value="3">3 Beds</option>
                <option value="4">4+ Beds</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                Bathrooms
              </label>
              <select
                value={formData.minBathrooms}
                onChange={(e) => setFormData({ ...formData, minBathrooms: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-900 appearance-none"
              >
                <option value="1">1 Bath</option>
                <option value="2">2 Baths</option>
                <option value="3">3+ Baths</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                Must-Have Amenities
              </label>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">High Priority</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleItem(formData.mustHaveAmenities, amenity, 'mustHaveAmenities')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    formData.mustHaveAmenities.includes(amenity)
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 block">
              Your Lifestyle Priorities
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => toggleItem(formData.priorities, priority, 'priorities')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    formData.priorities.includes(priority)
                      ? 'bg-indigo-900 text-white shadow-lg shadow-gray-200 scale-105'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 block">
              Deal Breakers
            </label>
            <Input
              type="text"
              value={formData.dealBreakers.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                dealBreakers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., basement unit, near highway"
              className="bg-gray-50/50"
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 block">
              Anything else the AI should know?
            </label>
            <textarea
              value={formData.additionalNotes || ''}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              placeholder="e.g., I need a quiet space for recording podcasts..."
              className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-sm font-medium placeholder:text-gray-400 transition-all"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" size="lg" className="flex-1 shadow-indigo-200">
              Apply Preferences
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={onClose} className="border-none bg-gray-50">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
