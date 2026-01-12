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
  imageAnalysis?: HFImageAnalysis;
  dealRating: 'exceptional' | 'great' | 'good' | 'fair' | 'poor';
  priceAssessment: string;
}

// Hugging Face image analysis results
export interface HFImageAnalysis {
  images: ImageRating[];
  overallCleanliness: number;
  overallLight: number;
  overallRenovation: number;
  summary: string;
}

export interface ImageRating {
  imageUrl: string;
  roomType: string;
  cleanliness: number;
  naturalLight: number;
  renovationLevel: number;
  spaciousness: number;
  condition: string;
  notes: string;
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
