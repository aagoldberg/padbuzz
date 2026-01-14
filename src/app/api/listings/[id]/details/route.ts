import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getIngestedListingsCollection } from '@/ingestion/db';

/**
 * GET /api/listings/[id]/details
 * Fetch additional details from StreetEasy listing page (amenities, description)
 * This is an on-demand enrichment endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await getIngestedListingsCollection();

    // Find the listing
    let listing;
    if (ObjectId.isValid(id)) {
      listing = await collection.findOne({ _id: new ObjectId(id) });
    }
    if (!listing) {
      listing = await collection.findOne({ listingId: id });
    }
    if (!listing) {
      listing = await collection.findOne({ sourceListingId: id });
    }

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const sourceUrl = listing.sourceUrl as string;
    if (!sourceUrl || !sourceUrl.includes('streeteasy.com')) {
      return NextResponse.json({ error: 'Not a StreetEasy listing' }, { status: 400 });
    }

    // Check if we already have enriched data (cached)
    if (listing.enrichedDetails && listing.enrichedAt) {
      const enrichedAt = new Date(listing.enrichedAt as string);
      const hoursSinceEnriched = (Date.now() - enrichedAt.getTime()) / (1000 * 60 * 60);

      // Return cached data if less than 24 hours old
      if (hoursSinceEnriched < 24) {
        return NextResponse.json({
          cached: true,
          details: listing.enrichedDetails
        });
      }
    }

    // Fetch the StreetEasy listing page
    console.log(`Fetching details from: ${sourceUrl}`);
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        error: `Failed to fetch: ${response.status}`
      }, { status: 502 });
    }

    const html = await response.text();

    // Extract data from the page
    const details = extractStreetEasyDetails(html);

    // Cache the enriched data
    await collection.updateOne(
      { _id: listing._id },
      {
        $set: {
          enrichedDetails: details,
          enrichedAt: new Date(),
          // Also update main fields if we got new data
          ...(details.description && !listing.description ? { description: details.description } : {}),
          ...(details.amenities.length > 0 ? { amenities: details.amenities } : {}),
        }
      }
    );

    return NextResponse.json({
      cached: false,
      details
    });
  } catch (error) {
    console.error('Error fetching listing details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing details' },
      { status: 500 }
    );
  }
}

interface ListingDetails {
  description: string | null;
  amenities: string[];
  buildingAmenities: {
    services: string[];
    wellness: string[];
    outdoor: string[];
    other: string[];
  };
  unitFeatures: string[];
  petPolicy: string | null;
  floorplanUrl: string | null;
}

function extractStreetEasyDetails(html: string): ListingDetails {
  const details: ListingDetails = {
    description: null,
    amenities: [],
    buildingAmenities: {
      services: [],
      wellness: [],
      outdoor: [],
      other: [],
    },
    unitFeatures: [],
    petPolicy: null,
    floorplanUrl: null,
  };

  // Try to extract from __NEXT_DATA__ (Next.js embedded data)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const pageProps = nextData?.props?.pageProps;

      // Look for listing data in various places
      const listing = pageProps?.listing || pageProps?.rentalListing || pageProps?.data?.listing;
      const building = pageProps?.building || listing?.building;

      if (listing?.description) {
        details.description = listing.description;
      }

      // Extract amenities from building
      if (building?.amenities) {
        for (const amenity of building.amenities) {
          const name = amenity.name || amenity.displayName || amenity;
          if (typeof name === 'string' && !details.amenities.includes(name)) {
            details.amenities.push(name);
          }
        }
      }

      // Look for amenities in different structures
      if (listing?.amenities) {
        for (const amenity of listing.amenities) {
          const name = amenity.name || amenity.displayName || amenity;
          if (typeof name === 'string' && !details.amenities.includes(name)) {
            details.amenities.push(name);
          }
        }
      }

      // Pet policy
      if (building?.petPolicy || listing?.petPolicy) {
        details.petPolicy = building?.petPolicy || listing?.petPolicy;
      }

    } catch (e) {
      console.error('Failed to parse __NEXT_DATA__:', e);
    }
  }

  // Extract description from meta tag if not found
  if (!details.description) {
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (metaDescMatch) {
      details.description = metaDescMatch[1];
    }
  }

  // Try to extract from JSON-LD
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd.description && !details.description) {
        details.description = jsonLd.description;
      }
      if (jsonLd.amenityFeature) {
        for (const a of jsonLd.amenityFeature) {
          const name = a.name || a;
          if (typeof name === 'string' && !details.amenities.includes(name)) {
            details.amenities.push(name);
          }
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Extract amenities from HTML patterns
  const amenityPatterns = [
    /data-amenity-name="([^"]+)"/g,
    /"amenityName"\s*:\s*"([^"]+)"/g,
    /class="[^"]*amenity[^"]*"[^>]*>([^<]{3,50})</gi,
  ];

  for (const pattern of amenityPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const amenity = match[1].trim();
      if (amenity && amenity.length < 50 && !details.amenities.includes(amenity)) {
        details.amenities.push(amenity);
      }
    }
  }

  // Extract pet policy from text
  if (!details.petPolicy) {
    const petMatch = html.match(/(?:pets?|dogs?|cats?)[^<]{0,30}(?:allowed|welcome|ok|permitted|no pets)/i);
    if (petMatch) {
      details.petPolicy = petMatch[0].trim();
    }
  }

  // Extract floorplan URL
  const floorplanMatch = html.match(/(?:floorplan|floor-plan)[^"]*\.(?:jpg|png|webp|gif)/i);
  if (floorplanMatch) {
    details.floorplanUrl = floorplanMatch[0];
  }

  // Categorize amenities
  const serviceKeywords = ['doorman', 'concierge', 'elevator', 'laundry', 'package', 'parking', 'storage', 'super', 'bike', 'mail', 'valet'];
  const wellnessKeywords = ['gym', 'pool', 'fitness', 'yoga', 'sauna', 'spa', 'playroom', 'media', 'lounge', 'game', 'theater', 'screening'];
  const outdoorKeywords = ['roof', 'deck', 'patio', 'garden', 'courtyard', 'terrace', 'balcony', 'outdoor', 'bbq', 'grill'];

  for (const amenity of details.amenities) {
    const lower = amenity.toLowerCase();
    if (serviceKeywords.some(k => lower.includes(k))) {
      details.buildingAmenities.services.push(amenity);
    } else if (wellnessKeywords.some(k => lower.includes(k))) {
      details.buildingAmenities.wellness.push(amenity);
    } else if (outdoorKeywords.some(k => lower.includes(k))) {
      details.buildingAmenities.outdoor.push(amenity);
    } else {
      details.buildingAmenities.other.push(amenity);
    }
  }

  return details;
}
