const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Multimodal Llama 4 vision model on Groq

export interface AINutritionResult {
  foodName: string;
  weight_g: number;
  calories_kcal: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  micronutrients: Record<string, string>;
  ayurvedicTaste: 'sweet' | 'sour' | 'salty' | 'bitter' | 'pungent' | 'astringent';
  doshaImpact: string;
}

/**
 * Call Groq Llama 3.2 Vision API to analyze food images and/or description.
 *
 * @param imageBase64 Optional raw base64 data string of the image (no prefix)
 * @param description Optional user description of the food
 * @returns Validated AINutritionResult object
 */
export async function analyzeFoodNutrition(
  imageBase64: string | null,
  description: string
): Promise<AINutritionResult> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API Key is not configured. Please define EXPO_PUBLIC_GROQ_API_KEY in your env.');
  }

  if (!imageBase64 && !description.trim()) {
    throw new Error('Please provide either a food photograph or a description for AI analysis.');
  }

  const systemPrompt = `You are AyurNutrition AI, an expert clinical dietitian, food chemist, and traditional Ayurvedic physician.
Your task is to analyze the provided meal image and/or user description and estimate its nutritional composition and Ayurvedic properties.

You must output a single, valid JSON object matching this exact schema. Do not include any markdown format tags (like \`\`\`json), comments, or introductory text. Output only raw JSON.

{
  "foodName": "A concise, descriptive name for the food item",
  "weight_g": 150, // estimated weight in grams (number)
  "calories_kcal": 350, // estimated calories in kcal (integer)
  "carbs_g": 45, // estimated carbohydrates in grams (number)
  "protein_g": 12, // estimated protein in grams (number)
  "fat_g": 8, // estimated fat in grams (number)
  "fiber_g": 5, // estimated fiber in grams (number)
  "micronutrients": {
    "Iron": "1.2mg",
    "Vitamin C": "12mg"
  }, // key-value record of key vitamins/minerals detected (at least 2 entries)
  "ayurvedicTaste": "sweet", // must be exactly one of: "sweet", "sour", "salty", "bitter", "pungent", "astringent"
  "doshaImpact": "Balances Vata & Pitta, Aggravates Kapha. A brief explanation of the food's Ayurvedic elements and gunas (qualities) and how it affects the three biological energies (Doshas)."
}`;

  // Formulate the API payload
  let userMessageContent: any;
  if (imageBase64) {
    userMessageContent = [
      {
        type: 'text',
        text: `Analyze this meal. User description: "${description || 'None'}"`
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`
        }
      }
    ];
  } else {
    userMessageContent = `Analyze this meal. User description: "${description}"`;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessageContent }
        ],
        temperature: 0.2, // low temperature for structured factual outputs
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API returned HTTP error ${response.status}: ${errorText}`);
    }

    const resData = await response.json();
    const rawContent = resData.choices[0]?.message?.content || '';

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent.trim());
    } catch (e) {
      console.warn('[AINutrition] Failed to parse JSON response from Groq:', rawContent);
      throw new Error('AI returned an invalid JSON response structure. Please try again.');
    }

    // Response Validation
    const validatedResult = validateAndSanitizeResponse(parsed);
    return validatedResult;
  } catch (error: any) {
    console.error('[AINutrition] Analysis error:', error);
    throw error;
  }
}

/**
 * Validate response fields and apply robust default fallbacks where applicable.
 */
function validateAndSanitizeResponse(data: any): AINutritionResult {
  const sanitizeNumber = (val: any, fallback: number): number => {
    const num = Number(val);
    return isNaN(num) || num < 0 ? fallback : num;
  };

  const validTastes = ['sweet', 'sour', 'salty', 'bitter', 'pungent', 'astringent'];
  let taste = String(data.ayurvedicTaste || 'sweet').trim().toLowerCase();
  if (!validTastes.includes(taste)) {
    taste = 'sweet';
  }

  return {
    foodName: String(data.foodName || 'Analyzed Meal').trim(),
    weight_g: sanitizeNumber(data.weight_g, 150),
    calories_kcal: Math.round(sanitizeNumber(data.calories_kcal, 250)),
    carbs_g: sanitizeNumber(data.carbs_g, 20),
    protein_g: sanitizeNumber(data.protein_g, 5),
    fat_g: sanitizeNumber(data.fat_g, 5),
    fiber_g: sanitizeNumber(data.fiber_g, 2),
    micronutrients: typeof data.micronutrients === 'object' && data.micronutrients !== null 
      ? data.micronutrients 
      : { 'Sodium': '50mg', 'Calcium': '20mg' },
    ayurvedicTaste: taste as any,
    doshaImpact: String(data.doshaImpact || 'Balanced nutrition profile.').trim()
  };
}
