"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mongodb_1 = require("mongodb");
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = 'streeteasy';
const IMAGES_DIR = path.join(__dirname, '../public/apartment-images');
const MAX_LISTINGS = 100;
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const buffer = await response.arrayBuffer();
        const filepath = path.join(IMAGES_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(buffer));
        return `/apartment-images/${filename}`;
    }
    catch (error) {
        console.error(`Failed to download image: ${url}`, error);
        return null;
    }
}
async function scrapeListingPage(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        // Extract listing data
        const data = await page.evaluate(() => {
            const getText = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
            const getAll = (selector) => Array.from(document.querySelectorAll(selector)).map(el => el.textContent?.trim() || '');
            // Price
            const priceText = getText('[data-testid="price"]') || getText('.price') || getText('h1');
            const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
            // Address
            const address = getText('[data-testid="address"]') || getText('.building-title') || getText('h1');
            // Beds/Baths
            const detailsText = getText('[data-testid="details"]') || getText('.details') || '';
            const bedsMatch = detailsText.match(/(\d+)\s*(?:bed|br)/i);
            const bathsMatch = detailsText.match(/(\d+)\s*(?:bath|ba)/i);
            const sqftMatch = detailsText.match(/([\d,]+)\s*(?:sq|ft)/i);
            // Description
            const description = getText('[data-testid="description"]') || getText('.description') || '';
            // Amenities
            const amenities = getAll('[data-testid="amenity"]') || getAll('.amenity') || [];
            // Images
            const images = Array.from(document.querySelectorAll('img[src*="media"], img[src*="image"], .gallery img'))
                .map(img => img.src)
                .filter(src => src && !src.includes('logo') && !src.includes('icon'));
            // Neighborhood from breadcrumbs or URL
            const neighborhood = getText('[data-testid="neighborhood"]') || getText('.neighborhood') || '';
            return {
                price,
                address,
                bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : 0,
                bathrooms: bathsMatch ? parseInt(bathsMatch[1]) : 1,
                sqft: sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : undefined,
                description,
                amenities: amenities.filter(a => a),
                images: images.slice(0, 10),
                neighborhood,
                noFee: description.toLowerCase().includes('no fee') || detailsText.toLowerCase().includes('no fee'),
            };
        });
        if (!data.price || !data.address) {
            console.log(`Skipping ${url} - missing price or address`);
            return null;
        }
        // Download images
        const localImages = [];
        const listingId = url.split('/').pop() || Date.now().toString();
        for (let i = 0; i < Math.min(data.images.length, 5); i++) {
            const imgUrl = data.images[i];
            const filename = `${listingId}-${i}.jpg`;
            const localPath = await downloadImage(imgUrl, filename);
            if (localPath) {
                localImages.push(localPath);
            }
        }
        // Extract borough from address
        const addressLower = data.address.toLowerCase();
        let borough = 'Manhattan';
        if (addressLower.includes('brooklyn'))
            borough = 'Brooklyn';
        else if (addressLower.includes('queens'))
            borough = 'Queens';
        else if (addressLower.includes('bronx'))
            borough = 'Bronx';
        else if (addressLower.includes('staten island'))
            borough = 'Staten Island';
        return {
            url,
            address: data.address,
            neighborhood: data.neighborhood || 'NYC',
            borough,
            price: data.price,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms,
            sqft: data.sqft,
            description: data.description,
            amenities: data.amenities,
            images: localImages.length > 0 ? localImages : data.images,
            noFee: data.noFee,
            scrapedAt: new Date(),
        };
    }
    catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}
async function scrapeStreetEasy() {
    console.log('Starting StreetEasy scraper...');
    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    const browser = await playwright_1.chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const listings = [];
    const neighborhoods = [
        'manhattan/upper-east-side',
        'manhattan/upper-west-side',
        'manhattan/chelsea',
        'manhattan/east-village',
        'manhattan/west-village',
        'brooklyn/williamsburg',
        'brooklyn/park-slope',
        'brooklyn/brooklyn-heights',
        'queens/astoria',
        'queens/long-island-city',
    ];
    for (const neighborhood of neighborhoods) {
        if (listings.length >= MAX_LISTINGS)
            break;
        const searchUrl = `https://streeteasy.com/for-rent/${neighborhood}?sort_by=listed_desc`;
        console.log(`\nScraping: ${searchUrl}`);
        try {
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(3000);
            // Get listing URLs from search results
            const listingUrls = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/building/"], a[href*="/rental/"]');
                return Array.from(links)
                    .map(a => a.href)
                    .filter(href => href.includes('/building/') || href.includes('/rental/'))
                    .slice(0, 15);
            });
            console.log(`Found ${listingUrls.length} listings in ${neighborhood}`);
            for (const listingUrl of listingUrls) {
                if (listings.length >= MAX_LISTINGS)
                    break;
                console.log(`  Scraping: ${listingUrl}`);
                const listing = await scrapeListingPage(page, listingUrl);
                if (listing) {
                    listings.push(listing);
                    console.log(`  ✓ ${listing.address} - $${listing.price} (${listing.images.length} images)`);
                }
                // Be nice to the server
                await page.waitForTimeout(2000 + Math.random() * 2000);
            }
        }
        catch (error) {
            console.error(`Error scraping ${neighborhood}:`, error);
        }
    }
    await browser.close();
    console.log(`\nScraped ${listings.length} listings total`);
    // Save to MongoDB
    if (listings.length > 0) {
        console.log('Saving to MongoDB...');
        const client = await mongodb_1.MongoClient.connect(MONGODB_URI);
        const db = client.db(MONGODB_DB);
        const collection = db.collection('scraped_listings');
        // Clear old scraped listings
        await collection.deleteMany({});
        // Insert new listings
        await collection.insertMany(listings.map(l => ({
            ...l,
            layout: { beds: l.bedrooms, baths: l.bathrooms, sqft: l.sqft },
            listingAmmenities: l.amenities,
            createdAt: l.scrapedAt,
            updatedAt: l.scrapedAt,
            scrapeStatus: 'ACTIVE',
        })));
        await client.close();
        console.log('✓ Saved to MongoDB');
    }
    // Also save as JSON backup
    const jsonPath = path.join(__dirname, '../scraped-listings.json');
    fs.writeFileSync(jsonPath, JSON.stringify(listings, null, 2));
    console.log(`✓ Saved to ${jsonPath}`);
    return listings;
}
// Run the scraper
scrapeStreetEasy().catch(console.error);
