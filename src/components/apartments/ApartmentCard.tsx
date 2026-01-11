'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MapPin, Bed, Bath, Square, Check, Sparkles, TrendingUp } from 'lucide-react';
import { Apartment, AIAnalysis } from '@/types/apartment';
import Button from '@/components/ui/Button';

interface ApartmentCardProps {
  apartment: Apartment;
  analysis?: AIAnalysis;
  dealScore?: number;
  onAnalyze?: () => void;
  analyzing?: boolean;
}

export default function ApartmentCard({
  apartment,
  analysis,
  dealScore,
  onAnalyze,
  analyzing,
}: ApartmentCardProps) {
  const [imageIndex, setImageIndex] = useState(0);

  const getDealBadge = () => {
    if (!dealScore) return null;
    if (dealScore >= 90) return { text: 'Exceptional Deal', color: 'bg-red-500' };
    if (dealScore >= 80) return { text: 'Great Deal', color: 'bg-orange-500' };
    if (dealScore >= 70) return { text: 'Good Deal', color: 'bg-yellow-500' };
    return null;
  };

  const dealBadge = getDealBadge();

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-56">
        {apartment.images && apartment.images.length > 0 ? (
          <>
            <Image
              src={apartment.images[imageIndex]}
              alt={apartment.address}
              fill
              className="object-cover"
              unoptimized
            />
            {apartment.images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {apartment.images.slice(0, 5).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === imageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image available</span>
          </div>
        )}

        {dealBadge && (
          <div className={`absolute top-3 left-3 ${dealBadge.color} text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1`}>
            <Sparkles className="w-4 h-4" />
            {dealBadge.text}
          </div>
        )}

        {apartment.noFee && (
          <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            No Fee
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900">
            ${apartment.price.toLocaleString()}/mo
          </h3>
          {analysis && (
            <div className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold">{analysis.overallScore}/10</span>
            </div>
          )}
        </div>

        <div className="flex items-center text-gray-600 mb-3">
          <MapPin className="w-4 h-4 mr-1" />
          <span className="text-sm truncate">{apartment.address}</span>
        </div>

        <div className="flex gap-4 text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>{apartment.bedrooms} bed</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            <span>{apartment.bathrooms} bath</span>
          </div>
          {apartment.sqft && (
            <div className="flex items-center gap-1">
              <Square className="w-4 h-4" />
              <span>{apartment.sqft} sqft</span>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 mb-4">
          {apartment.neighborhood}
          {apartment.rentStabilized && (
            <span className="ml-2 text-indigo-600 font-medium">• Rent Stabilized</span>
          )}
        </div>

        {analysis ? (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-gray-700 mb-3">{analysis.summary}</p>
            <div className="flex flex-wrap gap-2">
              {analysis.pros.slice(0, 2).map((pro, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  <Check className="w-3 h-3" />
                  {pro}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onAnalyze}
              loading={analyzing}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(apartment.url, '_blank')}
            >
              View Listing
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
