export interface Apartment {
  _id: string;
  url: string;
  address: string;
  neighborhood: string;
  borough: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  description?: string;
  amenities: string[];
  images: string[];
  buildingUrl?: string;
  noFee?: boolean;
  rentStabilized?: boolean;
  availableDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  scrapeStatus?: string;
}

export interface ApartmentWithAnalysis extends Apartment {
  aiAnalysis?: AIAnalysis;
  matchScore?: number;
  dealScore?: number;
}

export interface AIAnalysis {
  overallScore: number;
  pros: string[];
  cons: string[];
  summary: string;
  imageAnalysis?: ImageAnalysis[];
  dealRating: 'exceptional' | 'great' | 'good' | 'fair' | 'poor';
  priceAssessment: string;
}

export interface ImageAnalysis {
  imageUrl: string;
  description: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  highlights: string[];
  concerns: string[];
}

export interface UserPreferences {
  maxPrice: number;
  minBedrooms: number;
  minBathrooms: number;
  preferredNeighborhoods: string[];
  mustHaveAmenities: string[];
  niceToHaveAmenities: string[];
  priorities: string[];
  dealBreakers: string[];
  additionalNotes?: string;
}

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  neighborhoods?: string[];
  noFeeOnly?: boolean;
  rentStabilizedOnly?: boolean;
}

export interface Subscriber {
  _id: string;
  email: string;
  phone?: string;
  preferences: UserPreferences;
  isPaid: boolean;
  subscriptionTier: 'free' | 'premium' | 'vip';
  createdAt: Date;
  notificationSettings: {
    email: boolean;
    sms: boolean;
    instantAlerts: boolean;
  };
}

export interface DealAlert {
  _id: string;
  apartmentId: string;
  apartment: Apartment;
  aiAnalysis: AIAnalysis;
  dealScore: number;
  sentAt?: Date;
  subscribers: string[];
}
