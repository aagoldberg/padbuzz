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
                text: `Analyze this apartment photo. Rate 1-10 for cleanliness, natural light, renovation/modernity, and spaciousness. Identify room type. Respond ONLY with JSON (no markdown):
{"cleanliness":N,"light":N,"renovation":N,"spaciousness":N,"room_type":"kitchen/bedroom/bathroom/living room/other","condition":"excellent/good/fair/poor","notes":"brief observation"}`
              }
            ]
          }
        ],
        max_tokens: 200
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
      condition: parsed.condition || 'fair',
      notes: parsed.notes || '',
    };
  } catch (error) {
    console.error('Error analyzing image with VLM:', error);
    return defaultRating(imageUrl);
  }
}

function defaultRating(imageUrl: string): ImageRating {
  return {
    imageUrl,
    roomType: 'unknown',
    cleanliness: 6,
    naturalLight: 6,
    renovationLevel: 6,
    spaciousness: 6,
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
      summary: 'Image analysis unavailable (API key not configured)',
    };
  }

  const imagesToAnalyze = imageUrls.slice(0, 3); // Limit to 3 images to save costs

  // Analyze images in parallel (HuggingFace Pro has higher rate limits)
  const images = await Promise.all(
    imagesToAnalyze.map(url => analyzeImageWithVLM(url))
  );

  // Calculate averages
  const avg = (key: keyof ImageRating) => {
    const values = images.map(img => img[key] as number).filter(v => typeof v === 'number');
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 6;
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

  // Cleanliness
  if (cleanliness >= 8) parts.push('Very clean.');
  else if (cleanliness >= 6) parts.push('Clean condition.');
  else if (cleanliness <= 4) parts.push('Cleanliness concerns.');

  // Light
  if (light >= 8) parts.push('Excellent natural light.');
  else if (light >= 6) parts.push('Good light.');
  else if (light <= 4) parts.push('Limited light.');

  // Renovation
  if (renovation >= 8) parts.push('Modern/updated finishes.');
  else if (renovation >= 6) parts.push('Good condition.');
  else if (renovation <= 4) parts.push('May need updates.');

  // Overall
  const avgScore = (cleanliness + light + renovation) / 3;
  if (avgScore >= 8) parts.push('Overall: Excellent.');
  else if (avgScore >= 6) parts.push('Overall: Good.');
  else if (avgScore <= 4) parts.push('Overall: Below average.');

  return parts.join(' ') || 'Standard apartment.';
}
