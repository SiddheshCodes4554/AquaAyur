import { supabase } from './supabase';

export interface AgniScoreRecord {
  id?: string;
  user_id: string;
  date: string;
  agni_score: number;
  agni_state: 'Weak' | 'Moderate' | 'Strong';
  s_timing: number;
  s_diet: number;
  s_vitals: number;
  s_hydration: number;
  s_activity: number;
  s_sleep: number;
  created_at?: string;
}

/**
 * Utility to convert null, undefined, or NaN to a valid numeric value.
 */
export function safeNumber(value: any, fallback: number): number {
  if (
    value === null ||
    value === undefined ||
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }
  return value;
}

/**
 * Calculates Agni Score and logs it to Supabase for the specified date.
 * 
 * @param userId User UUID
 * @param dateStr Target date (YYYY-MM-DD format)
 */
export async function calculateDailyAgni(userId: string, dateStr: string): Promise<AgniScoreRecord> {
  try {
    const startStr = `${dateStr}T00:00:00.000Z`;
    const endStr = `${dateStr}T23:59:59.999Z`;

    // 1. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('dominant_dosha, daily_calorie_goal_kcal, daily_water_goal_ml')
      .eq('id', userId)
      .single();

    const calorieGoal = safeNumber(profile?.daily_calorie_goal_kcal, 2000);
    const waterGoal = safeNumber(profile?.daily_water_goal_ml, 2500);

    // 2. Fetch parallel logs for target date
    const [hrRes, tempRes, actRes, sleepRes, waterRes, foodRes] = await Promise.all([
      supabase.from('heart_rate_logs').select('bpm, timestamp').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('temperature_logs').select('temperature_celsius, timestamp').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('activity_logs').select('steps_count, timestamp').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startStr).lte('start_time', endStr),
      supabase.from('hydration_logs').select('amount_ml, timestamp').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('food_logs').select('*, nutrition_analysis(*)').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr)
    ]);

    // 3. Compute component scores

    // A. Metabolic Vitals (20%)
    const heartRates = (hrRes.data || [])
      .map(r => Number(r.bpm))
      .filter(v => !isNaN(v) && isFinite(v) && v > 0);
    const temperatures = (tempRes.data || [])
      .map(r => Number(r.temperature_celsius))
      .filter(v => !isNaN(v) && isFinite(v) && v > 0);

    const avgHr = heartRates.length > 0 ? heartRates.reduce((s, v) => s + v, 0) / heartRates.length : 68;
    const avgTemp = temperatures.length > 0 ? temperatures.reduce((s, v) => s + v, 0) / temperatures.length : 36.5;

    const safeAvgHr = safeNumber(avgHr, 68);
    const safeAvgTemp = safeNumber(avgTemp, 36.5);

    // Resting pulse target: 62 - 74 bpm. Center is 68.
    const hrDeviation = Math.abs(safeAvgHr - 68);
    const pulseScore = Math.max(0, 100 - Math.max(0, hrDeviation - 6) * 5); // Allow buffer of 6, penalize 5 points per bpm deviation

    // Skin temperature target: 36.2°C - 36.8°C. Center is 36.5.
    const tempDeviation = Math.abs(safeAvgTemp - 36.5);
    const tempScore = Math.max(0, 100 - Math.max(0, tempDeviation - 0.3) * 50); // Allow buffer of 0.3°C, penalize 50 points per 1°C deviation

    const sVitals = Number(safeNumber((pulseScore + tempScore) / 2, 70).toFixed(1));

    // B. Circadian Meal Timing (20%)
    let sTiming = 75; // Default if no meals
    const foodLogs = foodRes.data || [];
    if (foodLogs.length > 0) {
      let timingScoresSum = 0;
      let lateMealsCount = 0;
      let validMealScoresCount = 0;

      foodLogs.forEach(meal => {
        const timestampStr = meal.timestamp;
        if (!timestampStr) return; // skip missing timestamp
        const mealTime = new Date(timestampStr);
        if (isNaN(mealTime.getTime())) return; // skip invalid date

        const hour = mealTime.getHours() + mealTime.getMinutes() / 60;
        if (isNaN(hour) || !isFinite(hour)) return; // skip invalid hour

        let mealScore = 100;

        if (meal.meal_type === 'lunch') {
          // Target Lunch: 11:30 AM - 1:30 PM (hours 11.5 - 13.5)
          if (hour < 11.5 || hour > 13.5) {
            const distance = Math.min(Math.abs(hour - 11.5), Math.abs(hour - 13.5));
            mealScore = Math.max(0, 100 - distance * 15);
          }
        } else if (meal.meal_type === 'dinner') {
          // Target Dinner: Before 7:30 PM (hours 19.5)
          if (hour > 19.5) {
            const excess = hour - 19.5;
            mealScore = Math.max(0, 100 - excess * 20);
          }
        } else if (meal.meal_type === 'breakfast') {
          // Target Breakfast: 7:00 AM - 9:30 AM (hours 7.0 - 9.5)
          if (hour < 7.0 || hour > 9.5) {
            const distance = Math.min(Math.abs(hour - 7.0), Math.abs(hour - 9.5));
            mealScore = Math.max(0, 100 - distance * 10);
          }
        }

        // Penalty for late night meals (10:00 PM - 4:00 AM)
        if (hour >= 22.0 || hour < 4.0) {
          mealScore = Math.max(0, mealScore - 30);
          lateMealsCount++;
        }

        timingScoresSum += safeNumber(mealScore, 100);
        validMealScoresCount++;
      });

      if (validMealScoresCount > 0) {
        let avgTimingScore = timingScoresSum / validMealScoresCount;
        if (lateMealsCount > 0) {
          avgTimingScore = Math.max(0, avgTimingScore - 10); // extra general penalty
        }
        sTiming = Number(safeNumber(avgTimingScore, 75).toFixed(1));
      } else {
        sTiming = 75; // Neutral fallback if all meal logs had invalid timestamps
      }
    }

    // C. Diet Quality (20%)
    let sDiet = 75; // Default if no meals
    if (foodLogs.length > 0) {
      let tasteScoreSum = 0;
      let sweetMealsCount = 0;
      let totalCalories = 0;
      let validTasteScoresCount = 0;

      foodLogs.forEach(meal => {
        const mealCals = Number(meal.calories_kcal);
        totalCalories += isNaN(mealCals) || !isFinite(mealCals) ? 0 : mealCals;

        const analysis = meal.nutrition_analysis;
        let mealTasteScore = 75; // neutral base

        if (analysis) {
          const taste = analysis.ayurvedic_taste || 'sweet';
          if (taste === 'pungent') {
            mealTasteScore = 100; // Stimulates Agni
          } else if (taste === 'sour' || taste === 'salty') {
            mealTasteScore = 90; // Moderately stimulates Agni
          } else if (taste === 'bitter' || taste === 'astringent') {
            mealTasteScore = 80; // Clearing
          } else if (taste === 'sweet') {
            mealTasteScore = 55; // Sluggish, heavy, dampens Agni
            sweetMealsCount++;
          }
        }
        tasteScoreSum += safeNumber(mealTasteScore, 75);
        validTasteScoresCount++;
      });

      if (validTasteScoresCount > 0) {
        let avgTasteScore = tasteScoreSum / validTasteScoresCount;

        // Penalty for exceeding daily calorie budget (overeating dampens Agni)
        if (totalCalories > calorieGoal * 1.2) {
          const excessKcal = totalCalories - calorieGoal * 1.2;
          const penalty = Math.min(50, (excessKcal / 100) * 5); // 5 points penalty per 100 excess kcal, max 50
          avgTasteScore = Math.max(0, avgTasteScore - penalty);
        }

        sDiet = Number(safeNumber(avgTasteScore, 75).toFixed(1));
      } else {
        sDiet = 75;
      }
    }

    // D. Fluid Volume (15%)
    const totalWater = (waterRes.data || [])
      .map(r => Number(r.amount_ml))
      .filter(v => !isNaN(v) && isFinite(v))
      .reduce((s, r) => s + r, 0);

    let sHydration = 100;
    if (totalWater < 2000) {
      // Under-hydration: linear drop to 0 at 0 mL
      sHydration = (totalWater / 2000) * 100;
    } else if (totalWater > 3000) {
      // Over-hydration (excess water logs): linear drop to 50 at 4500 mL
      const excess = totalWater - 3000;
      sHydration = Math.max(0, 100 - (excess / 1500) * 50);
    }
    sHydration = Number(safeNumber(sHydration, 70).toFixed(1));

    // E. Vyayama Exercise (15%)
    const totalSteps = (actRes.data || [])
      .map(r => Number(r.steps_count))
      .filter(v => !isNaN(v) && isFinite(v))
      .reduce((s, r) => s + r, 0);

    let sActivity = 100;
    if (totalSteps < 6000) {
      // Under-activity: linear drop to 0 at 0 steps
      sActivity = (totalSteps / 6000) * 100;
    } else if (totalSteps > 10000) {
      // Over-exertion / heavy exercise: linear drop to 50 at 20000 steps
      const excess = totalSteps - 10000;
      sActivity = Math.max(50, 100 - (excess / 10000) * 50);
    }
    sActivity = Number(safeNumber(sActivity, 70).toFixed(1));

    // F. Sleep Restfulness (10%)
    const sleepLogs = sleepRes.data || [];
    let sSleep = 75; // Default if no logs
    if (sleepLogs.length > 0) {
      const validScores = sleepLogs
        .map(r => Number(r.sleep_score))
        .filter(v => !isNaN(v) && isFinite(v));
      
      if (validScores.length > 0) {
        const avgSleepIdx = validScores.reduce((s, r) => s + r, 0) / validScores.length;
        sSleep = Number(safeNumber(avgSleepIdx, 75).toFixed(1));
      }
    }

    // 4. Calculate final weighted Agni Score
    const agniScoreRaw = (
      0.20 * sTiming +
      0.20 * sDiet +
      0.20 * sVitals +
      0.15 * sHydration +
      0.15 * sActivity +
      0.10 * sSleep
    );
    const agniScore = Number(safeNumber(agniScoreRaw, 70).toFixed(1));

    // 5. Determine active Agni State Classification
    let agniState: 'Weak' | 'Moderate' | 'Strong' = 'Moderate';
    if (agniScore >= 71) {
      agniState = 'Strong';
    } else if (agniScore >= 41) {
      agniState = 'Moderate';
    } else {
      agniState = 'Weak';
    }

    // 6. Log intermediate and final values before insert
    console.log('[AgniEngine] Pre-insert Metric Audit:', {
      mealCount: foodLogs.length,
      timingScore: sTiming,
      dietScore: sDiet,
      vitalsScore: sVitals,
      hydrationScore: sHydration,
      activityScore: sActivity,
      sleepScore: sSleep,
      agniScore: agniScore
    });

    // 7. Validate that none of the numeric fields contain null, undefined, NaN, or non-finite values
    const scoreChecklist = [
      { name: 'agni_score', val: agniScore },
      { name: 's_timing', val: sTiming },
      { name: 's_diet', val: sDiet },
      { name: 's_vitals', val: sVitals },
      { name: 's_hydration', val: sHydration },
      { name: 's_activity', val: sActivity },
      { name: 's_sleep', val: sSleep }
    ];

    scoreChecklist.forEach(item => {
      if (
        item.val === null ||
        item.val === undefined ||
        Number.isNaN(item.val) ||
        !Number.isFinite(item.val)
      ) {
        throw new Error(`[AgniEngine] Pre-insert validation failed: column ${item.name} is ${item.val}`);
      }
    });

    const payload: AgniScoreRecord = {
      user_id: userId,
      date: dateStr,
      agni_score: agniScore,
      agni_state: agniState,
      s_timing: sTiming,
      s_diet: sDiet,
      s_vitals: sVitals,
      s_hydration: sHydration,
      s_activity: sActivity,
      s_sleep: sSleep
    };

    // 8. Save/upsert calculated daily scores in Supabase
    const { data: dbAgni, error: dbError } = await supabase
      .from('daily_agni_scores')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (dbError) throw dbError;

    return {
      id: dbAgni.id,
      user_id: dbAgni.user_id,
      date: dbAgni.date,
      agni_score: Number(dbAgni.agni_score),
      agni_state: dbAgni.agni_state as any,
      s_timing: Number(dbAgni.s_timing),
      s_diet: Number(dbAgni.s_diet),
      s_vitals: Number(dbAgni.s_vitals),
      s_hydration: Number(dbAgni.s_hydration),
      s_activity: Number(dbAgni.s_activity),
      s_sleep: Number(dbAgni.s_sleep),
      created_at: dbAgni.created_at
    };

  } catch (error: any) {
    console.error('[AgniEngine] Error calculating daily Agni score:', error);
    throw error;
  }
}
