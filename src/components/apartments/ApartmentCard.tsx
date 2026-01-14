'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { SunIcon, ArrowsPointingOutIcon, SparklesIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import { Apartment, AIAnalysis, ComparativeStats } from '@/types/apartment';
import Button from '@/components/ui/Button';
import { useSavedListingsContext } from '@/contexts/SavedListingsContext';

interface ApartmentCardProps {
  apartment: Apartment;
  analysis?: AIAnalysis;
  dealScore?: number;
  comparativeStats?: ComparativeStats;
  onAnalyze?: () => void;
  analyzing?: boolean;
}

export default function ApartmentCard({
  apartment,
  analysis,
  dealScore,
  comparativeStats,
  onAnalyze,
  analyzing,
}: ApartmentCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const { isSaved, toggleSaved } = useSavedListingsContext();
  const saved = isSaved(apartment._id);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved({
      id: apartment._id,
      price: apartment.price,
      address: apartment.address,
      neighborhood: apartment.neighborhood,
      bedrooms: apartment.bedrooms,
      image: apartment.images?.[0],
    });
  };

  const getVerdict = () => {
    // Priority: Analysis Score -> Deal Score -> "Not Analyzed"
    if (analysis?.overallScore) {
      const score = analysis.overallScore;
      if (score >= 8) return { text: `${score.toFixed(1)} EXCEPTIONAL`, color: 'bg-green-700 text-white' };
      if (score >= 7) return { text: `${score.toFixed(1)} GOOD`, color: 'bg-green-600 text-white' };
      if (score >= 5) return { text: `${score.toFixed(1)} AVERAGE`, color: 'bg-amber-500 text-white' };
      return { text: `${score.toFixed(1)} PASS`, color: 'bg-red-500 text-white' };
    }
    if (dealScore) {
      if (dealScore >= 90) return { text: 'GREAT VALUE', color: 'bg-green-700 text-white' };
      if (dealScore >= 80) return { text: 'GOOD VALUE', color: 'bg-green-600 text-white' };
      return { text: 'FAIR VALUE', color: 'bg-amber-500 text-white' };
    }
    return null;
  };

  const verdict = getVerdict();

  return (
    <Link href={`/listing/${apartment._id}`} className="group block h-full">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col">
        {/* Hero Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          {apartment.images && apartment.images.length > 0 ? (
            <>
              <Image
                src={apartment.images[imageIndex]}
                alt={apartment.address}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                unoptimized
              />

              {/* Verdict Badge - The "Analyst" Stamp */}
              {verdict && (
                <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-md shadow-sm font-bold text-xs tracking-wider uppercase ${verdict.color}`}>
                  {verdict.text}
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSaveClick}
                className={`absolute top-4 right-4 p-2 rounded-full transition-all ${
                  saved
                    ? 'bg-red-500 text-white'
                    : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                aria-label={saved ? 'Remove from saved' : 'Save listing'}
              >
                <Heart className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
              </button>

              {/* No Fee Badge */}
              {apartment.noFee && (
                <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border border-white/10">
                  No Fee
                </div>
              )}

              {/* Navigation */}
              {apartment.images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setImageIndex(prev => prev === 0 ? apartment.images.length - 1 : prev - 1);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setImageIndex(prev => prev === apartment.images.length - 1 ? 0 : prev + 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col flex-1">
          {/* Header: Price & Address */}
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
              ${apartment.price.toLocaleString()}
            </h3>
            <div className="flex items-center text-gray-600 mt-1">
              <span className="font-medium truncate">{apartment.address}</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {apartment.bedrooms}bd • {apartment.bathrooms}ba • {apartment.neighborhood}
            </div>
          </div>

          {/* Quality Icons - show only for high scores */}
          {apartment.storedImageAnalysis && (
            <div className="flex items-center gap-2 mt-auto">
              {(apartment.storedImageAnalysis.light ?? 0) >= 8 && (
                <SunIcon className="w-4 h-4 text-amber-400" title="Great light" />
              )}
              {(apartment.storedImageAnalysis.spaciousness ?? 0) >= 8 && (
                <ArrowsPointingOutIcon className="w-4 h-4 text-blue-400" title="Spacious" />
              )}
              {(apartment.storedImageAnalysis.cleanliness ?? 0) >= 8 && (
                <SparklesIcon className="w-4 h-4 text-emerald-400" title="Very clean" />
              )}
              {(apartment.storedImageAnalysis.renovation ?? 0) >= 8 && (
                <WrenchScrewdriverIcon className="w-4 h-4 text-violet-400" title="Updated" />
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
