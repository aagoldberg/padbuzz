import * as cheerio from 'cheerio';
import { BaseAdapter } from './base';
import { SourceConfig, RawPage, NormalizedListing, ListingUrlResult } from '../types';

/**
 * Craigslist NYC Adapter
 * Supports apartments, sublets, and rooms/shared categories
 */
export class CraigslistAdapter extends BaseAdapter {
  constructor(config: SourceConfig) {
    super(config);
  }

  /**
   * List all listing URLs from Craigslist search pages
   */
  async listListingUrls(params?: {
    borough?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<ListingUrlResult[]> {
    const { urls } = this.config;
    const category = params?.category || '/search/apa';
    const page = params?.page || 0;

    let searchUrl = `${urls.base}${category}`;

    // Add borough filter if specified
    if (params?.borough && urls.boroughFilters) {
      const filter = urls.boroughFilters[params.borough];
      if (filter) {
        searchUrl += filter;
      }
    }

    // Add pagination
    if (page > 0) {
      const separator = searchUrl.includes('?') ? '&' : '?';
      searchUrl += `${separator}s=${page * 120}`; // Craigslist uses 120 per page
    }

    const rawPage = await this.fetch(searchUrl);

    if (rawPage.httpStatus !== 200) {
      console.error(`Failed to fetch Craigslist search: ${rawPage.httpStatus}`);
      return [];
    }

    return this.parseSearchPage(rawPage.htmlContent);
  }

  /**
   * Parse a Craigslist search results page to extract listing URLs
   */
  private parseSearchPage(html: string): ListingUrlResult[] {
    const $ = cheerio.load(html);
    const results: ListingUrlResult[] = [];

    // Craigslist 2024 structure: .cl-search-result or .result-row
    $('li.cl-search-result, .result-row').each((_, element) => {
      const $el = $(element);

      // Get listing URL
      const linkEl = $el.find('a.cl-app-anchor, a.result-title');
      const href = linkEl.attr('href');

      if (!href) return;

      // Make absolute URL
      const url = href.startsWith('http')
        ? href
        : `${this.config.urls.base}${href}`;

      // Extract Craigslist posting ID from URL
      const idMatch = url.match(/\/(\d+)\.html/);
      const sourceListingId = idMatch ? idMatch[1] : undefined;

      // Extract preview metadata if available
      const priceEl = $el.find('.priceinfo, .result-price');
      const price = this.cleanPrice(priceEl.text());

      const metaEl = $el.find('.meta, .housing');
      const metaText = metaEl.text();

      results.push({
        url,
        sourceListingId,
        metadata: {
          previewPrice: price,
          previewMeta: metaText,
        },
      });
    });

    return results;
  }

  /**
   * Parse a Craigslist listing detail page
   */
  async parse(rawPage: RawPage): Promise<NormalizedListing[]> {
    if (rawPage.httpStatus !== 200 || !rawPage.htmlContent) {
      return [];
    }

    const $ = cheerio.load(rawPage.htmlContent);

    // Extract Craigslist posting ID
    const idMatch = rawPage.url.match(/\/(\d+)\.html/);
    const sourceListingId = idMatch ? idMatch[1] : undefined;

    // Title
    const title = $('#titletextonly, .postingtitletext').text().trim() ||
                  $('title').text().split(' - ')[0].trim();

    // Price
    const priceText = $('.price, .postingtitletext .price').text();
    const price = this.cleanPrice(priceText);

    if (!price || price < 500 || price > 50000) {
      // Invalid price, likely spam
      return [];
    }

    // Housing info (beds/baths/sqft)
    const housingText = $('.housing, .postingtitletext').text();
    const beds = this.parseBeds(housingText);
    const baths = this.parseBaths(housingText);
    const sqft = this.parseSqft(housingText);

    // Address/Location
    const mapAddress = $('#map').attr('data-address') || '';
    const locationText = $('.mapaddress').text().trim() ||
                        $('small').text().trim() ||
                        '';

    // Try multiple sources for address
    let addressText = mapAddress || locationText;

    // Get neighborhood from breadcrumb or title
    const breadcrumb = $('.breadcrumb-subarea, .subarea').text().trim();
    const neighborhood = breadcrumb || this.inferNeighborhood(addressText + ' ' + title);

    // Determine borough
    const borough = this.inferBoroughFromAddress(addressText + ' ' + neighborhood + ' ' + title);

    // If no address, use neighborhood
    if (!addressText && neighborhood) {
      addressText = neighborhood;
    }

    // Images
    const images: string[] = [];
    $('#thumbs a, .gallery img, .iw img').each((_, el) => {
      const src = $(el).attr('href') || $(el).attr('src');
      if (src && src.includes('images.craigslist.org')) {
        // Get full-size image URL
        const fullSize = src.replace('50x50c', '600x450').replace('300x300', '600x450');
        if (!images.includes(fullSize)) {
          images.push(fullSize);
        }
      }
    });

    // Also check for images in data attributes
    const imageData = $('#thumbs').attr('data-images');
    if (imageData) {
      try {
        const parsed = JSON.parse(imageData);
        if (Array.isArray(parsed)) {
          parsed.forEach((img: { url?: string }) => {
            if (img.url && !images.includes(img.url)) {
              images.push(img.url);
            }
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Description
    const description = $('#postingbody')
      .clone()
      .children('.print-information, .show-contact')
      .remove()
      .end()
      .text()
      .trim();

    // Amenities from attributes
    const amenities: string[] = [];
    $('.mapAndAttrs .attrgroup span, .attrgroup span').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.match(/^\$?\d/)) {
        amenities.push(text);
      }
    });

    // Check for no-fee indication
    const fullText = (title + ' ' + description).toLowerCase();
    const noFee = /no\s*fee|no\s*broker|owner|landlord/i.test(fullText);

    // Check for spam indicators
    if (this.isLikelySpam(title, description, price, beds)) {
      return [];
    }

    const listing = this.createBaseListing({
      sourceListingId,
      sourceUrl: rawPage.url,
      rawPageId: rawPage._id,
      title,
      price,
      beds,
      baths,
      sqft: sqft || undefined,
      addressText: this.normalizeAddress(addressText),
      neighborhood,
      borough,
      images,
      description,
      amenities,
      noFee,
    });

    return [listing];
  }

  /**
   * Detect spam/scam listings
   */
  private isLikelySpam(title: string, description: string, price: number, beds: number): boolean {
    const text = `${title} ${description}`.toLowerCase();

    // Price too low for NYC
    if (beds === 0 && price < 1200) return true;
    if (beds === 1 && price < 1500) return true;
    if (beds >= 2 && price < 1800) return true;

    // Common spam phrases
    const spamPhrases = [
      'section 8',
      'voucher',
      'send me your',
      'western union',
      'wire transfer',
      'first and last month',
      'move in today',
      'no credit check no',
      'call or text',
      'must see pics',
      'dont miss',
    ];

    for (const phrase of spamPhrases) {
      if (text.includes(phrase)) return true;
    }

    // Too many phone numbers in description (often scams)
    const phoneMatches = text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g);
    if (phoneMatches && phoneMatches.length > 3) return true;

    return false;
  }
}

// Factory function
export function createCraigslistAdapter(config: SourceConfig): CraigslistAdapter {
  return new CraigslistAdapter(config);
}
