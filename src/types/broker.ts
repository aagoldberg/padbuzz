import { ObjectId } from 'mongodb';

/**
 * Broker account - individual agent or brokerage admin
 */
export interface Broker {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;

  // License info
  licenseNumber: string;
  licenseState: string;
  licenseVerified: boolean;
  licenseVerifiedAt?: Date;

  // Brokerage association
  brokerageId?: ObjectId;
  brokerageName?: string; // Denormalized for display
  role: 'admin' | 'agent';

  // Profile
  profileImage?: string;
  bio?: string;

  // Settings
  emailNotifications: boolean;

  // Timestamps
  createdAt: Date;
  lastLoginAt?: Date;

  // Status
  status: 'pending' | 'active' | 'suspended';
}

/**
 * Brokerage company
 */
export interface Brokerage {
  _id?: ObjectId;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  logo?: string;

  // Primary contact (admin broker)
  primaryContactId: ObjectId;

  // Settings
  settings: {
    defaultNoFee: boolean;
    requireApproval: boolean; // Require admin approval for agent listings
  };

  // Stats
  listingCount: number;
  agentCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Status
  status: 'active' | 'suspended';
}

/**
 * Broker-submitted listing (extends base listing)
 */
export interface BrokerListing {
  _id?: ObjectId;

  // Broker info
  brokerId: ObjectId;
  brokerageId?: ObjectId;

  // Listing details
  address: {
    street: string;
    unit?: string;
    city: string;
    state: string;
    zip: string;
    neighborhood?: string;
    borough?: string;
  };

  price: number;
  beds: number;
  baths: number;
  sqft?: number;

  description?: string;

  // Dates
  availableDate?: Date;
  leaseTermMonths?: number;

  // Features
  noFee: boolean;
  furnished: boolean;
  petPolicy: 'no_pets' | 'cats_ok' | 'dogs_ok' | 'all_pets';

  // Media
  images: string[];
  virtualTourUrl?: string;

  // Amenities
  unitAmenities: string[];
  buildingAmenities: string[];

  // Contact override (if different from broker profile)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Status
  status: 'draft' | 'pending_review' | 'active' | 'rented' | 'off_market';

  // Analytics
  views: number;
  saves: number;
  inquiries: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  // After AI analysis
  storedImageAnalysis?: {
    overallQuality: number;
    cleanliness: number;
    light: number;
    renovation: number;
    spaciousness: number;
    coziness: number;
    charm: number;
    style: string[];
    vibe: string;
    features: string[];
    buildingAmenities: string[];
    concerns: string[];
    summary: string;
    analyzedAt: Date;
  };
}

/**
 * Lead/inquiry from a renter
 */
export interface Lead {
  _id?: ObjectId;
  listingId: ObjectId;
  brokerId: ObjectId;

  // Renter info
  name: string;
  email: string;
  phone?: string;
  message?: string;

  // Status
  status: 'new' | 'contacted' | 'scheduled' | 'closed';

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  respondedAt?: Date;
}

/**
 * Session token for broker auth
 */
export interface BrokerSession {
  _id?: ObjectId;
  brokerId: ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Form types for frontend
export interface BrokerRegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  licenseState: string;
  brokerageName?: string;
}

export interface BrokerLoginForm {
  email: string;
  password: string;
}

export interface ListingForm {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  neighborhood?: string;
  borough?: string;

  price: number;
  beds: number;
  baths: number;
  sqft?: number;

  description?: string;
  availableDate?: string;
  leaseTermMonths?: number;

  noFee: boolean;
  furnished: boolean;
  petPolicy: 'no_pets' | 'cats_ok' | 'dogs_ok' | 'all_pets';

  virtualTourUrl?: string;

  unitAmenities: string[];
  buildingAmenities: string[];

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

// Constants
export const UNIT_AMENITIES = [
  'Dishwasher',
  'In-Unit Laundry',
  'Central Air',
  'Hardwood Floors',
  'Stainless Appliances',
  'Granite Counters',
  'Walk-In Closet',
  'Balcony',
  'Fireplace',
  'High Ceilings',
  'Exposed Brick',
  'Home Office',
  'Storage',
] as const;

export const BUILDING_AMENITIES = [
  'Doorman',
  'Elevator',
  'Gym',
  'Pool',
  'Rooftop',
  'Laundry Room',
  'Package Room',
  'Bike Storage',
  'Parking',
  'Courtyard',
  'Live-In Super',
  'Concierge',
  'Pet Friendly',
] as const;

export const NYC_BOROUGHS = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island',
] as const;

export const NYC_NEIGHBORHOODS: Record<string, string[]> = {
  Manhattan: [
    'Upper East Side', 'Upper West Side', 'Midtown', 'Chelsea', 'Greenwich Village',
    'East Village', 'West Village', 'SoHo', 'Tribeca', 'Financial District',
    'Lower East Side', 'Harlem', 'Washington Heights', 'Inwood', 'Murray Hill',
    'Gramercy', 'Flatiron', 'NoHo', 'Nolita', 'Chinatown', 'Hell\'s Kitchen',
  ],
  Brooklyn: [
    'Williamsburg', 'Greenpoint', 'Bushwick', 'Bedford-Stuyvesant', 'Crown Heights',
    'Park Slope', 'DUMBO', 'Brooklyn Heights', 'Prospect Heights', 'Fort Greene',
    'Clinton Hill', 'Cobble Hill', 'Carroll Gardens', 'Red Hook', 'Sunset Park',
    'Bay Ridge', 'Flatbush', 'Ditmas Park', 'Boerum Hill', 'Gowanus',
  ],
  Queens: [
    'Astoria', 'Long Island City', 'Sunnyside', 'Woodside', 'Jackson Heights',
    'Flushing', 'Forest Hills', 'Rego Park', 'Ridgewood', 'Elmhurst',
  ],
  Bronx: [
    'South Bronx', 'Mott Haven', 'Fordham', 'Riverdale', 'Kingsbridge',
  ],
  'Staten Island': [
    'St. George', 'Stapleton', 'Tompkinsville',
  ],
};
