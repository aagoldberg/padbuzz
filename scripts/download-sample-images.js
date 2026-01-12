const fs = require('fs');
const path = require('path');
const https = require('https');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = 'streeteasy';
const IMAGES_DIR = path.join(__dirname, '../public/apartment-images');

// High-quality apartment/interior photos from Unsplash
const UNSPLASH_APARTMENT_PHOTOS = [
  // Living rooms
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  // Bedrooms
  'https://images.unsplash.com/photo-1560185127-6a8c72a1c4b9?w=800&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
  'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800&q=80',
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',
  'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&q=80',
  // Kitchens
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
  'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
  // Bathrooms
  'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80',
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
  // Modern apartments
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80',
  'https://images.unsplash.com/photo-1600607687644-c7f34b5063c7?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?w=800&q=80',
  // City views
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  // More interiors
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
  'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
  'https://images.unsplash.com/photo-1600566752547-33b9e6e8e754?w=800&q=80',
];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(filepath);
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading sample apartment images...\n');

  // Create images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Download all images
  const downloadedImages = [];
  for (let i = 0; i < UNSPLASH_APARTMENT_PHOTOS.length; i++) {
    const url = UNSPLASH_APARTMENT_PHOTOS[i];
    const filename = `apartment-${i + 1}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log(`  [${i + 1}/${UNSPLASH_APARTMENT_PHOTOS.length}] Already exists: ${filename}`);
      downloadedImages.push(`/apartment-images/${filename}`);
      continue;
    }

    try {
      console.log(`  [${i + 1}/${UNSPLASH_APARTMENT_PHOTOS.length}] Downloading: ${filename}`);
      await downloadImage(url, filepath);
      downloadedImages.push(`/apartment-images/${filename}`);
    } catch (error) {
      console.error(`  Failed to download ${filename}:`, error.message);
    }
  }

  console.log(`\nDownloaded ${downloadedImages.length} images`);

  // Update MongoDB listings with sample images
  console.log('\nUpdating MongoDB listings with sample images...');

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(MONGODB_DB);
  const collection = db.collection('listings');

  // Get active listings
  const listings = await collection.find({
    scrapeStatus: { $ne: 'DELETED' },
    'layout.beds': { $ne: null },
    price: { $gt: 0 },
  }).limit(200).toArray();

  console.log(`Found ${listings.length} active listings to update`);

  let updated = 0;
  for (const listing of listings) {
    // Assign 2-4 random images to each listing
    const numImages = 2 + Math.floor(Math.random() * 3);
    const shuffled = [...downloadedImages].sort(() => Math.random() - 0.5);
    const images = shuffled.slice(0, numImages);

    await collection.updateOne(
      { _id: listing._id },
      { $set: { localImages: images } }
    );
    updated++;
  }

  console.log(`Updated ${updated} listings with local images`);

  await client.close();
  console.log('\nDone!');
}

main().catch(console.error);
