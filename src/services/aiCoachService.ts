import { supabase } from './supabase';
import { evaluateAyurRules, buildGroundedAIPrompt } from './ayurRuleEngine';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_MODEL = 'llama-3.1-8b-instant'; // High-speed conversational Llama 3.1 model

export interface ChatHistoryRecord {
  sender: 'user' | 'ai';
  message_text: string;
}

/**
 * Queries today's full Ayurvedic and biometric context from Supabase in parallel.
 */
export async function getAyurvedicContext(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = `${todayStr}T00:00:00.000Z`;
  const endOfDay = `${todayStr}T23:59:59.999Z`;

  try {
    const [
      profileRes,
      doshaRes,
      agniRes,
      ojasRes,
      sleepRes,
      hrRes,
      tempRes,
      foodRes,
      waterRes
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, dominant_dosha, daily_water_goal_ml').eq('id', userId).single(),
      supabase.from('daily_dosha_states').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
      supabase.from('daily_agni_scores').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
      supabase.from('daily_ojas_scores').select('*').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startOfDay).lte('start_time', endOfDay).maybeSingle(),
      supabase.from('heart_rate_logs').select('bpm').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('temperature_logs').select('temperature_celsius').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('food_logs').select(`
        food_name, 
        calories_kcal, 
        nutrition_analysis (
          ayurvedic_taste, 
          dosha_effect
        )
      `).eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay)
    ]);

    // Aggregate heart rate
    const hrLogs = hrRes.data || [];
    const hrValues = hrLogs.map(l => l.bpm);
    const avgHr = hrValues.length > 0 ? Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length) : null;

    // Aggregate temperature
    const tempLogs = tempRes.data || [];
    const tempValues = tempLogs.map(l => Number(l.temperature_celsius));
    const avgTemp = tempValues.length > 0 ? Number((tempValues.reduce((s, v) => s + v, 0) / tempValues.length).toFixed(1)) : null;

    // Aggregate hydration
    const waterLogs = waterRes.data || [];
    const totalWater = waterLogs.reduce((s, l) => s + l.amount_ml, 0);

    return {
      profile: profileRes.data || { full_name: 'Yogi', dominant_dosha: 'tridoshic', daily_water_goal_ml: 2500 },
      dosha: doshaRes.data || null,
      agni: agniRes.data || null,
      ojas: ojasRes.data || null,
      sleep: sleepRes.data || null,
      avgHr,
      avgTemp,
      foods: foodRes.data || [],
      totalWater
    };
  } catch (err) {
    console.warn('[AICoachService] Error loading context:', err);
    return null;
  }
}

/**
 * Generate a conversational response from AquaGuru AI Coach on Groq.
 * Queries full database context for today and formats suggestions in cards.
 *
 * @param userId User UUID
 * @param history Conversation history (last N messages)
 * @param newMessage The user's new message string
 * @returns AI Coach response markdown string
 */
