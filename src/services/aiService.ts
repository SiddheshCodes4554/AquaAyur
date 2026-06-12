import { supabase } from './supabase';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Standard high-speed Llama 3.1 on Groq

export interface BiometricMetricsSnapshot {
  avg_heart_rate: number;
  avg_temp: number;
  step_count: number;
  hydration_logged_ml: number;
  water_goal_ml: number;
}

export interface AIRecommendationResult {
  recommendation_text: string;
  ayurvedic_insights: string;
}

/**
 * Call Groq API to generate personalized Ayurvedic recommendations.
 */
export async function generateAyurvedicRecommendation(
  userId: string,
  dosha: string,
  metrics: BiometricMetricsSnapshot
): Promise<AIRecommendationResult> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API Key is not configured. Please check your environment variables.');
  }

  // Define Ayurvedic background context
  const systemPrompt = `You are AyurCoach, an expert Ayurvedic Physician, IoT Biometrics Engineer, and AI Wellness Consultant.
Your role is to evaluate a user's real-time biometric indicators (Heart Rate, Skin Temperature, Step Count/Activity) alongside their baseline Ayurvedic Dosha constitution (Vata, Pitta, Kapha) and Hydration status to provide actionable, traditional, and scientifically-grounded wellness advice.

AYURVEDIC BIOMETRIC RULES:
1. VATA (Wind/Ether) - Grounding needed:
   - Aggravated by: Irregular heart rates, high activity/exhaustion, cool temperatures, and dehydration.
   - Recommended: Warm, soothing, slightly oily liquids (ginger, cinnamon, or cardamom tea). Calm, grounding pacing.
2. PITTA (Fire/Water) - Cooling needed:
   - Aggravated by: Elevated skin temperatures, high heart rate, excessive stress, and dry heat.
   - Recommended: Cooling, refreshing fluids (coconut water, fennel-infused water, or mint water). Rest during midday, avoidance of spicy foods.
3. KAPHA (Earth/Water) - Stimulation needed:
   - Aggravated by: Extremely low heart rates, lethargy/sedentary behavior, and overhydration.
   - Recommended: Warm, stimulating, light fluids (spiced tea with honey, cloves, black pepper). Active physical movement, light stretching.

Output your response strictly in JSON format with exactly these two fields:
{
  "recommendation_text": "A brief summary of actionable health, dietary, and hydration recommendations for the next few hours (in markdown format, up to 150 words). Make it engaging, supportive, and direct.",
  "ayurvedic_insights": "Detailed Ayurvedic analysis explaining HOW the user's current biometrics (Heart Rate, Temperature, Activity) indicate shifts or imbalances in their Vata-Pitta-Kapha equilibrium relative to their dominant Dosha (in markdown format, up to 150 words)."
}

Never include diagnostic claims, prescribe medical pharmaceuticals, or advise against professional medical consultations. Keep advice natural, preventative, and holistic.`;

  const userPrompt = `User Profile:
- Dominant Ayurvedic Constitution (Dosha): ${dosha}
- Daily Water Intake Goal: ${metrics.water_goal_ml} ml

Current Biometric Snapshot (Past 3 hours):
- Average Heart Rate: ${metrics.avg_heart_rate} bpm
- Average Skin Temperature: ${metrics.avg_temp}°C
- Steps Traveled: ${metrics.step_count}
- Water Drank Today: ${metrics.hydration_logged_ml} ml

Please evaluate this user's state and provide your Ayurvedic Status Analysis and Actionable Recommendations in the requested JSON structure.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API returned HTTP error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const parsedContent = JSON.parse(data.choices[0].message.content);

    const recommendation: AIRecommendationResult = {
      recommendation_text: parsedContent.recommendation_text || 'Stay hydrated and active.',
      ayurvedic_insights: parsedContent.ayurvedic_insights || 'Maintain a balanced Dosha profile.',
    };

    // Save to Supabase ai_recommendations table
    const { error: dbError } = await supabase.from('ai_recommendations').insert({
      user_id: userId,
      biometrics_snapshot: {
        avg_heart_rate: metrics.avg_heart_rate,
        avg_temp: metrics.avg_temp,
        step_count: metrics.step_count,
        hydration_logged_ml: metrics.hydration_logged_ml,
        water_goal_ml: metrics.water_goal_ml,
      },
      recommendation_text: recommendation.recommendation_text,
      ayurvedic_insights: recommendation.ayurvedic_insights,
    });

    if (dbError) {
      console.warn('[AIService] Recommendation generated but database log failed:', dbError.message);
    }

    return recommendation;
  } catch (error) {
    console.error('[AIService] Failed to generate Ayurvedic recommendations:', error);
    throw error;
  }
}
