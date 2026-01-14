'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Share, Heart, MapPin, Calendar, Building2, User, Camera, ExternalLink } from 'lucide-react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SparklesIcon,
  BoltIcon,
  PhotoIcon,
  ShieldCheckIcon,
  MoonIcon,
  ClockIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
  WrenchScrewdriverIcon,
  HeartIcon,
  MapIcon,
  CubeIcon,
  Square3Stack3DIcon,
  HandThumbUpIcon,
  FireIcon,
  HomeModernIcon,
  SwatchIcon,
  PaintBrushIcon,
  CloudIcon,
  RectangleGroupIcon,
  ArchiveBoxIcon,
  CameraIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import Button from '@/components/ui/Button';

interface Listing {
  _id: string;
  sourceUrl: string;
  title?: string;
  addressText: string;
  neighborhood?: string;
  borough?: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;
  description?: string;
  images: string[];
  amenities?: string[];
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
  unit?: string;
  tier?: string;
  priceDelta?: number;
  offMarketAt?: string;
  upcomingOpenHouse?: string;
  // Price history
  priceHistory?: { price: number; date: string }[];
  // Analysis
  storedImageAnalysis?: {
    overallQuality: number;
    cleanliness: number;
    light: number;
    renovation: number;
    spaciousness: number;
    coziness: number;
    charm: number;
    // Rich data
    style: string[];
    vibe: string;
    features: string[];
    buildingAmenities: string[];
    concerns: string[];
    summary: string;
    analyzedAt: string;
  };
  firstSeenAt?: string;
  lastSeenAt?: string;
}

// Extract building name from StreetEasy URL
function extractBuildingName(url: string): string | null {
  const match = url.match(/\/building\/([^/]+)/);
  if (match) {
    return match[1]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return null;
}

// Calculate days on market
function getDaysOnMarket(firstSeenAt: string): number {
  const firstSeen = new Date(firstSeenAt);
  const now = new Date();
  return Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
}

// Filter concerns that contradict the actual scores
function filterConcerns(
  concerns: string[],
  analysis: { light?: number; spaciousness?: number; cleanliness?: number; renovation?: number }
): string[] {
  return concerns.filter(concern => {
    const lower = concern.toLowerCase();
    if ((lower.includes('dark') || lower.includes('no natural light')) && (analysis.light || 0) >= 7) return false;
    if ((lower.includes('small') || lower.includes('cramped')) && (analysis.spaciousness || 0) >= 7) return false;
    if ((lower.includes('dirty') || lower.includes('wear')) && (analysis.cleanliness || 0) >= 7) return false;
    if ((lower.includes('dated') || lower.includes('old')) && (analysis.renovation || 0) >= 7) return false;
    return true;
  });
}

// Clean up old-format summaries that have "Standouts:", "Notable:", "Watch for:" patterns
function cleanSummary(summary: string): string {
  if (!summary) return summary;
  // Remove mechanical/redundant patterns from old-format summaries
  return summary
    // Remove room type lists at start: "living, kitchen, bedroom, bathroom."
    .replace(/^(living|kitchen|bedroom|bathroom|amenity|outdoor|other)(,\s*(living|kitchen|bedroom|bathroom|amenity|outdoor|other))*\.\s*/gi, '')
    // Remove "Standouts:", "Notable:", "Notable features:", "Watch for:", "Note:" patterns
    .replace(/\s*Standouts?:\s*[^.]+\./gi, '')
    .replace(/\s*Notable(\s+features)?:\s*[^.]+\./gi, '')
    .replace(/\s*Watch for:\s*[^.]+\./gi, '')
    .replace(/\s*Note:\s*[^.]+\./gi, '')
    // Remove "Photos show:" prefix
    .replace(/\s*Photos show:\s*/gi, '')
    // Remove generic filler phrases
    .replace(/\s*Very good condition with nice appeal\.\s*/gi, '')
    .replace(/\s*Good condition overall\.\s*/gi, '')
    .trim();
}

function Description({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 300;
  const shouldTruncate = text.length > maxLength;

  return (
    <div className="mb-8">
      <div className={`prose prose-indigo max-w-none text-gray-600 pb-2 ${!isExpanded ? 'line-clamp-8' : ''}`}>
        <p className="whitespace-pre-line leading-relaxed">
          {text}
        </p>
      </div>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline flex items-center text-sm transition-all"
        >
          {isExpanded ? 'Read Less' : 'Read More'}
        </button>
      )}
    </div>
  );
}