export async function generateCoachResponse(
  userId: string,
  history: ChatHistoryRecord[],
  newMessage: string
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API Key is not configured. Please define EXPO_PUBLIC_GROQ_API_KEY.');
  }

  // 1. Gather rich database context for today
  const context = await getAyurvedicContext(userId);
  if (!context) {
    throw new Error('Failed to load Ayurvedic daily context for AI Coach.');
  }

  // 1b. Run Rule Engine for Grounded Facts
  const vataPercentage = context.dosha?.vata_percentage || 33;
  const pittaPercentage = context.dosha?.pitta_percentage || 33;
  const kaphaPercentage = context.dosha?.kapha_percentage || 34;
  const agniScoreVal = context.agni?.agni_score || 75;
  const ojasScoreVal = context.ojas?.ojas_score || 78;

  const groundedFacts = evaluateAyurRules(
    { vata: vataPercentage, pitta: pittaPercentage, kapha: kaphaPercentage },
    agniScoreVal,
    ojasScoreVal
  );

  const groundingPromptBlock = buildGroundedAIPrompt(groundedFacts);

  // 2. Format context for prompt injection
  const nameLabel = context.profile?.full_name || 'Yogi';
  const dominantDosha = context.profile?.dominant_dosha || 'tridoshic';

  let doshaSection = `Dynamic Balance: Baseline dominant constitution is ${dominantDosha}. No dynamic logs today.`;
  if (context.dosha) {
    doshaSection = `Dynamic Balance: Vata: ${context.dosha.vata_percentage}%, Pitta: ${context.dosha.pitta_percentage}%, Kapha: ${context.dosha.kapha_percentage}%.
- Trend Alert: ${context.dosha.trend_alert || 'Equilibrium'}
- Anomalies Detected: ${JSON.stringify(context.dosha.explanation_summary || {})}`;
  }

  let agniSection = 'Metabolic Fire (Agni): Daily score not calculated yet.';
  if (context.agni) {
    agniSection = `Metabolic Fire (Agni): Score is ${context.agni.agni_score}/100 (${context.agni.agni_state}).
- Components: Timing Score: ${context.agni.s_timing}, Diet Score: ${context.agni.s_diet}, Hydration Score: ${context.agni.s_hydration}, Vitals Score: ${context.agni.s_vitals}, Sleep Score: ${context.agni.s_sleep}`;
  }

  let ojasSection = 'Immune Vitality (Ojas): Daily score not calculated yet.';
  if (context.ojas) {
    ojasSection = `Immune Vitality (Ojas): Score is ${context.ojas.ojas_score}/100 (${context.ojas.ojas_state}).`;
  }

  let sleepSection = 'Sleep: No sleep log recorded today.';
  if (context.sleep) {
    sleepSection = `Sleep & Recovery: Duration of ${context.sleep.duration_minutes} minutes, Sleep Quality Score: ${context.sleep.sleep_score}/100.`;
  }

  const vitalsSection = `Streaming Wearables: 
- Avg Heart Rate: ${context.avgHr ? `${context.avgHr} bpm` : 'No heart rate logs today'}
- Avg Temp: ${context.avgTemp ? `${context.avgTemp} °C` : 'No skin temperature logs today'}`;

  let nutritionSection = 'Nutrition Logs: No food items logged today.';
  if (context.foods && context.foods.length > 0) {
    const foodList = (context.foods as any[]).map((f: any) => {
      const taste = f.nutrition_analysis?.ayurvedic_taste || 'unknown';
      const effect = f.nutrition_analysis?.dosha_effect || 'unknown';
      return `- ${f.food_name} (${f.calories_kcal} kcal) [Taste: ${taste}, Effect: ${effect}]`;
    }).join('\n');
    nutritionSection = `Nutrition Logs today:\n${foodList}`;
  }

  const hydrationSection = `Hydration: logged ${context.totalWater} ml today (Goal: ${context.profile?.daily_water_goal_ml || 2500} ml).`;

  // 3. System Prompt Engineering
  const systemPrompt = `You are AquaGuru, a wise, supportive, and expert Ayurvedic AI Wellness Coach.
Your goal is to guide the user (${nameLabel}) in balancing their Doshas, explaining biometric anomalies, and providing actionable diet, lifestyle, and hydration advice.

${groundingPromptBlock}

USER CONTEXT DATABASE SNAPSHOT:
1. PROFILE CONSTITUTION: Dominant Dosha: ${dominantDosha}
2. DYNAMIC BALANCE STATUS:
${doshaSection}
3. METABOLISM & DIGESTIVE FIRE (AGNI):
${agniSection}
4. IMMUNE RESILIENCE & VITALITY (OJAS):
${ojasSection}
5. SLEEP RECOVERY:
${sleepSection}
6. WEARABLE VITALS:
${vitalsSection}
7. HYDRATION:
${hydrationSection}
8. FOOD JOURNAL NUTRITION LOGS:
${nutritionSection}

RESPONSE INSTRUCTIONS:
- Answer directly, referring to their real-time vitals and lifestyle status.
- Keep responses concise (under 200 words) and format in clean, readable markdown. Never include raw HTML.
- Whenever presenting a structured health summary, sleep/recovery analysis, dosha check, nutrition tip, or vital sign trends, output the information inside one of these custom card blocks:

[Card: Health]
Title: Health Summary
Score: <0-100>%
Status: <Optimal|Aggravated|Irregular>
Details: <brief explanation and daily correction>
[/Card]

[Card: Recovery]
Title: Recovery Index
Score: <0-100>%
Sleep: <Good|Restless|Optimal>
Vitals: <Stable|Unstable>
[/Card]

[Card: Dosha]
Title: Dosha Balance
Vata: <Stable|Aggravated>
Pitta: <Stable|Aggravated>
Kapha: <Stable|Aggravated>
Aggravated: <Vata|Pitta|Kapha|None>
[/Card]

[Card: Nutrition]
Title: Ayurvedic Nutrition
Calories: <number> kcal
Macro: <Vata balancing, Pitta cooling, etc.>
Advice: <nutrition correction and preventive tip>
[/Card]

[Card: Trend]
Title: Biometric Trend
Metric: <Heart Rate|Skin Temp|Steps|Hydration>
Direction: <Improving|Stable|Declining>
Explanation: <early imbalance detection warning>
[/Card]

- Maintain safe clinical boundaries; suggest professional medical checkups if the user reports acute chest pains, high fever, or severe symptoms.`;

  // 4. Map conversation history to Groq payload (limit to last 10 turns to save tokens)
  const mappedHistory = history.slice(-10).map((msg) => ({
    role: msg.sender === 'user' ? 'user' : ('assistant' as const),
    content: msg.message_text
  }));

  // 5. Assemble full completions messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...mappedHistory,
    { role: 'user', content: newMessage }
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq completions API error ${response.status}: ${errorText}`);
    }

    const resJson = await response.json();
    const reply = resJson.choices[0]?.message?.content || '';
    return reply.trim();
  } catch (error: any) {
    console.error('[AICoachService] Failed to get response from Groq:', error);
    throw new Error(error.message || 'Coach connection timed out. Please check internet connection.');
  }
}
