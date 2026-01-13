import * as cheerio from 'cheerio';
import { BaseAdapter } from './base';
import { SourceConfig, RawPage, NormalizedListing, ListingUrlResult } from '../types';

/**
 * Generic Broker Site Adapter
 * Uses multiple strategies to extract listings from broker websites:
 * 1. JSON-LD structured data
 * 2. Microdata (schema.org)
 * 3. RSS feeds
 * 4. Sitemap discovery
 * 5. HTML pattern matching
 */
export class GenericBrokerAdapter extends BaseAdapter {
  constructor(config: SourceConfig) {
    super(config);
  }

  /**
   * List all listing URLs using multiple discovery strategies
   */
  async listListingUrls(params?: {
    page?: number;
    limit?: number;
  }): Promise<ListingUrlResult[]> {
    const results: ListingUrlResult[] = [];

    // Strategy 1: Try sitemap first
    if (this.config.urls.sitemap) {
      const sitemapResults = await this.discoverFromSitemap();
      results.push(...sitemapResults);
    }

    // Strategy 2: Crawl search/listing pages
    if (this.config.urls.searchPath) {
      const searchUrl = `${this.config.urls.base}${this.config.urls.searchPath}`;
      const searchResults = await this.discoverFromSearchPage(searchUrl, params?.page || 0);
      results.push(...searchResults);
    }

    // Strategy 3: Try common rental page patterns
    if (results.length === 0) {
      const commonPaths = [
        '/rentals',
        '/for-rent',
        '/apartments',
        '/available-rentals',
        '/listings',
        '/properties',
      ];

      for (const path of commonPaths) {
        try {
          const pageResults = await this.discoverFromSearchPage(
            `${this.config.urls.base}${path}`,
            0
          );
          if (pageResults.length > 0) {
            results.push(...pageResults);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  /**
   * Discover listings from sitemap.xml
   */
  private async discoverFromSitemap(): Promise<ListingUrlResult[]> {
    const results: ListingUrlResult[] = [];
    const sitemapUrl = this.config.urls.sitemap;

    if (!sitemapUrl) return results;

    try {
      const rawPage = await this.fetch(sitemapUrl);
      if (rawPage.httpStatus !== 200) return results;

      const $ = cheerio.load(rawPage.htmlContent, { xmlMode: true });

      // Look for rental/apartment URLs
      $('url loc').each((_, el) => {
        const url = $(el).text().trim();

        // Filter for likely rental listing URLs
        if (this.isLikelyListingUrl(url)) {
          results.push({ url });
        }
      });

      // Check for sitemap index (nested sitemaps)
      $('sitemap loc').each((_, el) => {
        const nestedUrl = $(el).text().trim();
        // Could recursively fetch nested sitemaps, but limit depth
        if (nestedUrl.includes('rental') || nestedUrl.includes('listing')) {
          // TODO: Fetch nested sitemap
        }
      });
    } catch (error) {
      console.error(`Sitemap fetch error for ${this.sourceId}:`, error);
    }

    return results;
  }

  /**
   * Discover listings from a search/listing page
   */
  private async discoverFromSearchPage(
    url: string,
    page: number
  ): Promise<ListingUrlResult[]> {
    const results: ListingUrlResult[] = [];

    // Add pagination if needed
    let pageUrl = url;
    if (page > 0) {
      const separator = url.includes('?') ? '&' : '?';
      pageUrl = `${url}${separator}page=${page + 1}`;
    }

    const rawPage = await this.fetch(pageUrl);
    if (rawPage.httpStatus !== 200) return results;

    const $ = cheerio.load(rawPage.htmlContent);

    // Strategy 1: Look for JSON-LD with listing data
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (this.isRentalListing(item)) {
            const listingUrl = item.url || item['@id'];
            if (listingUrl) {
              results.push({
                url: this.makeAbsoluteUrl(listingUrl),
                metadata: { jsonLd: item },
              });
            }
          }

          // Check for itemList with listings
          if (item['@type'] === 'ItemList' && item.itemListElement) {
            for (const listItem of item.itemListElement) {
              const itemUrl = listItem.url || listItem.item?.url;
              if (itemUrl && this.isLikelyListingUrl(itemUrl)) {
                results.push({ url: this.makeAbsoluteUrl(itemUrl) });
              }
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // Strategy 2: Look for common listing card patterns
    const listingSelectors = [
      'a[href*="/rental/"]',
      'a[href*="/listing/"]',
      'a[href*="/property/"]',
      'a[href*="/apartment/"]',
      '.listing-card a',
      '.property-card a',
      '.rental-item a',
      '[data-listing-id] a',
      '.search-result a',
    ];

    for (const selector of listingSelectors) {
      $(selector).each((_, el) => {
        const href = $(el).attr('href');
        if (href && this.isLikelyListingUrl(href)) {
          results.push({ url: this.makeAbsoluteUrl(href) });
        }
      });
    }

    return results;
  }

  /**
   * Parse a broker listing page using multiple extraction strategies
   */
  async parse(rawPage: RawPage): Promise<NormalizedListing[]> {
    if (rawPage.httpStatus !== 200 || !rawPage.htmlContent) {
      return [];
    }

    const $ = cheerio.load(rawPage.htmlContent);

    // Strategy 1: Try JSON-LD first (most reliable)
    const jsonLdListing = this.extractFromJsonLd($);
    if (jsonLdListing) {
      return [this.createListingFromJsonLd(jsonLdListing, rawPage)];
    }

    // Strategy 2: Try microdata (schema.org)
    const microdataListing = this.extractFromMicrodata($);
    if (microdataListing) {
      return [this.createListingFromMicrodata(microdataListing, rawPage)];
    }

    // Strategy 3: HTML pattern matching
    return [this.extractFromHtml($, rawPage)];
  }

  /**
   * Extract listing data from JSON-LD
   */
  private extractFromJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | null {
    let listing: Record<string, unknown> | null = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (this.isRentalListing(item)) {
            listing = item;
            return false; // Break loop
          }
        }
      } catch {
        // Ignore
      }
    });

    return listing;
  }

  /**
   * Extract listing data from microdata
   */
  private extractFromMicrodata($: cheerio.CheerioAPI): Record<string, unknown> | null {
    const listing: Record<string, unknown> = {};

    // Look for schema.org/Apartment or schema.org/RealEstateListing
    const itemScope = $('[itemtype*="schema.org/Apartment"], [itemtype*="schema.org/RealEstateListing"], [itemtype*="schema.org/Residence"]');

    if (itemScope.length === 0) return null;

    itemScope.find('[itemprop]').each((_, el) => {
      const prop = $(el).attr('itemprop');
      const content = $(el).attr('content') || $(el).text().trim();
      if (prop && content) {
        listing[prop] = content;
      }
    });

    return Object.keys(listing).length > 0 ? listing : null;
  }

  /**
   * Create normalized listing from JSON-LD data
   */
  private createListingFromJsonLd(
    jsonLd: Record<string, unknown>,
    rawPage: RawPage
  ): NormalizedListing {
    const address = jsonLd.address as Record<string, string> || {};

    // Extract price
    let price = 0;
    if (jsonLd.offers) {
      const offers = jsonLd.offers as Record<string, unknown>;
      price = this.cleanPrice(String(offers.price || offers.lowPrice || 0)) || 0;
    }

    // Extract beds/baths
    const beds = parseInt(String(jsonLd.numberOfBedrooms || jsonLd.numberOfRooms || 0), 10);
    const baths = parseFloat(String(jsonLd.numberOfBathroomsTotal || jsonLd.numberOfBathrooms || 1));

    // Extract images
    const images: string[] = [];
    if (jsonLd.image) {
      const imgData = jsonLd.image;
      if (typeof imgData === 'string') {
        images.push(imgData);
      } else if (Array.isArray(imgData)) {
        imgData.forEach((img: string | { url?: string }) => {
          if (typeof img === 'string') images.push(img);
          else if (img.url) images.push(img.url);
        });
      }
    }

    return this.createBaseListing({
      sourceUrl: rawPage.url,
      rawPageId: rawPage._id,
      title: String(jsonLd.name || ''),
      price,
      beds,
      baths,
      sqft: parseInt(String(jsonLd.floorSize || 0), 10) || undefined,
      addressText: this.formatAddress(address),
      neighborhood: address.addressLocality,
      borough: this.inferBoroughFromAddress(this.formatAddress(address)),
      images,
      description: String(jsonLd.description || ''),
      amenities: Array.isArray(jsonLd.amenityFeature)
        ? (jsonLd.amenityFeature as Array<{ name: string }>).map(a => a.name)
        : [],
    });
  }

  /**
   * Create normalized listing from microdata
   */
  private createListingFromMicrodata(
    data: Record<string, unknown>,
    rawPage: RawPage
  ): NormalizedListing {
    return this.createBaseListing({
      sourceUrl: rawPage.url,
      rawPageId: rawPage._id,
      title: String(data.name || ''),
      price: this.cleanPrice(String(data.price || 0)) || 0,
      beds: parseInt(String(data.numberOfBedrooms || 0), 10),
      baths: parseFloat(String(data.numberOfBathrooms || 1)),
      sqft: parseInt(String(data.floorSize || 0), 10) || undefined,
      addressText: String(data.address || data.streetAddress || ''),
      description: String(data.description || ''),
    });
  }

  /**
   * Extract listing data from HTML patterns (fallback)
   */
  private extractFromHtml($: cheerio.CheerioAPI, rawPage: RawPage): NormalizedListing {
    // Common selectors for listing pages
    const title = $('h1').first().text().trim() ||
                  $('[class*="title"]').first().text().trim() ||
                  $('title').text().split('|')[0].trim();

    // Price - look for common patterns
    const priceText = $('[class*="price"]').first().text() ||
                      $('[data-price]').attr('data-price') ||
                      '';
    const price = this.cleanPrice(priceText) || 0;

    // Beds/Baths
    const detailsText = $('[class*="detail"], [class*="info"], [class*="spec"]').text();
    const beds = this.parseBeds(detailsText);
    const baths = this.parseBaths(detailsText);
    const sqft = this.parseSqft(detailsText);

    // Address
    const addressText = $('[class*="address"]').first().text().trim() ||
                        $('address').first().text().trim() ||
                        $('[class*="location"]').first().text().trim();

    // Images
    const images: string[] = [];
    $('[class*="gallery"] img, [class*="photo"] img, [class*="image"] img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('placeholder') && !src.includes('logo')) {
        images.push(this.makeAbsoluteUrl(src));
      }
    });

    // Description
    const description = $('[class*="description"]').first().text().trim() ||
                        $('[class*="content"]').first().text().trim();

    // Amenities
    const amenities: string[] = [];
    $('[class*="amenity"], [class*="feature"] li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 2 && text.length < 50) {
        amenities.push(text);
      }
    });