// Icon mapping for all VLM-generated features and concerns
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  // Standouts (features)
  'hardwood floors': <Square3Stack3DIcon className="w-5 h-5 text-green-600" />,
  'exposed brick': <CubeIcon className="w-5 h-5 text-green-600" />,
  'high ceilings': <ArrowsPointingOutIcon className="w-5 h-5 text-green-600" />,
  'large windows': <SunIcon className="w-5 h-5 text-green-600" />,
  'updated kitchen': <HomeModernIcon className="w-5 h-5 text-green-600" />,
  'stainless appliances': <BoltIcon className="w-5 h-5 text-green-600" />,
  'granite counters': <SwatchIcon className="w-5 h-5 text-green-600" />,
  'nice view': <PhotoIcon className="w-5 h-5 text-green-600" />,
  'balcony': <PhotoIcon className="w-5 h-5 text-green-600" />,
  'fireplace': <FireIcon className="w-5 h-5 text-green-600" />,
  'crown molding': <PaintBrushIcon className="w-5 h-5 text-green-600" />,
  'original details': <SparklesIcon className="w-5 h-5 text-green-600" />,
  'in-unit laundry': <BoltIcon className="w-5 h-5 text-green-600" />,
  'dishwasher': <BoltIcon className="w-5 h-5 text-green-600" />,
  'central air': <CloudIcon className="w-5 h-5 text-green-600" />,
  'walk-in closet': <RectangleGroupIcon className="w-5 h-5 text-green-600" />,
};

const CONCERN_ICONS: Record<string, React.ReactNode> = {
  // Trade-offs (concerns)
  'small space': <ArrowsPointingInIcon className="w-5 h-5 text-amber-500" />,
  'dark': <MoonIcon className="w-5 h-5 text-amber-500" />,
  'dated': <ClockIcon className="w-5 h-5 text-amber-500" />,
  'wear visible': <WrenchScrewdriverIcon className="w-5 h-5 text-amber-500" />,
  'clutter': <ArchiveBoxIcon className="w-5 h-5 text-amber-500" />,
  'poor staging': <CameraIcon className="w-5 h-5 text-amber-500" />,
  'no natural light': <EyeSlashIcon className="w-5 h-5 text-amber-500" />,
};

function getIconForItem(text: string, isStandout: boolean) {
  const lower = text.toLowerCase();

  // Check exact matches first
  if (isStandout && FEATURE_ICONS[lower]) {
    return FEATURE_ICONS[lower];
  }
  if (!isStandout && CONCERN_ICONS[lower]) {
    return CONCERN_ICONS[lower];
  }

  // Fallback to fuzzy matching for standouts
  if (isStandout) {
    if (lower.includes('light') || lower.includes('windows') || lower.includes('sunny')) return <SunIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('space') || lower.includes('spacious') || lower.includes('ceilings') || lower.includes('layout')) return <ArrowsPointingOutIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('modern') || lower.includes('updated') || lower.includes('renovated')) return <SparklesIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('kitchen') || lower.includes('appliances') || lower.includes('dishwasher') || lower.includes('laundry')) return <BoltIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('view') || lower.includes('balcony') || lower.includes('outdoor')) return <PhotoIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('safe') || lower.includes('doorman') || lower.includes('secure') || lower.includes('concierge')) return <ShieldCheckIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('floor') || lower.includes('brick') || lower.includes('finish')) return <Square3Stack3DIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('fireplace') || lower.includes('fire')) return <FireIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('closet') || lower.includes('storage')) return <RectangleGroupIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('air') || lower.includes('hvac') || lower.includes('ac')) return <CloudIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('pet')) return <HeartIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('subway') || lower.includes('transport') || lower.includes('location')) return <MapIcon className="w-5 h-5 text-green-600" />;
    if (lower.includes('quiet')) return <SpeakerXMarkIcon className="w-5 h-5 text-green-600" />;
    return <CheckCircleSolidIcon className="w-5 h-5 text-green-600" />;
  }

  // Fallback to fuzzy matching for trade-offs
  if (lower.includes('small') || lower.includes('cramped') || lower.includes('tight')) return <ArrowsPointingInIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('dark') || lower.includes('no natural light') || lower.includes('poor lighting')) return <MoonIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('dated') || lower.includes('old') || lower.includes('outdated')) return <ClockIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('noise') || lower.includes('loud')) return <SpeakerWaveIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('wear') || lower.includes('damage') || lower.includes('repair')) return <WrenchScrewdriverIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('clutter') || lower.includes('messy')) return <ArchiveBoxIcon className="w-5 h-5 text-amber-500" />;
  if (lower.includes('staging') || lower.includes('photo')) return <CameraIcon className="w-5 h-5 text-amber-500" />;
  return <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />;
}

