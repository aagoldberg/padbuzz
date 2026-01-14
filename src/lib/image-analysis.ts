export interface ImageRating {
  imageUrl: string;
  roomType: string;
  // Scores (1-10)
  cleanliness: number;
  naturalLight: number;
  renovationLevel: number;
  spaciousness: number;
  // New scores
  coziness: number;
  charm: number;
  condition: string;
  notes: string;
}

export interface ApartmentImageAnalysis {
  images: ImageRating[];
  // Overall scores (1-10)
  overallCleanliness: number;
  overallLight: number;
  overallRenovation: number;
  overallSpacious: number;
  overallCoziness: number;
  overallCharm: number;
  // Style and vibe
  style: string[];
  vibe: string;
  // Detected features (unit-level)
  features: string[];
  // Building amenities (detected from photos)
  buildingAmenities: string[];
  // Concerns/red flags
  concerns: string[];
  // Summary
  summary: string;
}

// Extended analysis stored on listings
export interface StoredImageAnalysisExtended {
  overallQuality: number;
  cleanliness: number;
  light: number;
  renovation: number;
  spaciousness: number;
  coziness: number;
  charm: number;
  // Rich data
  style: string[];
  vibe: string;
  features: string[];
  buildingAmenities: string[];
  concerns: string[];
  summary: string;
  analyzedAt: Date;
}

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const VLM_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct';

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const fullUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${imageUrl}`;

  const response = await fetch(fullUrl);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function analyzeImageWithVLM(imageUrl: string): Promise<ImageRating> {
  try {
    const base64 = await fetchImageAsBase64(imageUrl);

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        model: VLM_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              },
              {
                type: 'text',
                text: `Analyze this apartment/building photo for a rental listing. Rate each 1-10 and be descriptive. Respond ONLY with JSON (no markdown):
{
  "room_type": "kitchen/bedroom/bathroom/living/gym/pool/rooftop/lobby/laundry/outdoor/amenity/floorplan/other",
  "cleanliness": N,
  "light": N,
  "renovation": N,
  "spaciousness": N,
  "coziness": N,
  "charm": N,
  "condition": "excellent/good/fair/poor",
  "style_tags": ["modern","classic","industrial","minimalist","cozy","bohemian","luxury","budget"],
  "features": ["hardwood floors","exposed brick","high ceilings","large windows","updated kitchen","stainless appliances","granite counters","nice view","balcony","fireplace","crown molding","original details","in-unit laundry","dishwasher","central air","walk-in closet"],
  "building_amenities": ["doorman","concierge","elevator","gym","pool","rooftop deck","package room","bike storage","laundry room","parking","storage","live-in super","courtyard","garden","children playroom","media room","co-working space","pet spa"],
  "concerns": ["small space","dark","dated","wear visible","clutter","poor staging","no natural light"],
  "notes": "2-3 sentence description of what you see and the vibe"
}`
              }
            ]
          }
        ],
        max_tokens: 400
      }),
    });

    if (!response.ok) {
      console.error('VLM API error:', response.status);
      return defaultRating(imageUrl);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse JSON from response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in VLM response:', content);
      return defaultRating(imageUrl);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      imageUrl,
      roomType: parsed.room_type || 'room',
      cleanliness: clamp(parsed.cleanliness || 5, 1, 10),
      naturalLight: clamp(parsed.light || 5, 1, 10),
      renovationLevel: clamp(parsed.renovation || 5, 1, 10),
      spaciousness: clamp(parsed.spaciousness || 5, 1, 10),
      coziness: clamp(parsed.coziness || 5, 1, 10),
      charm: clamp(parsed.charm || 5, 1, 10),
      condition: parsed.condition || 'fair',
      notes: parsed.notes || '',
      // Store extra data in notes as JSON for now
      ...({ _styleTags: parsed.style_tags || [], _features: parsed.features || [], _concerns: parsed.concerns || [], _buildingAmenities: parsed.building_amenities || [] } as Record<string, unknown>),
    };
  } catch (error) {
    console.error('Error analyzing image with VLM:', error);
    return defaultRating(imageUrl);
  }
}

// Extended image rating with parsed extras
interface ImageRatingExtended extends ImageRating {
  _styleTags?: string[];
  _features?: string[];
  _concerns?: string[];
  _buildingAmenities?: string[];
}

function defaultRating(imageUrl: string): ImageRating {
  return {
    imageUrl,
    roomType: 'unknown',
    cleanliness: 6,
    naturalLight: 6,
    renovationLevel: 6,
    spaciousness: 6,
    coziness: 5,
    charm: 5,
    condition: 'fair',
    notes: 'Analysis unavailable',
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function analyzeApartmentImages(
  imageUrls: string[]
): Promise<ApartmentImageAnalysis> {
  if (!HF_API_KEY) {
    console.warn('HUGGINGFACE_API_KEY not set, skipping image analysis');
    return {
      images: [],
      overallCleanliness: 6,
      overallLight: 6,
      overallRenovation: 6,
      overallSpacious: 6,
      overallCoziness: 5,
      overallCharm: 5,
      style: [],
      vibe: 'Unable to analyze',
      features: [],
      buildingAmenities: [],
      concerns: [],
      summary: 'Image analysis unavailable (API key not configured)',
    };
  }

  const imagesToAnalyze = imageUrls.slice(0, 5); // Analyze up to 5 images

  // Analyze images sequentially to avoid rate limits
  const images: ImageRatingExtended[] = [];
  for (const url of imagesToAnalyze) {
    const rating = await analyzeImageWithVLM(url);
    images.push(rating as ImageRatingExtended);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate averages
  const avg = (key: keyof ImageRating) => {
    const values = images.map(img => img[key] as number).filter(v => typeof v === 'number');
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : 6;
  };

  const overallCleanliness = avg('cleanliness');
  const overallLight = avg('naturalLight');
  const overallRenovation = avg('renovationLevel');
  const overallSpacious = avg('spaciousness');
  const overallCoziness = avg('coziness');
  const overallCharm = avg('charm');

  // Collect style tags, features, concerns, and building amenities from all images
  const allStyles: string[] = [];
  const allFeatures: string[] = [];
  const allConcerns: string[] = [];
  const allBuildingAmenities: string[] = [];

  for (const img of images) {
    if (img._styleTags) allStyles.push(...img._styleTags);
    if (img._features) allFeatures.push(...img._features);
    if (img._concerns) allConcerns.push(...img._concerns);
    if (img._buildingAmenities) allBuildingAmenities.push(...img._buildingAmenities);
  }

  // Deduplicate and count occurrences
  const style = [...new Set(allStyles)].slice(0, 5);
  const features = [...new Set(allFeatures)].slice(0, 10);
  const rawConcerns = [...new Set(allConcerns)].slice(0, 10);
  // Filter out concerns that contradict the actual scores
  const concerns = filterContradictoryConcerns(rawConcerns, overallLight, overallSpacious, overallCleanliness, overallRenovation).slice(0, 5);
  const buildingAmenities = [...new Set(allBuildingAmenities)].slice(0, 15);

  // Generate vibe description
  const vibe = generateVibe(overallCoziness, overallCharm, overallRenovation, style);

  // Generate summary
  const roomTypes = [...new Set(images.map(i => i.roomType).filter(r => r !== 'unknown'))];
  const summary = generateSummary(
    images,
    roomTypes,
    overallCleanliness,
    overallLight,
    overallRenovation,
    overallSpacious,
    overallCoziness,
    overallCharm,
    features,
    concerns
  );

  return {
    images,
    overallCleanliness,
    overallLight,
    overallRenovation,
    overallSpacious,
    overallCoziness,
    overallCharm,
    style,
    vibe,
    features,
    concerns,
    buildingAmenities,
    summary,
  };
}

function generateVibe(
  coziness: number,
  charm: number,
  renovation: number,
  styles: string[]
): string {
  const vibes: string[] = [];

  // Based on scores
  if (coziness >= 8) vibes.push('Very cozy');
  else if (coziness >= 6) vibes.push('Comfortable');

  if (charm >= 8) vibes.push('Charming');
  else if (charm >= 6) vibes.push('Nice character');

  if (renovation >= 8) vibes.push('Modern & updated');
  else if (renovation <= 4) vibes.push('Classic/vintage feel');

  // Based on styles
  if (styles.includes('luxury')) vibes.push('Upscale');
  if (styles.includes('minimalist')) vibes.push('Clean & minimal');
  if (styles.includes('bohemian')) vibes.push('Artsy & eclectic');
  if (styles.includes('industrial')) vibes.push('Industrial chic');

  if (vibes.length === 0) return 'Standard apartment';
  return vibes.slice(0, 3).join(' | ');
}

function generateSummary(
  images: ImageRating[],
  roomTypes: string[],
  cleanliness: number,
  light: number,
  renovation: number,
  spacious: number,
  coziness: number,
  charm: number,
  features: string[],
  concerns: string[]
): string {
  const avgScore = (cleanliness + light + renovation + spacious + coziness + charm) / 6;

  // Lead with the AI's actual observation (the interesting part)
  // Don't include Standouts/Notable/Watch for - those are in dedicated sections
  const interestingNotes = images
    .map(i => i.notes)
    .filter(n => n && n.length > 30 && n !== 'Analysis unavailable')
    .slice(0, 2);

  if (interestingNotes.length > 0) {
    // Combine up to 2 interesting observations
    return interestingNotes.join(' ');
  }

  // Fallback: Generate a quality-based summary
  if (avgScore >= 8.5) {
    return 'An exceptional apartment that checks all the boxes. The photos reveal a well-maintained space with thoughtful finishes and genuine appeal.';
  } else if (avgScore >= 7.5) {
    return 'A strong contender with solid presentation throughout. This one photographs well and shows real promise for the right renter.';
  } else if (avgScore >= 6.5) {
    return 'A respectable option in good overall condition. Nothing flashy, but the fundamentals are there.';
  } else if (avgScore >= 5.5) {
    return 'A serviceable apartment that gets the job done. Expectations should be calibrated accordingly.';
  } else {
    return 'This one requires some imagination. The photos suggest room for improvement, but could work for the right person.';
  }
}

// Filter concerns that contradict the actual scores
function filterContradictoryConcerns(
  concerns: string[],
  light: number,
  spacious: number,
  cleanliness: number,
  renovation: number
): string[] {
  return concerns.filter(concern => {
    const lower = concern.toLowerCase();
    // Don't show "dark" or "no natural light" if light score is good
    if ((lower.includes('dark') || lower.includes('no natural light') || lower.includes('poor lighting')) && light >= 7) {
      return false;
    }
    // Don't show "small space" if spaciousness is good
    if ((lower.includes('small') || lower.includes('cramped') || lower.includes('tight')) && spacious >= 7) {
      return false;
    }
    // Don't show cleanliness concerns if cleanliness is good
    if ((lower.includes('dirty') || lower.includes('worn') || lower.includes('wear visible')) && cleanliness >= 7) {
      return false;
    }
    // Don't show dated concerns if renovation is good
    if ((lower.includes('dated') || lower.includes('old') || lower.includes('outdated')) && renovation >= 7) {
      return false;
    }
    return true;
  });
}
