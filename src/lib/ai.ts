import Anthropic from '@anthropic-ai/sdk';
import { Apartment, AIAnalysis, UserPreferences, ImageAnalysis } from '@/types/apartment';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeApartment(
  apartment: Apartment,
  userPreferences: UserPreferences
): Promise<AIAnalysis> {
  const prompt = buildAnalysisPrompt(apartment, userPreferences);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  return parseAnalysisResponse(textContent.text);
}

export async function analyzeApartmentImages(
  images: string[],
  apartment: Apartment
): Promise<ImageAnalysis[]> {
  if (!images.length) return [];

  const imagesToAnalyze = images.slice(0, 5);

  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [
    {
      type: 'text',
      text: `Analyze these apartment images for a listing at ${apartment.address}.
For each image, provide:
1. A brief description of what's shown
2. Quality rating (excellent/good/fair/poor)
3. Highlights (positive aspects)
4. Concerns (any red flags or issues)

Respond in JSON format:
{
  "images": [
    {
      "description": "...",
      "quality": "...",
      "highlights": ["..."],
      "concerns": ["..."]
    }
  ]
}`,
    },
  ];

  for (const imageUrl of imagesToAnalyze) {
    content.push({
      type: 'image',
      source: {
        type: 'url',
        url: imageUrl,
      },
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    const parsed = JSON.parse(extractJson(textContent.text));
    return parsed.images.map((img: ImageAnalysis, idx: number) => ({
      ...img,
      imageUrl: imagesToAnalyze[idx],
    }));
  } catch (error) {
    console.error('Error analyzing images:', error);
    return [];
  }
}

export async function calculateDealScore(
  apartment: Apartment,
  analysis: AIAnalysis
): Promise<number> {
  const prompt = `Given this apartment analysis, calculate a "deal score" from 0-100.
A high score means the apartment is significantly underpriced for its quality and features.

Apartment:
- Address: ${apartment.address}
- Price: $${apartment.price}/month
- Bedrooms: ${apartment.bedrooms}
- Bathrooms: ${apartment.bathrooms}
- Neighborhood: ${apartment.neighborhood}
- No Fee: ${apartment.noFee ? 'Yes' : 'No'}
- Rent Stabilized: ${apartment.rentStabilized ? 'Yes' : 'No'}

AI Analysis:
- Overall Score: ${analysis.overallScore}/10
- Deal Rating: ${analysis.dealRating}
- Price Assessment: ${analysis.priceAssessment}
- Pros: ${analysis.pros.join(', ')}
- Cons: ${analysis.cons.join(', ')}

Consider:
1. Price relative to neighborhood averages
2. Quality vs price ratio
3. Special features (no fee, rent stabilized)
4. Market demand for this type of unit

Respond with ONLY a number from 0-100.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return 50;
  }

  const score = parseInt(textContent.text.trim(), 10);
  return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
}

function buildAnalysisPrompt(apartment: Apartment, preferences: UserPreferences): string {
  return `You are an expert real estate analyst helping apartment hunters in NYC.
Analyze this apartment listing based on the user's preferences and provide a detailed assessment.

APARTMENT DETAILS:
- Address: ${apartment.address}
- Neighborhood: ${apartment.neighborhood}, ${apartment.borough}
- Price: $${apartment.price}/month
- Bedrooms: ${apartment.bedrooms}
- Bathrooms: ${apartment.bathrooms}
${apartment.sqft ? `- Square Feet: ${apartment.sqft}` : ''}
- Amenities: ${apartment.amenities.join(', ') || 'Not specified'}
- No Fee: ${apartment.noFee ? 'Yes' : 'No'}
- Rent Stabilized: ${apartment.rentStabilized ? 'Yes' : 'No'}
- Description: ${apartment.description || 'No description provided'}

USER PREFERENCES:
- Max Budget: $${preferences.maxPrice}/month
- Min Bedrooms: ${preferences.minBedrooms}
- Min Bathrooms: ${preferences.minBathrooms}
- Preferred Neighborhoods: ${preferences.preferredNeighborhoods.join(', ') || 'Any'}
- Must-Have Amenities: ${preferences.mustHaveAmenities.join(', ') || 'None specified'}
- Nice-to-Have Amenities: ${preferences.niceToHaveAmenities.join(', ') || 'None specified'}
- Priorities: ${preferences.priorities.join(', ') || 'None specified'}
- Deal Breakers: ${preferences.dealBreakers.join(', ') || 'None specified'}
${preferences.additionalNotes ? `- Additional Notes: ${preferences.additionalNotes}` : ''}

Provide your analysis in the following JSON format:
{
  "overallScore": <1-10 score based on match to preferences>,
  "pros": ["<list of positive aspects>"],
  "cons": ["<list of negative aspects or concerns>"],
  "summary": "<2-3 sentence summary of the apartment and fit>",
  "dealRating": "<exceptional|great|good|fair|poor>",
  "priceAssessment": "<assessment of price relative to value and market>"
}

Be honest and direct. If there are red flags or the apartment doesn't match preferences, say so clearly.`;
}

function parseAnalysisResponse(text: string): AIAnalysis {
  try {
    const jsonStr = extractJson(text);
    const parsed = JSON.parse(jsonStr);

    return {
      overallScore: parsed.overallScore || 5,
      pros: parsed.pros || [],
      cons: parsed.cons || [],
      summary: parsed.summary || 'Analysis unavailable',
      dealRating: parsed.dealRating || 'fair',
      priceAssessment: parsed.priceAssessment || 'Unable to assess',
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      overallScore: 5,
      pros: [],
      cons: [],
      summary: 'Unable to analyze apartment',
      dealRating: 'fair',
      priceAssessment: 'Unable to assess',
    };
  }
}

function extractJson(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text;
}

export function isExceptionalDeal(analysis: AIAnalysis, dealScore: number): boolean {
  return (
    dealScore >= 80 ||
    (analysis.dealRating === 'exceptional' && analysis.overallScore >= 8) ||
    (analysis.dealRating === 'great' && analysis.overallScore >= 9 && dealScore >= 70)
  );
}