export default function ListingDetailPage() {
  const params = useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [enrichedDetails, setEnrichedDetails] = useState<{
    description?: string;
    amenities?: string[];
    buildingAmenities?: {
      services: string[];
      wellness: string[];
      outdoor: string[];
      other: string[];
    };
    petPolicy?: string;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    async function fetchListing() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        if (!res.ok) {
          throw new Error('Listing not found');
        }
        const data = await res.json();
        setListing(data.listing);

        // Fetch enriched details if amenities/description are missing
        if (!data.listing.amenities?.length || !data.listing.description) {
          fetchEnrichedDetails();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    async function fetchEnrichedDetails() {
      setLoadingDetails(true);
      try {
        const res = await fetch(`/api/listings/${params.id}/details`);
        if (res.ok) {
          const data = await res.json();
          setEnrichedDetails(data.details);
        }
      } catch (err) {
        console.error('Failed to fetch enriched details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }

    if (params.id) {
      fetchListing();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Listing Not Found</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link href="/">
          <Button variant="primary">Back to Search</Button>
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
    if (score >= 8) return { label: 'Excellent', color: 'text-green-700 bg-green-50 border-green-200' };
    if (score >= 6) return { label: 'Good', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (score >= 4) return { label: 'Fair', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
    return { label: 'Poor', color: 'text-red-700 bg-red-50 border-red-200' };
  };

  const savings = listing.monthsFree && listing.leaseTermMonths
    ? Math.round((listing.price * listing.monthsFree) / listing.leaseTermMonths)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-gray-200">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="font-semibold text-sm">Back to Search</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Heart className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => window.open(listing.sourceUrl, '_blank')}
            >
              View on StreetEasy
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section with Verdict */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-grow">
               <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Badges */}
                {listing.noFee && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold uppercase tracking-wide border border-gray-200">
                    No Fee
                  </span>
                )}
                {listing.upcomingOpenHouse && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold uppercase tracking-wide border border-blue-100">
                    Open House
                  </span>
                )}
               </div>

              <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
                {extractBuildingName(listing.sourceUrl) || listing.addressText}
              </h1>
              <div className="flex items-center text-gray-500 text-lg font-medium">
                <MapPin className="w-5 h-5 mr-1.5 text-gray-400" />
                {listing.neighborhood}{listing.borough ? `, ${listing.borough}` : ''}
              </div>
            </div>

            {/* Price & Score Block */}
            <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-1">
              {/* Verdict Badge */}
              {listing.storedImageAnalysis && (
                <div className={`flex items-center gap-3 px-4 py-2 rounded-xl mb-2 ${getQualityLabel(listing.storedImageAnalysis.overallQuality).color.replace('text-', 'bg-').split(' ')[0].replace('600', '100')} ${getQualityLabel(listing.storedImageAnalysis.overallQuality).color.split(' ')[0]}`}>
                   <div className="text-3xl font-black tracking-tighter">
                     {listing.storedImageAnalysis.overallQuality.toFixed(1)}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase opacity-70 leading-none mb-0.5">Analyst Verdict</span>
                     <span className="text-sm font-black uppercase tracking-wide leading-none">
                       {getQualityLabel(listing.storedImageAnalysis.overallQuality).label}
                     </span>
                   </div>
                </div>
              )}
              
              <div className="text-right">
                <div className="text-3xl font-extrabold text-gray-900">
                  {formatPrice(listing.price)}
                  <span className="text-lg font-medium text-gray-500 ml-1">/mo</span>
                </div>
                {listing.netEffectivePrice && listing.netEffectivePrice !== listing.price && (
                  <div className="text-green-700 font-bold text-sm">
                    {formatPrice(listing.netEffectivePrice)} net
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Gallery (Now First) */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
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
                    
                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      {selectedImage + 1} / {listing.images.length}
                    </div>

                    {listing.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedImage(i => (i > 0 ? i - 1 : listing.images.length - 1))}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-2.5 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all transform -translate-x-4 group-hover:translate-x-0"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => setSelectedImage(i => (i < listing.images.length - 1 ? i + 1 : 0))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-2.5 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  <div className="p-4 flex gap-3 overflow-x-auto scrollbar-hide">
                    {listing.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(i)}
                        className={`relative w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                          selectedImage === i 
                            ? 'ring-2 ring-indigo-600 ring-offset-2 opacity-100' 
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <Image src={img} alt={`Thumbnail ${i + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-300" />
                  <span className="text-gray-400 ml-2">No photos available</span>
                </div>
              )}
            </div>

            {/* Analyst Audit (The "Why") */}
            {listing.storedImageAnalysis && (
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
                <div className="mb-8">
                   <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="w-6 h-6 text-gray-900" />
                      Analyst Audit
                   </h2>
                </div>

                <div className="space-y-10">
                   {/* Summary - Clean & Direct */}
                    <div>
                        {listing.storedImageAnalysis.vibe && (
                          <div className="mb-2 text-sm font-semibold text-indigo-600 uppercase tracking-wide">
                            {listing.storedImageAnalysis.vibe}
                          </div>
                        )}
                        <p className="text-gray-900 text-xl leading-relaxed font-medium">
                          {cleanSummary(listing.storedImageAnalysis.summary)}
                        </p>
                    </div>

                    {/* Metrics Dashboard - Airbnb Style */}
                    <div className="flex justify-between items-start border-t border-b border-gray-100 py-8">
                        {[
                          { label: 'Light', val: listing.storedImageAnalysis.light },
                          { label: 'Space', val: listing.storedImageAnalysis.spaciousness },
                          { label: 'Cleanliness', val: listing.storedImageAnalysis.cleanliness },
                          { label: 'Modernity', val: listing.storedImageAnalysis.renovation },
                        ].map((metric) => (
                          <div key={metric.label} className="flex flex-col items-center flex-1">
                            <div className="text-4xl font-bold text-gray-900 mb-2">{metric.val?.toFixed(1) || '-'}</div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{metric.label}</div>
                          </div>
                        ))}
                    </div>

                    {/* Audit Columns: Standouts vs Trade-offs */}
                     {(listing.storedImageAnalysis.features?.length || listing.storedImageAnalysis.concerns?.length) ? (
                      <div className="grid md:grid-cols-2 gap-12">
                        {/* Standouts Column */}
                        {listing.storedImageAnalysis.features && listing.storedImageAnalysis.features.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">
                              Standouts
                            </h4>
                            <ul className="space-y-4">
                              {listing.storedImageAnalysis.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-gray-700">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {getIconForItem(feature, true)}
                                  </div>
                                  <span className="text-base">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Trade-offs Column */}
                        {(() => {
                          const filteredConcerns = filterConcerns(
                            listing.storedImageAnalysis.concerns || [],
                            listing.storedImageAnalysis
                          );
                          return filteredConcerns.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">
                                Trade-offs
                              </h4>
                              <ul className="space-y-4">
                                {filteredConcerns.map((concern, i) => (
                                  <li key={i} className="flex items-start gap-3 text-gray-700">
                                    <div className="flex-shrink-0 mt-0.5">
                                      {getIconForItem(concern, false)}
                                    </div>
                                    <span className="text-base">{concern}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                </div>
              </div>
            )}

            {/* Description & Amenities */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">About this home</h2>
              
              <Description text={listing.description || enrichedDetails?.description || 'No description available.'} />

              {/* Building Amenities List */}
              {((listing.amenities && listing.amenities.length > 0) || enrichedDetails?.buildingAmenities) && (
                <div className="border-t pt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Amenities</h3>
                  {loadingDetails ? (
                    <div className="text-gray-400 italic">Loading details...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                      {(enrichedDetails?.buildingAmenities?.services || []).map((a, i) => (
                        <div key={i} className="flex items-center gap-3 text-gray-700">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                           {a}
                        </div>
                      ))}
                      {(!enrichedDetails?.buildingAmenities && listing.amenities || []).map((a, i) => (
                         <div key={i} className="flex items-center gap-3 text-gray-700">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                           {a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 sticky top-24">
              <div className="mb-6">
                <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {formatPrice(listing.price)}
                  <span className="text-base font-medium text-gray-500 ml-1">/mo</span>
                </div>
              {listing.netEffectivePrice && listing.netEffectivePrice !== listing.price && (
                <div className="text-green-700 font-semibold text-sm mt-1">
                  {formatPrice(listing.netEffectivePrice)} net effective
                </div>
              )}
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-500 font-medium text-sm">Bedrooms</span>
                  <span className="text-gray-900 font-bold">{listing.beds || 'Studio'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-500 font-medium text-sm">Bathrooms</span>
                  <span className="text-gray-900 font-bold">{listing.baths}</span>
                </div>
                {listing.sqft && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 font-medium">Size</span>
                    <span className="text-gray-900 font-bold">{listing.sqft.toLocaleString()} sqft</span>
                  </div>
                )}
                {listing.availableDate && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 font-medium">Available</span>
                    <span className="text-gray-900 font-bold">{formatDate(listing.availableDate)}</span>
                  </div>
                )}
                {listing.firstSeenAt && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 font-medium">Days on Market</span>
                    <span className={`font-bold ${getDaysOnMarket(listing.firstSeenAt) <= 3 ? 'text-green-700' : getDaysOnMarket(listing.firstSeenAt) > 30 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {getDaysOnMarket(listing.firstSeenAt) === 0 ? 'New today' : `${getDaysOnMarket(listing.firstSeenAt)} days`}
                    </span>
                  </div>
                )}
              </div>

              {/* Price History */}
              {listing.priceHistory && listing.priceHistory.length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Price History
                  </p>
                  <div className="space-y-1">
                    {listing.priceHistory.slice(-3).reverse().map((ph, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-blue-600">{formatDate(ph.date)}</span>
                        <span className="text-blue-800 font-medium">{formatPrice(ph.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {savings > 0 && (
                 <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-green-800 font-bold text-sm">Potential Savings</p>
                    <p className="text-green-700 text-xs mt-1">
                      Save approx. <span className="font-bold">{formatPrice(savings)}/mo</span> with free months
                    </p>
                 </div>
              )}

              <Button 
                variant="primary" 
                size="lg" 
                className="w-full shadow-lg shadow-indigo-200"
                onClick={() => window.open(listing.sourceUrl, '_blank')}
              >
                Check Availability
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              
              <div className="mt-4 text-center">
                <span className="text-xs text-gray-400 font-medium">
                  Listed by {listing.brokerCompany || 'Agent'}
                </span>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
               <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <h3 className="font-bold text-gray-900">Location</h3>
               </div>
               <p className="text-gray-600 mb-4 font-medium">
                 {listing.addressText}
               </p>
               {listing.latitude && listing.longitude && (
                 <a
                    href={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full h-32 bg-gray-100 rounded-xl relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-black/10 transition-colors">
                       <span className="text-xs font-bold text-gray-600 bg-white/80 backdrop-blur px-3 py-1 rounded-full">
                         View on Maps
                       </span>
                    </div>
                  </a>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