    return this.createBaseListing({
      sourceUrl: rawPage.url,
      rawPageId: rawPage._id,
      title,
      price,
      beds,
      baths,
      sqft: sqft || undefined,
      addressText: this.normalizeAddress(addressText),
      borough: this.inferBoroughFromAddress(addressText),
      neighborhood: this.inferNeighborhood(addressText),
      images: images.slice(0, 20), // Limit images
      description,
      amenities: amenities.slice(0, 20),
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private isLikelyListingUrl(url: string): boolean {
    const patterns = [
      /\/rental\//i,
      /\/listing\//i,
      /\/property\//i,
      /\/apartment\//i,
      /\/for-rent\//i,
      /\/[A-Z]{2}\d+/i, // Common ID patterns like NY12345
      /\/\d{5,}/i, // Numeric IDs
    ];

    // Exclude common non-listing URLs
    const excludePatterns = [
      /\/search/i,
      /\/contact/i,
      /\/about/i,
      /\/blog/i,
      /\/news/i,
      /\/agent/i,
      /\.(jpg|png|gif|pdf|css|js)$/i,
    ];

    const matchesListing = patterns.some(p => p.test(url));
    const matchesExclude = excludePatterns.some(p => p.test(url));

    return matchesListing && !matchesExclude;
  }

  private isRentalListing(item: Record<string, unknown>): boolean {
    const types = ['Apartment', 'House', 'RealEstateListing', 'Residence', 'SingleFamilyResidence'];
    const itemType = String(item['@type'] || '');

    return types.some(t => itemType.includes(t));
  }

  private makeAbsoluteUrl(url: string): string {
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.config.urls.base}${url}`;
    return `${this.config.urls.base}/${url}`;
  }

  private formatAddress(address: Record<string, string>): string {
    const parts = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
    ].filter(Boolean);

    return parts.join(', ');
  }
}

// Factory function
export function createGenericBrokerAdapter(config: SourceConfig): GenericBrokerAdapter {
  return new GenericBrokerAdapter(config);
}
