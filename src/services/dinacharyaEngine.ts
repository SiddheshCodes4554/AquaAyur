import { supabase } from './supabase';
import { safeNumber } from './agniEngine';

export interface DinacharyaRecord {
  id?: string;
  user_id: string;
  date: string;
  wake_up_rec: string;
  hydration_rec: string;
  meal_timing_rec: string;
  exercise_timing_rec: string;
  sleep_timing_rec: string;
  meta_inputs: {
    dosha: string;
    agni_score: number;
    agni_state: string;
    ojas_score: number;
    ojas_state: string;
    sleep_score: number;
    steps_count: number;
    weather: string;
    time_of_day: string;
  };
  created_at?: string;
}

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // High-speed Llama 3.1 model

/**
 * Generate a static fallback recommendation based on primary Dosha and simple rules.
 */
export function getStaticDinacharya(dosha: string, agniState: string, ojasState: string, weather: string): Omit<DinacharyaRecord, 'user_id' | 'date' | 'meta_inputs'> {
  const normDosha = (dosha || 'tridoshic').toLowerCase();
  
  if (normDosha.includes('vata')) {
    return {
      wake_up_rec: "Rise at 6:00 AM (pre-sunrise). Massage your feet and scalp with warm sesame oil (Abhyanga), and sit for 5 minutes of calming Nadi Shodhana breathing.",
      hydration_rec: "Drink 1-2 cups of warm water with ginger and cardamom slices upon waking. Avoid cold water entirely to keep Vata wind energy grounded.",
      meal_timing_rec: "Eat 3 warm, cooked, grounding meals. Breakfast at 8:00 AM, largest lunch at 12:30 PM, and a light dinner (soups or grains) by 7:00 PM.",
      exercise_timing_rec: "Focus on slow, grounding movements like restorative Hatha Yoga or a quiet walk. Exercise in the early morning (6:00 AM - 7:30 AM).",
      sleep_timing_rec: "Begin winding down by 9:30 PM with dim lights and warm chamomile/nutmeg tea. Target sleep by 10:00 PM to pacify Vata irregularity."
    };
  } else if (normDosha.includes('pitta')) {
    return {
      wake_up_rec: "Rise around 5:30 AM. Gently splash cool water on your face, rinse your eyes, and practice 10 minutes of cooling Sheetali Pranayama.",
      hydration_rec: "Drink cool (room temperature) fennel-infused water or coconut water. Avoid hot beverages, particularly during midday heat.",
      meal_timing_rec: "Take lunch as your largest meal at midday (12:00 PM - 1:00 PM) when Pitta digestive fire peaks. Keep breakfast light and dinner cooling by 7:30 PM.",
      exercise_timing_rec: "Moderate physical exercise like swimming or walking in nature. Best performed in the cool early morning (5:30 AM - 7:30 AM) to prevent overheating.",
      sleep_timing_rec: "Wind down by 10:00 PM. Avoid screen time or intense mental activity in the late evening. Sleep by 10:30 PM to prevent Pitta hyperacidity."
    };
  } else if (normDosha.includes('kapha')) {
    return {
      wake_up_rec: "Rise early, before 5:00 AM (Brahma Muhurta) to clear natural Kapha lethargy. Avoid sleeping in or taking daytime naps.",
      hydration_rec: "Drink warm water with a teaspoon of honey and a pinch of black pepper or ginger upon waking to stimulate sluggish Kapha fluid.",
      meal_timing_rec: "Focus on warm, light, dry foods with bitter/pungent spices. Eat a light breakfast at 7:30 AM, moderate lunch at 1:00 PM, and very light dinner by 6:30 PM.",
      exercise_timing_rec: "Engage in active, stimulating exercise such as jogging, active sun salutations, or brisk walking. Best done in the morning (6:00 AM - 10:00 AM) to clear congestion.",
      sleep_timing_rec: "Sleep by 10:30 PM. Avoid excess sleep (keep to 7 hours max) to prevent sluggishness and Kapha fluid accumulation."
    };
  } else {
    // Tridoshic / Balanced fallback
    return {
      wake_up_rec: "Rise around 5:30 AM. Splash warm water on your face, perform gentle stretching, and meditate for 10 minutes.",
      hydration_rec: "Drink warm or room-temperature water with lemon throughout the day. Avoid ice-cold drinks to preserve metabolic balance.",
      meal_timing_rec: "Eat balanced meals at consistent intervals. Breakfast at 8:00 AM, main lunch at 12:30 PM, and a moderate dinner by 7:00 PM.",
      exercise_timing_rec: "Engage in a balanced physical routine (e.g. Vinyasa yoga or jogging) for 30 minutes. Best done in the morning (6:30 AM - 8:00 AM).",
      sleep_timing_rec: "Wind down by 9:45 PM. Read or listen to soothing music, and sleep by 10:15 PM to align with circadian rhythms."
    };
  }
}

