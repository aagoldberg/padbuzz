'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface Listing {
  _id: string;
  sourceUrl: string;
  addressText: string;
  neighborhood?: string;
  borough?: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;
  description?: string;
  images: string[];
  noFee?: boolean;
  availableDate?: string;
  brokerCompany?: string;
  latitude?: number;
  longitude?: number;
  // StreetEasy specific
  netEffectivePrice?: number;
  monthsFree?: number;
  leaseTermMonths?: number;
  furnished?: boolean;
  isNewDevelopment?: boolean;
  hasTour3d?: boolean;
  hasVideos?: boolean;
  mediaAssetCount?: number;
  buildingType?: string;
  // Analysis
  storedImageAnalysis?: {
    overallQuality: number;
    cleanliness: number;
    light: number;
    renovation: number;
    analyzedAt: string;
  };
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    async function fetchListing() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        if (!res.ok) {
          throw new Error('Listing not found');
        }
        const data = await res.json();
        setListing(data.listing);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchListing();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Listing Not Found</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getQualityLabel = (score: number) => {
    if (score >= 8) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 6) return { label: 'Good', color: 'text-blue-600' };
    if (score >= 4) return { label: 'Fair', color: 'text-yellow-600' };
    return { label: 'Poor', color: 'text-red-600' };
  };

  const savings = listing.monthsFree && listing.leaseTermMonths
    ? Math.round((listing.price * listing.monthsFree) / listing.leaseTermMonths)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to listings
          </Link>
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm"
          >
            View on StreetEasy
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
              {listing.images.length > 0 ? (
                <>
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <Image
                      src={listing.images[selectedImage]}
                      alt={`${listing.addressText} - Image ${selectedImage + 1}`}
                      fill
                      className="object-cover"
                      priority
                    />
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      {selectedImage + 1} / {listing.images.length}
                    </div>
                    {/* Navigation arrows */}
                    {listing.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedImage(i => (i > 0 ? i - 1 : listing.images.length - 1))}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setSelectedImage(i => (i < listing.images.length - 1 ? i + 1 : 0))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  {/* Thumbnails */}
                  {listing.images.length > 1 && (
                    <div className="p-4 flex gap-2 overflow-x-auto">
                      {listing.images.slice(0, 10).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImage(i)}
                          className={`relative w-20 h-16 flex-shrink-0 rounded-lg overflow-hidden ${
                            selectedImage === i ? 'ring-2 ring-blue-600' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <Image src={img} alt={`Thumbnail ${i + 1}`} fill className="object-cover" />
                        </button>
                      ))}
                      {listing.images.length > 10 && (
                        <div className="w-20 h-16 flex-shrink-0 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
                          +{listing.images.length - 10}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">No images available</span>
                </div>
              )}
            </div>

            {/* AI Quality Analysis */}
            {listing.storedImageAnalysis && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Quality Analysis</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className={`text-3xl font-bold ${getQualityLabel(listing.storedImageAnalysis.overallQuality).color}`}>
                      {listing.storedImageAnalysis.overallQuality.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Overall</div>
                    <div className={`text-xs ${getQualityLabel(listing.storedImageAnalysis.overallQuality).color}`}>
                      {getQualityLabel(listing.storedImageAnalysis.overallQuality).label}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-semibold text-gray-900">
                      {listing.storedImageAnalysis.cleanliness.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Cleanliness</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-semibold text-gray-900">
                      {listing.storedImageAnalysis.light.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Natural Light</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-semibold text-gray-900">
                      {listing.storedImageAnalysis.renovation.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Renovation</div>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Apartment</h2>
                <p className="text-gray-700 whitespace-pre-line">{listing.description}</p>
              </div>
            )}

            {/* Map placeholder */}
            {listing.latitude && listing.longitude && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <a
                    href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on Google Maps
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Pricing and Info */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900">{formatPrice(listing.price)}</div>
                <div className="text-gray-600">per month</div>
              </div>

              {/* Net Effective Price */}
              {listing.netEffectivePrice && listing.netEffectivePrice !== listing.price && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="text-green-800 font-semibold">
                    {formatPrice(listing.netEffectivePrice)} net effective
                  </div>
                  {listing.monthsFree && (
                    <div className="text-green-600 text-sm mt-1">
                      {listing.monthsFree} month{listing.monthsFree > 1 ? 's' : ''} free on {listing.leaseTermMonths}-month lease
                    </div>
                  )}
                  {savings > 0 && (
                    <div className="text-green-700 text-sm mt-1">
                      Save {formatPrice(savings)}/month
                    </div>
                  )}
                </div>
              )}

              {/* Key Details */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Bedrooms</span>
                  <span className="font-medium">{listing.beds === 0 ? 'Studio' : listing.beds}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Bathrooms</span>
                  <span className="font-medium">{listing.baths}</span>
                </div>
                {listing.sqft && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Size</span>
                    <span className="font-medium">{listing.sqft.toLocaleString()} sq ft</span>
                  </div>
                )}
                {listing.availableDate && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Available</span>
                    <span className="font-medium">{formatDate(listing.availableDate)}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {listing.noFee && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    No Fee
                  </span>
                )}
                {listing.furnished && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    Furnished
                  </span>
                )}
                {listing.isNewDevelopment && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    New Development
                  </span>
                )}
                {listing.hasTour3d && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    3D Tour
                  </span>
                )}
                {listing.hasVideos && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    Video
                  </span>
                )}
              </div>

              {/* CTA */}
              <a
                href={listing.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              >
                View on StreetEasy
              </a>
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
              <div className="text-gray-700">
                <div className="font-medium">{listing.addressText}</div>
                <div className="text-gray-600">
                  {listing.neighborhood}{listing.borough ? `, ${listing.borough}` : ''}
                </div>
              </div>
            </div>

            {/* Broker Card */}
            {listing.brokerCompany && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Listed By</h3>
                <div className="text-gray-700">{listing.brokerCompany}</div>
              </div>
            )}

            {/* Listing Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm text-sm text-gray-500">
              {listing.firstSeenAt && (
                <div>First seen: {formatDate(listing.firstSeenAt)}</div>
              )}
              {listing.lastSeenAt && (
                <div>Last updated: {formatDate(listing.lastSeenAt)}</div>
              )}
              {listing.mediaAssetCount && (
                <div>{listing.mediaAssetCount} photos available</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
