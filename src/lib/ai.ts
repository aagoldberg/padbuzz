import Anthropic from '@anthropic-ai/sdk';
import { Apartment, AIAnalysis, UserPreferences } from '@/types/apartment';
import { analyzeApartmentImages as hfAnalyzeImages, ApartmentImageAnalysis } from './image-analysis';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeApartment(
  apartment: Apartment,
  userPreferences: UserPreferences,
  imageAnalysis?: ApartmentImageAnalysis | null
): Promise<AIAnalysis> {
  const prompt = buildAnalysisPrompt(apartment, userPreferences, imageAnalysis);

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

// Use Hugging Face for image analysis (cheaper than Claude vision)
export async function getImageAnalysis(
  images: string[]
): Promise<ApartmentImageAnalysis | null> {
  if (!images.length) return null;

  try {
    // Use caption-based analysis (faster and cheaper)
    const analysis = await hfAnalyzeImages(images, 'caption');
    return analysis;
  } catch (error) {
    console.error('Error analyzing images with HF:', error);
    return null;
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

function buildAnalysisPrompt(
  apartment: Apartment,
  preferences: UserPreferences,
  imageAnalysis?: ApartmentImageAnalysis | null
): string {
  let imageSection = '';
  if (imageAnalysis) {
    imageSection = `
IMAGE ANALYSIS (from photos):
- Overall Cleanliness: ${imageAnalysis.overallCleanliness}/10
- Overall Natural Light: ${imageAnalysis.overallLight}/10
- Overall Renovation Level: ${imageAnalysis.overallRenovation}/10
- Photo Summary: ${imageAnalysis.summary}
${imageAnalysis.images.map((img, i) => `
  Photo ${i + 1} (${img.roomType}):
    - Cleanliness: ${img.cleanliness}/10
    - Light: ${img.naturalLight}/10
    - Renovation: ${img.renovationLevel}/10
    - Spaciousness: ${img.spaciousness}/10
    - Condition: ${img.condition}
    - Notes: ${img.notes}`).join('')}
`;
  }

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
${imageSection}
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

Be honest and direct. If there are red flags or the apartment doesn't match preferences, say so clearly.
${imageAnalysis ? 'Factor the image analysis ratings into your assessment - cleanliness, light, and renovation level are important quality indicators.' : ''}`;
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
