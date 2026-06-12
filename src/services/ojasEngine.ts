import { supabase } from './supabase';

export interface OjasScoreRecord {
  id?: string;
  user_id: string;
  date: string;
  ojas_score: number;
  ojas_state: 'Low Ojas' | 'Moderate Ojas' | 'High Ojas';
  s_sleep: number;
  s_recovery: number;
  s_rhr: number;
  s_activity: number;
  s_nutrition: number;
  s_hydration: number;
  created_at?: string;
}

/**
 * Calculates daily Ojas Score (resilience, vitality, recovery) and logs it to Supabase.
 *
 * @param userId User UUID
 * @param dateStr Target date (YYYY-MM-DD format)
 */
export async function calculateDailyOjas(userId: string, dateStr: string): Promise<OjasScoreRecord> {
  try {
    const startStr = `${dateStr}T00:00:00.000Z`;
    const endStr = `${dateStr}T23:59:59.999Z`;

    // 7-day lookback window for recovery and activity baseline
    const targetDate = new Date(dateStr);
    const startDate = new Date(targetDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    const lookbackStartStr = `${startDate.toISOString().split('T')[0]}T00:00:00.000Z`;

    // 1. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('dominant_dosha, daily_calorie_goal_kcal, daily_water_goal_ml')
      .eq('id', userId)
      .single();

    const calorieGoal = profile?.daily_calorie_goal_kcal || 2000;
    const waterGoal = profile?.daily_water_goal_ml || 2500;

    // 2. Fetch parallel logs for target date & baseline window
    const [
      hrTodayRes,
      hrHistRes,
      actHistRes,
      sleepRes,
      waterRes,
      foodRes
    ] = await Promise.all([
      // Heart rate logs for today
      supabase.from('heart_rate_logs').select('bpm, hrv_ms, timestamp').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      // Heart rate logs for the past 7 days (to establish HRV baseline)
      supabase.from('heart_rate_logs').select('hrv_ms').eq('user_id', userId).gte('timestamp', lookbackStartStr).lte('timestamp', endStr),
      // Activity logs for the past 7 days (to calculate activity consistency)
      supabase.from('activity_logs').select('steps_count, timestamp').eq('user_id', userId).gte('timestamp', lookbackStartStr).lte('timestamp', endStr),
      // Sleep logs for today
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startStr).lte('start_time', endStr),
      // Hydration logs for today
      supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      // Food logs for today
      supabase.from('food_logs').select('*, nutrition_analysis(*)').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr)
    ]);

    // 3. Compute component scores

    // A. Sleep Quality (20%)
    const sleepLogs = sleepRes.data || [];
    let sSleep = 70; // Default baseline if no logs
    if (sleepLogs.length > 0) {
      const avgSleepIdx = sleepLogs.reduce((s, r) => s + Number(r.sleep_score || 0), 0) / sleepLogs.length;
      sSleep = Number(avgSleepIdx.toFixed(1));
    }

    // B. Resting Heart Rate (15%)
    const bpmVals = (hrTodayRes.data || []).map(r => Number(r.bpm)).filter(v => v > 30 && v < 220);
    let rhr = 70;
    if (bpmVals.length > 0) {
      // Sort ascending to grab lowest heart rates representing resting state
      bpmVals.sort((a, b) => a - b);
      const sampleCount = Math.max(1, Math.floor(bpmVals.length * 0.10));
      const lowestVals = bpmVals.slice(0, sampleCount);
      rhr = lowestVals.reduce((s, v) => s + v, 0) / lowestVals.length;
    }

    let sRhr = 100;
    if (bpmVals.length > 0) {
      // Optimal resting pulse is 54 - 64 bpm for building/preserving Ojas
      if (rhr >= 54 && rhr <= 64) {
        sRhr = 100;
      } else if (rhr > 64) {
        // Penalize 4 points per bpm over 64
        sRhr = Math.max(0, 100 - (rhr - 64) * 4);
      } else {
        // Penalize 5 points per bpm under 54 (excess bradycardia)
        sRhr = Math.max(0, 100 - (54 - rhr) * 5);
      }
    } else {
      sRhr = 70;
    }
    sRhr = Number(sRhr.toFixed(1));

    // C. Recovery Trends / HRV (20%)
    const hrvValsToday = (hrTodayRes.data || [])
      .map(r => Number(r.hrv_ms))
      .filter(v => !isNaN(v) && v > 0);
    const avgHrvToday = hrvValsToday.length > 0
      ? hrvValsToday.reduce((s, v) => s + v, 0) / hrvValsToday.length
      : null;

    const hrvValsHist = (hrHistRes.data || [])
      .map(r => Number(r.hrv_ms))
      .filter(v => !isNaN(v) && v > 0);
    const avgHrvHist = hrvValsHist.length > 0
      ? hrvValsHist.reduce((s, v) => s + v, 0) / hrvValsHist.length
      : null;

    let sRecovery = 75; // Default if no HRV data
    if (avgHrvToday !== null) {
      if (avgHrvHist !== null && avgHrvHist > 0) {
        const ratio = avgHrvToday / avgHrvHist;
        if (ratio >= 1.0) {
          // Stable or improving recovery trend
          sRecovery = Math.min(100, 80 + (ratio - 1.0) * 100);
        } else {
          // Declining recovery trend
          sRecovery = Math.max(20, 80 - (1.0 - ratio) * 150);
        }
      } else {
        // Absolute HRV score fallback
        if (avgHrvToday >= 60) {
          sRecovery = 100;
        } else if (avgHrvToday <= 30) {
          sRecovery = 40;
        } else {
          sRecovery = 40 + (avgHrvToday - 30) * 2.0;
        }
      }
    }
    sRecovery = Number(sRecovery.toFixed(1));

    // D. Activity Consistency (15%)
    const dailyStepsMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate.getTime());
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      dailyStepsMap[dateKey] = 0;
    }

    (actHistRes.data || []).forEach(log => {
      const dateKey = log.timestamp.split('T')[0];
      if (dailyStepsMap[dateKey] !== undefined) {
        dailyStepsMap[dateKey] += Number(log.steps_count || 0);
      }
    });

    const stepScores: number[] = Object.values(dailyStepsMap).map(steps => {
      if (steps >= 6000 && steps <= 10000) {
        return 100; // Optimal balanced exercise builds Ojas
      } else if (steps < 6000) {
        return (steps / 6000) * 100;
      } else {
        const excess = steps - 10000;
        // Over-exertion exhausts energy and depletes Ojas
        return Math.max(50, 100 - (excess / 10000) * 50);
      }
    });

    const stepsList = Object.values(dailyStepsMap);
    const meanSteps = stepsList.reduce((s, v) => s + v, 0) / stepsList.length;

    let sActivity = 70; // Default baseline if no activity
    if (stepsList.length > 0) {
      const avgStepScore = stepScores.reduce((s, v) => s + v, 0) / stepScores.length;
      const variance = stepsList.reduce((s, v) => s + Math.pow(v - meanSteps, 2), 0) / stepsList.length;
      const stdDev = Math.sqrt(variance);
      const cv = meanSteps > 0 ? (stdDev / meanSteps) : 0;

      // Penalize step scores if daily activity fluctuates wildly (inconsistent)
      sActivity = avgStepScore - cv * 20;
      sActivity = Math.max(20, Math.min(100, sActivity));
    }
    sActivity = Number(sActivity.toFixed(1));

    // E. Nutrition Quality (15%)
    const foodLogs = foodRes.data || [];
    let sNutrition = 70; // Default baseline if no meals
    if (foodLogs.length > 0) {
      let tasteScoreSum = 0;
      let totalCalories = 0;

      foodLogs.forEach(meal => {
        totalCalories += Number(meal.calories_kcal || 0);
        const analysis = meal.nutrition_analysis;
        let mealTasteScore = 75; // Neutral baseline

        if (analysis) {
          const taste = analysis.ayurvedic_taste || 'sweet';
          if (taste === 'sweet') {
            mealTasteScore = 100; // Sweet/nourishing tastes directly build Ojas
          } else if (taste === 'bitter' || taste === 'astringent') {
            mealTasteScore = 85; // Cooling and light
          } else if (taste === 'sour' || taste === 'salty') {
            mealTasteScore = 70; // Moderately depleting if in excess
          } else if (taste === 'pungent') {
            mealTasteScore = 60; // Pungent heat burns Ojas
          }
        }
        tasteScoreSum += mealTasteScore;
      });

      let avgTasteScore = tasteScoreSum / foodLogs.length;

      // Check for extreme under-eating or over-eating
      const lowerCalBound = calorieGoal * 0.6;
      const upperCalBound = calorieGoal * 1.2;
      if (totalCalories > upperCalBound || totalCalories < lowerCalBound) {
        avgTasteScore = Math.max(20, avgTasteScore - 20); // Penalty for calorie deviations
      }

      sNutrition = Number(avgTasteScore.toFixed(1));
    }

    // F. Hydration Volume (15%)
    const totalWater = (waterRes.data || []).reduce((s, r) => s + Number(r.amount_ml), 0);
    let sHydration = 100;
    if (totalWater >= 2200 && totalWater <= 3500) {
      sHydration = 100;
    } else if (totalWater < 2200) {
      sHydration = (totalWater / 2200) * 100;
    } else {
      const excess = totalWater - 3500;
      sHydration = Math.max(50, 100 - (excess / 1500) * 50);
    }
    sHydration = Number(sHydration.toFixed(1));

    // 4. Calculate final weighted Ojas Score
    const ojasScore = Number((
      0.20 * sSleep +
      0.20 * sRecovery +
      0.15 * sRhr +
      0.15 * sActivity +
      0.15 * sNutrition +
      0.15 * sHydration
    ).toFixed(1));

    // 5. Determine active Ojas State Classification
    let ojasState: 'Low Ojas' | 'Moderate Ojas' | 'High Ojas' = 'Moderate Ojas';
    if (ojasScore >= 71) {
      ojasState = 'High Ojas';
    } else if (ojasScore >= 41) {
      ojasState = 'Moderate Ojas';
    } else {
      ojasState = 'Low Ojas';
    }

    const payload: OjasScoreRecord = {
      user_id: userId,
      date: dateStr,
      ojas_score: ojasScore,
      ojas_state: ojasState,
      s_sleep: sSleep,
      s_recovery: sRecovery,
      s_rhr: sRhr,
      s_activity: sActivity,
      s_nutrition: sNutrition,
      s_hydration: sHydration
    };

    // 6. Save/upsert calculated daily scores in Supabase
    const { data: dbOjas, error: dbError } = await supabase
      .from('daily_ojas_scores')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (dbError) throw dbError;

    return {
      id: dbOjas.id,
      user_id: dbOjas.user_id,
      date: dbOjas.date,
      ojas_score: Number(dbOjas.ojas_score),
      ojas_state: dbOjas.ojas_state as any,
      s_sleep: Number(dbOjas.s_sleep),
      s_recovery: Number(dbOjas.s_recovery),
      s_rhr: Number(dbOjas.s_rhr),
      s_activity: Number(dbOjas.s_activity),
      s_nutrition: Number(dbOjas.s_nutrition),
      s_hydration: Number(dbOjas.s_hydration),
      created_at: dbOjas.created_at
    };

  } catch (error: any) {
    console.error('[OjasEngine] Error calculating daily Ojas score:', error);
    throw error;
  }
}
