const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = 'streeteasy';
const IMAGES_DIR = path.join(__dirname, '../public/apartment-images');
const MAX_LISTINGS = 100;

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function scrapeListingPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);

    const data = await page.evaluate(() => {
      // Price
      const priceEl = document.querySelector('.price');
      const priceText = priceEl?.textContent || '';
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

      // Title/Address
      const titleEl = document.querySelector('#titletextonly') || document.querySelector('.postingtitletext');
      const title = titleEl?.textContent?.trim() || '';

      // Location
      const locationEl = document.querySelector('.mapaddress') || document.querySelector('small');
      const location = locationEl?.textContent?.trim() || '';

      // Attributes (beds, baths, sqft)
      const attrGroups = document.querySelectorAll('.attrgroup');
      let beds = 0, baths = 1, sqft = null;

      attrGroups.forEach(group => {
        const text = group.textContent || '';
        const bedsMatch = text.match(/(\d+)BR/i) || text.match(/(\d+)\s*br/i);
        const bathsMatch = text.match(/(\d+(?:\.\d+)?)Ba/i) || text.match(/(\d+)\s*bath/i);
        const sqftMatch = text.match(/([\d,]+)\s*ft/i);

        if (bedsMatch) beds = parseInt(bedsMatch[1]);
        if (bathsMatch) baths = parseFloat(bathsMatch[1]);
        if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(',', ''));
      });

      // Description
      const descEl = document.querySelector('#postingbody');
      let description = descEl?.textContent?.trim() || '';
      description = description.replace('QR Code Link to This Post', '').trim();

      // Images
      const images = [];
      document.querySelectorAll('#thumbs a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.includes('images.craigslist.org')) {
          images.push(href);
        }
      });

      // Also check for gallery images
      document.querySelectorAll('.gallery img, .slide img').forEach(img => {
        const src = img.getAttribute('src');
        if (src && src.includes('images.craigslist.org')) {
          images.push(src.replace('50x50c', '600x450'));
        }
      });

      // Neighborhood from breadcrumbs or title
      const breadcrumbs = document.querySelectorAll('.breadcrumbs a');
      let neighborhood = '';
      breadcrumbs.forEach(bc => {
        const text = bc.textContent?.trim();
        if (text && !text.includes('craigslist') && !text.includes('housing') && !text.includes('apts')) {
          neighborhood = text;
        }
      });

      return {
        price,
        title,
        location,
        beds,
        baths,
        sqft,
        description,
        images: [...new Set(images)],
        neighborhood,
        noFee: description.toLowerCase().includes('no fee') || description.toLowerCase().includes('no broker'),
      };
    });

    return data;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting Craigslist NYC apartment scraper...\n');

  // Create images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const listings = [];

  // NYC Craigslist apartment search URLs
  const searchUrls = [
    'https://newyork.craigslist.org/search/mnh/apa?hasPic=1&min_price=1500&max_price=5000#search=1~gallery~0~0',
    'https://newyork.craigslist.org/search/brk/apa?hasPic=1&min_price=1500&max_price=5000#search=1~gallery~0~0',
    'https://newyork.craigslist.org/search/que/apa?hasPic=1&min_price=1500&max_price=4000#search=1~gallery~0~0',
  ];

  for (const searchUrl of searchUrls) {
    if (listings.length >= MAX_LISTINGS) break;

    console.log(`\nSearching: ${searchUrl}`);

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Get listing URLs
      const listingUrls = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('.cl-static-search-result a, .result-row a.result-title, a.posting-title').forEach(a => {
          const href = a.getAttribute('href');
          if (href && href.includes('/apa/')) {
            links.push(href.startsWith('http') ? href : 'https://newyork.craigslist.org' + href);
          }
        });

        // Also try gallery view links
        document.querySelectorAll('.gallery-card a, .cl-search-result a').forEach(a => {
          const href = a.getAttribute('href');
          if (href && href.includes('/apa/')) {
            links.push(href.startsWith('http') ? href : 'https://newyork.craigslist.org' + href);
          }
        });

        return [...new Set(links)];
      });

      console.log(`Found ${listingUrls.length} listings`);

      for (const listingUrl of listingUrls.slice(0, 40)) {
        if (listings.length >= MAX_LISTINGS) break;

        console.log(`  Scraping: ${listingUrl.substring(0, 60)}...`);

        const data = await scrapeListingPage(page, listingUrl);

        if (!data || !data.price || data.images.length === 0) {
          console.log('    Skipped (no price or images)');
          continue;
        }

        // Download images
        const listingId = listingUrl.split('/').pop()?.replace('.html', '') || Date.now().toString();
        const localImages = [];

        for (let i = 0; i < Math.min(data.images.length, 5); i++) {
          const imgUrl = data.images[i];
          const filename = `cl-${listingId}-${i}.jpg`;
          const filepath = path.join(IMAGES_DIR, filename);

          try {
            if (!fs.existsSync(filepath)) {
              await downloadImage(imgUrl, filepath);
            }
            localImages.push(`/apartment-images/${filename}`);
          } catch (err) {
            console.log(`    Failed to download image: ${err.message}`);
          }
        }

        if (localImages.length === 0) {
          console.log('    Skipped (no images downloaded)');
          continue;
        }

        // Determine borough
        let borough = 'Manhattan';
        const loc = (data.location + ' ' + data.neighborhood).toLowerCase();
        if (loc.includes('brooklyn') || loc.includes('brk')) borough = 'Brooklyn';
        else if (loc.includes('queens') || loc.includes('que')) borough = 'Queens';
        else if (loc.includes('bronx')) borough = 'Bronx';
        else if (loc.includes('staten')) borough = 'Staten Island';

        const listing = {
          url: listingUrl,
          address: data.location || data.title,
          neighborhood: data.neighborhood || borough,
          borough,
          price: data.price,
          bedrooms: data.beds,
          bathrooms: data.baths,
          sqft: data.sqft,
          description: data.description,
          amenities: [],
          images: localImages,
          noFee: data.noFee,
          scrapedAt: new Date(),
          source: 'craigslist',
        };

        listings.push(listing);
        console.log(`    ✓ $${data.price} - ${data.beds}BR - ${localImages.length} images`);

        // Be nice
        await page.waitForTimeout(1500 + Math.random() * 1500);
      }
    } catch (error) {
      console.error(`Error with search ${searchUrl}:`, error.message);
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`Scraped ${listings.length} listings with images`);
  console.log(`========================================\n`);

  if (listings.length > 0) {
    // Save to MongoDB
    console.log('Saving to MongoDB...');
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(MONGODB_DB);
    const collection = db.collection('scraped_listings');

    // Clear old scraped listings
    await collection.deleteMany({ source: 'craigslist' });

    // Insert new listings
    await collection.insertMany(listings.map(l => ({
      ...l,
      layout: { beds: l.bedrooms, baths: l.bathrooms, sqft: l.sqft },
      createdAt: l.scrapedAt,
      updatedAt: l.scrapedAt,
      scrapeStatus: 'ACTIVE',
    })));

    await client.close();
    console.log('✓ Saved to MongoDB (scraped_listings collection)');

    // Save JSON backup
    const jsonPath = path.join(__dirname, '../scraped-listings.json');
    fs.writeFileSync(jsonPath, JSON.stringify(listings, null, 2));
    console.log(`✓ Saved to ${jsonPath}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