/**
 * Calculates a personalized Dinacharya plan, calling Groq completions or falling back to rules.
 *
 * @param userId User UUID
 * @param dateStr Target date (YYYY-MM-DD)
 * @param weather Optional weather condition ("Hot & Dry", "Cold & Humid", etc.)
 */
export async function calculateDinacharya(userId: string, dateStr: string, weather: string = 'Pleasant'): Promise<DinacharyaRecord> {
  try {
    const startStr = `${dateStr}T00:00:00.000Z`;
    const endStr = `${dateStr}T23:59:59.999Z`;

    // 1. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('dominant_dosha')
      .eq('id', userId)
      .single();

    const dosha = profile?.dominant_dosha || 'tridoshic';

    // 2. Fetch parallel logs for target date
    const [agniRes, ojasRes, sleepRes, actRes] = await Promise.all([
      supabase.from('daily_agni_scores').select('agni_score, agni_state').eq('user_id', userId).eq('date', dateStr).maybeSingle(),
      supabase.from('daily_ojas_scores').select('ojas_score, ojas_state').eq('user_id', userId).eq('date', dateStr).maybeSingle(),
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startStr).lte('start_time', endStr).maybeSingle(),
      supabase.from('activity_logs').select('steps_count').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr)
    ]);

    const agniScore = safeNumber(agniRes?.data?.agni_score, 70);
    const agniState = agniRes?.data?.agni_state || 'Moderate';
    const ojasScore = safeNumber(ojasRes?.data?.ojas_score, 70);
    const ojasState = ojasRes?.data?.ojas_state || 'Moderate Ojas';
    const sleepScore = safeNumber(sleepRes?.data?.sleep_score, 75);
    const stepsCount = (actRes.data || []).reduce((s, r) => s + safeNumber(r.steps_count, 0), 0);

    const currentHour = new Date().getHours();
    let timeOfDay = 'Morning';
    if (currentHour >= 12 && currentHour < 17) timeOfDay = 'Afternoon';
    else if (currentHour >= 17 && currentHour < 21) timeOfDay = 'Evening';
    else if (currentHour >= 21 || currentHour < 5) timeOfDay = 'Night';

    const metaInputs = {
      dosha,
      agni_score: agniScore,
      agni_state: agniState,
      ojas_score: ojasScore,
      ojas_state: ojasState,
      sleep_score: sleepScore,
      steps_count: stepsCount,
      weather,
      time_of_day: timeOfDay
    };

    let wakeUpRec = '';
    let hydrationRec = '';
    let mealTimingRec = '';
    let exerciseTimingRec = '';
    let sleepTimingRec = '';

    // 3. Consult Groq API if key is available
    if (GROQ_API_KEY) {
      const systemPrompt = `You are AyurVeda Coach, an Ayurvedic physician specializing in Dinacharya (circadian routines) and chronobiology.
Your task is to analyze the user's biometrics and environmental factors to generate personalized daily routine recommendations.

INPUT DATA:
- Constitution (Dosha): ${dosha}
- Agni (Digestive Fire): ${agniScore}/100 (${agniState})
- Ojas (Vitality): ${ojasScore}/100 (${ojasState})
- Sleep Quality: ${sleepScore}/100
- Today's Steps Count: ${stepsCount} steps
- Current Weather: ${weather}
- Time of Day: ${timeOfDay}

AYURVEDIC DOCKING RULES:
1. Wake-up: Brahma Muhurta (5:00 AM - 5:30 AM) is ideal for Kapha/Pitta; Vata rises at 6:00 AM. If Ojas is Low (< 41), recommend rising later (6:30 AM) with restorative stretching.
2. Hydration: Warm ginger/spiced water for Weak Agni or Kapha/Vata. Room-temperature fennel/coconut water for Pitta or Hot weather.
3. Meal Timing: High Agni allows larger meals. Weak Agni requires warm, light meals at exact intervals. Avoid cold food during Cold weather.
4. Exercise: Best done during Kapha time (6:00 AM - 10:00 AM). If Ojas is Low (< 41), forbid heavy exercise; recommend restorative yoga/walking.
5. Sleep: Sleep by 10:00 PM (Pitta time starts). Vata requires early wind-down; Kapha requires fewer hours (max 7 hrs).

Output strictly in JSON format with exactly these fields:
{
  "wake_up_rec": "Actionable morning waking time and rituals (1-2 sentences).",
  "hydration_rec": "Water temperature, ingredients, and schedule targets (1-2 sentences).",
  "meal_timing_rec": "Meal scheduling times and light/heavy meal advice based on digestive fire (1-2 sentences).",
  "exercise_timing_rec": "Exercise time window, duration, and exercise intensity (1-2 sentences).",
  "sleep_timing_rec": "Target bedtime, sleep duration, and wind-down ritual (1-2 sentences)."
}`;

      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Generate my Dinacharya schedule.' }
            ],
            temperature: 0.6,
            max_tokens: 500,
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          throw new Error(`Groq Dinacharya completions failed: ${response.status}`);
        }

        const resJson = await response.json();
        const parsed = JSON.parse(resJson.choices[0]?.message?.content || '{}');
        
        wakeUpRec = parsed.wake_up_rec;
        hydrationRec = parsed.hydration_rec;
        mealTimingRec = parsed.meal_timing_rec;
        exerciseTimingRec = parsed.exercise_timing_rec;
        sleepTimingRec = parsed.sleep_timing_rec;

      } catch (err) {
        console.warn('[DinacharyaEngine] Groq completion failed, falling back to static rules:', err);
      }
    }

    // 4. Fallback to static rules if any fields are empty/invalid
    if (!wakeUpRec || !hydrationRec || !mealTimingRec || !exerciseTimingRec || !sleepTimingRec) {
      const fb = getStaticDinacharya(dosha, agniState, ojasState, weather);
      wakeUpRec = wakeUpRec || fb.wake_up_rec;
      hydrationRec = hydrationRec || fb.hydration_rec;
      mealTimingRec = mealTimingRec || fb.meal_timing_rec;
      exerciseTimingRec = exerciseTimingRec || fb.exercise_timing_rec;
      sleepTimingRec = sleepTimingRec || fb.sleep_timing_rec;
    }

    const payload: DinacharyaRecord = {
      user_id: userId,
      date: dateStr,
      wake_up_rec: wakeUpRec,
      hydration_rec: hydrationRec,
      meal_timing_rec: mealTimingRec,
      exercise_timing_rec: exerciseTimingRec,
      sleep_timing_rec: sleepTimingRec,
      meta_inputs: metaInputs
    };

    // 5. Upsert into Supabase dinacharya_recommendations
    const { data: dbRec, error: dbError } = await supabase
      .from('dinacharya_recommendations')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (dbError) throw dbError;

    return {
      id: dbRec.id,
      user_id: dbRec.user_id,
      date: dbRec.date,
      wake_up_rec: dbRec.wake_up_rec,
      hydration_rec: dbRec.hydration_rec,
      meal_timing_rec: dbRec.meal_timing_rec,
      exercise_timing_rec: dbRec.exercise_timing_rec,
      sleep_timing_rec: dbRec.sleep_timing_rec,
      meta_inputs: dbRec.meta_inputs,
      created_at: dbRec.created_at
    };

  } catch (error: any) {
    console.error('[DinacharyaEngine] Error calculating Dinacharya:', error);
    throw error;
  }
}

/**
 * Fetches task completions for a specific date from Supabase.
 */
export async function getDailyCompletions(userId: string, dateStr: string): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from('dinacharya_completions')
      .select('task_key, completed')
      .eq('user_id', userId)
      .eq('date', dateStr);

    if (error) throw error;

    const completions: Record<string, boolean> = {
      wake_up: false,
      hydration: false,
      meal_timing: false,
      exercise_timing: false,
      sleep_timing: false,
    };

    if (data) {
      data.forEach((row: any) => {
        completions[row.task_key] = row.completed;
      });
    }

    return completions;
  } catch (error) {
    console.error('[DinacharyaEngine] Error fetching daily completions:', error);
    return {
      wake_up: false,
      hydration: false,
      meal_timing: false,
      exercise_timing: false,
      sleep_timing: false,
    };
  }
}

/**
 * Toggles a specific task's completion status in Supabase.
 */
export async function toggleCompletion(userId: string, dateStr: string, taskKey: string, completed: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('dinacharya_completions')
      .upsert(
        {
          user_id: userId,
          date: dateStr,
          task_key: taskKey,
          completed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date,task_key' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('[DinacharyaEngine] Error toggling completion:', error);
    throw error;
  }
}
