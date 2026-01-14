'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sun, Maximize, DollarSign, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Apartment, AIAnalysis, ComparativeStats } from '@/types/apartment';
import Button from '@/components/ui/Button';

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
  const lightScore = apartment.storedImageAnalysis?.light;
  const spaceScore = apartment.storedImageAnalysis?.spaciousness;

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

              {/* No Fee Badge */}
              {apartment.noFee && (
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border border-white/10">
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

          {/* Signals Row - Always show structure, scores optional */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-gray-100 mb-4">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                <Sun className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Light</span>
              </div>
              <span className={`text-sm font-bold ${lightScore && lightScore >= 7 ? 'text-gray-900' : 'text-gray-500'}`}>
                {lightScore ? lightScore.toFixed(1) : '—'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center border-l border-gray-100">
              <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                <Maximize className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Space</span>
              </div>
              <span className={`text-sm font-bold ${spaceScore && spaceScore >= 7 ? 'text-gray-900' : 'text-gray-500'}`}>
                {spaceScore ? spaceScore.toFixed(1) : '—'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center border-l border-gray-100">
                              <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                                <DollarSign className="w-3.5 h-3.5" />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Value</span>
                              </div>
                              <span className={`text-sm font-bold ${dealScore && dealScore >= 80 ? 'text-green-700' : 'text-gray-900'}`}>
                                {dealScore || '-'} 
                              </span>
                            </div>          </div>

          {/* The Take - Always show insight */}
          <div className="mt-auto">
            {analysis?.summary || apartment.storedImageAnalysis?.summary ? (
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed font-medium">
                <span className="text-indigo-600 font-bold mr-1">The Take:</span>
                {analysis?.summary || apartment.storedImageAnalysis?.summary}
              </p>
            ) : apartment.storedImageAnalysis?.vibe ? (
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed font-medium">
                <span className="text-indigo-600 font-bold mr-1">Vibe:</span>
                {apartment.storedImageAnalysis.vibe}
              </p>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAnalyze?.();
                }}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 flex items-center"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                See why this made the cut
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
