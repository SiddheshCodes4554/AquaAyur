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
  const normalizedDesc = (description || '').trim();

  if (!GROQ_API_KEY) {
    console.warn('[AINutrition] Groq API Key is not configured. Using local Ayurvedic analysis fallback.');
    return generateLocalNutritionAnalysis(normalizedDesc);
  }

  if (!imageBase64 && !normalizedDesc) {
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
        text: `Analyze this meal. User description: "${normalizedDesc || 'None'}"`
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`
        }
      }
    ];
  } else {
    userMessageContent = `Analyze this meal. User description: "${normalizedDesc}"`;
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
    return validateAndSanitizeResponse(parsed);
  } catch (error: any) {
    console.warn('[AINutrition] Groq API failed, falling back to local analysis:', error);
    return generateLocalNutritionAnalysis(normalizedDesc);
  }
}

/**
 * Local rules-based Ayurvedic nutritional fallback engine.
 */
function generateLocalNutritionAnalysis(description: string): AINutritionResult {
  const desc = description.toLowerCase();
  
  if (desc.includes('khichdi') || desc.includes('kitchari') || desc.includes('rice') || desc.includes('lentil') || desc.includes('dal')) {
    return {
      foodName: 'Ayurvedic Khichdi',
      weight_g: 220,
      calories_kcal: 280,
      carbs_g: 48,
      protein_g: 9,
      fat_g: 5,
      fiber_g: 4,
      micronutrients: { 'Iron': '1.8mg', 'Folate': '45mcg' },
      ayurvedicTaste: 'sweet',
      doshaImpact: 'Balances Vata & Pitta, very easy to digest (Laghu). Ignites Agni (digestive fire) and helps eliminate Ama (toxins).'
    };
  }
  
  if (desc.includes('salad') || desc.includes('raw') || desc.includes('leaf') || desc.includes('spinach')) {
    return {
      foodName: 'Green Garden Salad',
      weight_g: 150,
      calories_kcal: 65,
      carbs_g: 8,
      protein_g: 2,
      fat_g: 1,
      fiber_g: 3.5,
      micronutrients: { 'Vitamin A': '180mcg', 'Vitamin K': '120mcg' },
      ayurvedicTaste: 'bitter',
      doshaImpact: 'Pacifies Pitta & Kapha. Aggravates Vata due to cold, dry, and rough qualities. Recommend adding olive oil/spices.'
    };
  }

  if (desc.includes('ghee') || desc.includes('butter') || desc.includes('oil')) {
    return {
      foodName: 'Desi Cow Ghee',
      weight_g: 15,
      calories_kcal: 135,
      carbs_g: 0,
      protein_g: 0,
      fat_g: 15,
      fiber_g: 0,
      micronutrients: { 'Vitamin E': '0.4mg', 'Butyric Acid': '1.2g' },
      ayurvedicTaste: 'sweet',
      doshaImpact: 'Pacifies Vata & Pitta. Builds Ojas (cellular immunity), kindles Agni, and nourishes Majja (bone marrow) tissue.'
    };
  }

  if (desc.includes('coffee') || desc.includes('caffeine') || desc.includes('tea') || desc.includes('chai')) {
    return {
      foodName: 'Herbal Infusion / Beverage',
      weight_g: 250,
      calories_kcal: 45,
      carbs_g: 5,
      protein_g: 1,
      fat_g: 1.5,
      fiber_g: 0,
      micronutrients: { 'Antioxidants': 'High', 'Potassium': '40mg' },
      ayurvedicTaste: 'bitter',
      doshaImpact: 'Temporarily pacifies Kapha but excites Vata & Pitta. Stimulates nervous system, dehydrates tissues, and may deplete Ojas if overconsumed.'
    };
  }

  if (desc.includes('chicken') || desc.includes('meat') || desc.includes('fish') || desc.includes('egg')) {
    return {
      foodName: 'Protein Build Bowl',
      weight_g: 180,
      calories_kcal: 240,
      carbs_g: 0,
      protein_g: 28,
      fat_g: 12,
      fiber_g: 0,
      micronutrients: { 'Vitamin B12': '1.6mcg', 'Zinc': '2.4mg' },
      ayurvedicTaste: 'sweet',
      doshaImpact: 'Pacifies Vata, increases Pitta & Kapha. Heavy (Guru) and building (Brimhana), requires robust Agni to assimilate properly.'
    };
  }

  if (desc.includes('yogurt') || desc.includes('curd') || desc.includes('dahi') || desc.includes('lassi')) {
    return {
      foodName: 'Ayurvedic Yogurt/Lassi',
      weight_g: 180,
      calories_kcal: 140,
      carbs_g: 8,
      protein_g: 6,
      fat_g: 5,
      fiber_g: 0,
      micronutrients: { 'Calcium': '180mg', 'Probiotics': 'Active' },
      ayurvedicTaste: 'sour',
      doshaImpact: 'Pacifies Vata, increases Pitta & Kapha. Heavy and channel-blocking (Abhishyandi). Avoid eating after sunset.'
    };
  }

  if (desc.includes('ginger') || desc.includes('turmeric') || desc.includes('spice') || desc.includes('pepper')) {
    return {
      foodName: 'Warm Spiced Elixir',
      weight_g: 50,
      calories_kcal: 25,
      carbs_g: 4,
      protein_g: 0.5,
      fat_g: 0.2,
      fiber_g: 1,
      micronutrients: { 'Curcumin / Gingerol': 'Active', 'Vitamin C': '4mg' },
      ayurvedicTaste: 'pungent',
      doshaImpact: 'Pacifies Vata & Kapha, increases Pitta in excess. Destroys Ama, warms the body, and directly kindle digestive Agni.'
    };
  }

  if (desc.includes('apple') || desc.includes('fruit') || desc.includes('banana') || desc.includes('berry')) {
    return {
      foodName: 'Fresh Seasonal Fruit',
      weight_g: 150,
      calories_kcal: 95,
      carbs_g: 22,
      protein_g: 1,
      fat_g: 0.3,
      fiber_g: 3.6,
      micronutrients: { 'Vitamin C': '15mg', 'Potassium': '220mg' },
      ayurvedicTaste: 'sweet',
      doshaImpact: 'Pacifies Pitta. Raw fruits can increase Vata wind; cooked/spiced fruits balance Vata. Kapha should consume in moderation.'
    };
  }

  // Default fallback if no keywords matched
  const title = description.trim() ? description.trim() : 'Nutritious Meal';
  return {
    foodName: title.length > 25 ? title.substring(0, 22) + '...' : title,
    weight_g: 180,
    calories_kcal: 210,
    carbs_g: 25,
    protein_g: 6,
    fat_g: 5,
    fiber_g: 3,
    micronutrients: { 'Vitamin C': '8mg', 'Calcium': '35mg' },
    ayurvedicTaste: 'sweet',
    doshaImpact: 'Tridoshic balancing in moderate amounts. Provides clean prana, aligns tissues, and supports steady metabolic Agni.'
  };
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
