import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

export interface ApartmentImageAnalysis {
  images: ImageRating[];
  overallCleanliness: number;
  overallLight: number;
  overallRenovation: number;
  summary: string;
}

const RATING_QUESTIONS = [
  { key: 'roomType', question: 'What type of room is this? Answer with one word: kitchen, bedroom, bathroom, living room, or other.' },
  { key: 'cleanliness', question: 'On a scale of 1-10, how clean does this room appear? Answer with just a number.' },
  { key: 'naturalLight', question: 'On a scale of 1-10, how much natural light is visible? Answer with just a number.' },
  { key: 'renovationLevel', question: 'On a scale of 1-10, how modern/renovated does this space look? Answer with just a number.' },
  { key: 'spaciousness', question: 'On a scale of 1-10, how spacious does this room appear? Answer with just a number.' },
  { key: 'condition', question: 'Describe the overall condition in 2-3 words: excellent, good, fair, poor, or needs work.' },
];

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  // Handle local images by constructing full URL
  const fullUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${imageUrl}`;

  const response = await fetch(fullUrl);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function analyzeImageWithVQA(imageUrl: string): Promise<Partial<ImageRating>> {
  try {
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    const imageBlob = new Blob([Buffer.from(imageBase64, 'base64')], { type: 'image/jpeg' });

    const results: Partial<ImageRating> = { imageUrl };

    // Use BLIP for image captioning first to get context
    const caption = await hf.imageToText({
      model: 'Salesforce/blip-image-captioning-large',
      data: imageBlob,
    });

    results.notes = caption.generated_text || '';

    // Use VQA model for specific questions
    for (const { key, question } of RATING_QUESTIONS) {
      try {
        const answer = await hf.visualQuestionAnswering({
          model: 'dandelin/vilt-b32-finetuned-vqa',
          inputs: {
            image: imageBlob,
            question,
          },
        });

        const answerText = answer.answer || '';

        if (key === 'roomType') {
          results.roomType = normalizeRoomType(answerText);
        } else if (key === 'condition') {
          results.condition = normalizeCondition(answerText);
        } else {
          // Parse numeric ratings
          const num = parseInt(answerText.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num >= 1 && num <= 10) {
            (results as Record<string, unknown>)[key] = num;
          } else {
            // Estimate based on answer sentiment
            (results as Record<string, unknown>)[key] = estimateRating(answerText);
          }
        }
      } catch (err) {
        console.error(`VQA error for ${key}:`, err);
      }
    }

    return results;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return { imageUrl, notes: 'Analysis failed' };
  }
}

// Alternative: Use image captioning + heuristics for faster/cheaper analysis
async function analyzeImageWithCaptioning(imageUrl: string): Promise<Partial<ImageRating>> {
  try {
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    const imageBlob = new Blob([Buffer.from(imageBase64, 'base64')], { type: 'image/jpeg' });

    // Get detailed caption
    const caption = await hf.imageToText({
      model: 'Salesforce/blip-image-captioning-large',
      data: imageBlob,
    });

    const captionText = (caption.generated_text || '').toLowerCase();

    // Heuristic analysis based on caption
    return {
      imageUrl,
      roomType: detectRoomType(captionText),
      cleanliness: estimateCleanlinessFromCaption(captionText),
      naturalLight: estimateLightFromCaption(captionText),
      renovationLevel: estimateRenovationFromCaption(captionText),
      spaciousness: estimateSpaciousnessFromCaption(captionText),
      condition: estimateConditionFromCaption(captionText),
      notes: caption.generated_text || '',
    };
  } catch (error) {
    console.error('Error with captioning:', error);
    return {
      imageUrl,
      roomType: 'unknown',
      cleanliness: 5,
      naturalLight: 5,
      renovationLevel: 5,
      spaciousness: 5,
      condition: 'unknown',
      notes: 'Analysis unavailable'
    };
  }
}

export async function analyzeApartmentImages(
  imageUrls: string[],
  method: 'vqa' | 'caption' = 'caption'
): Promise<ApartmentImageAnalysis> {
  const imagesToAnalyze = imageUrls.slice(0, 5); // Limit to 5 images

  const analyzeFunc = method === 'vqa' ? analyzeImageWithVQA : analyzeImageWithCaptioning;

  // Analyze images in parallel (with some rate limiting)
  const imagePromises = imagesToAnalyze.map((url, idx) =>
    new Promise<Partial<ImageRating>>(resolve =>
      setTimeout(() => analyzeFunc(url).then(resolve), idx * 500)
    )
  );

  const rawResults = await Promise.all(imagePromises);

  // Fill in defaults for any missing values
  const images: ImageRating[] = rawResults.map(r => ({
    imageUrl: r.imageUrl || '',
    roomType: r.roomType || 'unknown',
    cleanliness: r.cleanliness || 5,
    naturalLight: r.naturalLight || 5,
    renovationLevel: r.renovationLevel || 5,
    spaciousness: r.spaciousness || 5,
    condition: r.condition || 'unknown',
    notes: r.notes || '',
  }));

  // Calculate averages
  const avg = (key: keyof ImageRating) => {
    const values = images.map(img => img[key] as number).filter(v => typeof v === 'number');
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 5;
  };

  const overallCleanliness = avg('cleanliness');
  const overallLight = avg('naturalLight');
  const overallRenovation = avg('renovationLevel');

  // Generate summary
  const roomTypes = [...new Set(images.map(i => i.roomType).filter(r => r !== 'unknown'))];
  const summary = generateSummary(images, roomTypes, overallCleanliness, overallLight, overallRenovation);

  return {
    images,
    overallCleanliness,
    overallLight,
    overallRenovation,
    summary,
  };
}

// Helper functions

function normalizeRoomType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('kitchen')) return 'kitchen';
  if (lower.includes('bed')) return 'bedroom';
  if (lower.includes('bath')) return 'bathroom';
  if (lower.includes('living') || lower.includes('lounge')) return 'living room';
  if (lower.includes('dining')) return 'dining room';
  return 'other';
}

function normalizeCondition(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('excellent') || lower.includes('perfect')) return 'excellent';
  if (lower.includes('good') || lower.includes('nice')) return 'good';
  if (lower.includes('fair') || lower.includes('okay') || lower.includes('ok')) return 'fair';
  if (lower.includes('poor') || lower.includes('bad')) return 'poor';
  if (lower.includes('needs') || lower.includes('work')) return 'needs work';
  return 'fair';
}

function estimateRating(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('yes') || lower.includes('very') || lower.includes('excellent')) return 8;
  if (lower.includes('no') || lower.includes('not') || lower.includes('poor')) return 3;
  if (lower.includes('some') || lower.includes('moderate')) return 6;
  return 5;
}

function detectRoomType(caption: string): string {
  if (caption.includes('kitchen') || caption.includes('stove') || caption.includes('refrigerator') || caption.includes('sink')) return 'kitchen';
  if (caption.includes('bed') || caption.includes('bedroom') || caption.includes('mattress')) return 'bedroom';
  if (caption.includes('bath') || caption.includes('toilet') || caption.includes('shower')) return 'bathroom';
  if (caption.includes('living') || caption.includes('couch') || caption.includes('sofa') || caption.includes('tv')) return 'living room';
  if (caption.includes('dining') || caption.includes('table')) return 'dining room';
  return 'room';
}

function estimateCleanlinessFromCaption(caption: string): number {
  let score = 6; // Default
  if (caption.includes('clean') || caption.includes('tidy') || caption.includes('neat')) score += 2;
  if (caption.includes('dirty') || caption.includes('messy') || caption.includes('clutter')) score -= 2;
  if (caption.includes('modern') || caption.includes('new')) score += 1;
  if (caption.includes('old') || caption.includes('worn')) score -= 1;
  return Math.max(1, Math.min(10, score));
}

function estimateLightFromCaption(caption: string): number {
  let score = 5; // Default
  if (caption.includes('window') || caption.includes('light') || caption.includes('bright') || caption.includes('sunny')) score += 2;
  if (caption.includes('dark') || caption.includes('dim')) score -= 2;
  if (caption.includes('large window') || caption.includes('natural light')) score += 2;
  return Math.max(1, Math.min(10, score));
}

function estimateRenovationFromCaption(caption: string): number {
  let score = 5; // Default
  if (caption.includes('modern') || caption.includes('new') || caption.includes('renovated') || caption.includes('updated')) score += 2;
  if (caption.includes('stainless') || caption.includes('granite') || caption.includes('hardwood')) score += 2;
  if (caption.includes('old') || caption.includes('dated') || caption.includes('worn')) score -= 2;
  if (caption.includes('carpet') && !caption.includes('new carpet')) score -= 1;
  return Math.max(1, Math.min(10, score));
}

function estimateSpaciousnessFromCaption(caption: string): number {
  let score = 5; // Default
  if (caption.includes('large') || caption.includes('spacious') || caption.includes('open')) score += 2;
  if (caption.includes('small') || caption.includes('tiny') || caption.includes('cramped')) score -= 2;
  if (caption.includes('empty') || caption.includes('unfurnished')) score += 1;
  return Math.max(1, Math.min(10, score));
}

function estimateConditionFromCaption(caption: string): string {
  const lower = caption.toLowerCase();
  if (lower.includes('new') || lower.includes('modern') || lower.includes('renovated')) return 'excellent';
  if (lower.includes('clean') || lower.includes('nice') || lower.includes('good')) return 'good';
  if (lower.includes('old') || lower.includes('dated')) return 'fair';
  if (lower.includes('damaged') || lower.includes('broken') || lower.includes('dirty')) return 'poor';
  return 'fair';
}

function generateSummary(
  images: ImageRating[],
  roomTypes: string[],
  cleanliness: number,
  light: number,
  renovation: number
): string {
  const parts: string[] = [];

  if (roomTypes.length > 0) {
    parts.push(`Photos show: ${roomTypes.join(', ')}.`);
  }

  if (cleanliness >= 7) {
    parts.push('Appears clean and well-maintained.');
  } else if (cleanliness <= 4) {
    parts.push('Cleanliness may be a concern.');
  }

  if (light >= 7) {
    parts.push('Good natural light.');
  } else if (light <= 4) {
    parts.push('Limited natural light visible.');
  }

  if (renovation >= 7) {
    parts.push('Modern/recently renovated.');
  } else if (renovation <= 4) {
    parts.push('Appears dated, may need updates.');
  }

  return parts.join(' ') || 'Standard apartment photos.';
}
