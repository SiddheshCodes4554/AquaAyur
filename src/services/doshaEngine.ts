import { supabase } from './supabase';

// -------------------------------------------------------------------------
// Coefficients and Weights Definitions
// -------------------------------------------------------------------------
const WEIGHTS = {
  VATA: {
    hrv: 0.40,
    tempCold: 0.15,
    sleepPoor: 0.30,
    stepsErratic: 0.15,
    tasteBitterPungentAstringent: 0.30,
    hydrationLow: 0.20
  },
  PITTA: {
    hrRestHigh: 0.35,
    tempHot: 0.40,
    stepsHigh: 0.25,
    tasteSourSaltyPungent: 0.30
  },
  KAPHA: {
    hrRestLow: 0.35,
    tempCold: 0.15,
    sleepLong: 0.30,
    stepsSedentary: 0.30,
    tasteSweetSourSalty: 0.30,
    hydrationOver: 0.10
  }
};

// Map profiles' dominant_dosha to base weights
export const DOSHA_BASELINES: Record<string, { vata: number; pitta: number; kapha: number }> = {
  vata: { vata: 50.0, pitta: 25.0, kapha: 25.0 },
  pitta: { vata: 25.0, pitta: 50.0, kapha: 25.0 },
  kapha: { vata: 25.0, pitta: 25.0, kapha: 50.0 },
  dual_vata_pitta: { vata: 40.0, pitta: 40.0, kapha: 20.0 },
  dual_pitta_kapha: { vata: 20.0, pitta: 40.0, kapha: 40.0 },
  dual_vata_kapha: { vata: 40.0, pitta: 20.0, kapha: 40.0 },
  tridoshic: { vata: 33.3, pitta: 33.3, kapha: 33.3 },
  default: { vata: 33.3, pitta: 33.3, kapha: 33.3 }
};

export interface CalculatedDoshaState {
  vata: number;
  pitta: number;
  kapha: number;
  heartRateAvg: number | null;
  temperatureAvg: number | null;
  stepsCount: number;
  sleepDurationMinutes: number;
  waterIntakeMl: number;
  tasteProfile: Record<string, number>;
  explanationSummary: {
    aggravating: string[];
    pacifying: string[];
  };
  trendAlert: string;
}

/**
 * Validate input metrics to ensure biological plausibility before calculations.
 */
export function validateInputTelemetry(metrics: {
  heartRate: number | null;
  temperature: number | null;
  steps: number;
  sleepMinutes: number;
  waterMl: number;
}) {
  if (metrics.heartRate !== null && (metrics.heartRate < 30 || metrics.heartRate > 220)) {
    console.warn(`[DoshaEngine] Out of bounds heart rate received: ${metrics.heartRate}`);
  }
  if (metrics.temperature !== null && (metrics.temperature < 25.0 || metrics.temperature > 45.0)) {
    console.warn(`[DoshaEngine] Out of bounds skin temperature received: ${metrics.temperature}`);
  }
  if (metrics.steps < 0 || metrics.sleepMinutes < 0 || metrics.waterMl < 0) {
    throw new Error('Input metrics steps, sleep, and hydration cannot be negative.');
  }
}

/**
 * Validate output dynamic dosha states.
 */
export function validateOutputDosha(state: { vata: number; pitta: number; kapha: number }) {
  if (state.vata < 0 || state.pitta < 0 || state.kapha < 0) {
    throw new Error('Computed dosha percentages cannot be negative.');
  }
  const sum = state.vata + state.pitta + state.kapha;
  if (Math.abs(sum - 100.0) > 1.5) {
    throw new Error(`Dynamic dosha percentages must sum to 100%, calculated: ${sum}%`);
  }
}

/**
 * Detect daily dynamic trends across the past week's calculated states.
 */
export async function detectDoshaTrends(
  userId: string,
  current: { vata: number; pitta: number; kapha: number }
): Promise<string> {
  const history = await getDoshaHistory(userId, 5); // Fetch past 5 records
  if (history.length < 3) {
    return 'Establishing baseline trend analysis... More daily logs required.';
  }

  // Calculate historical averages of previous days
  const prevVata = history.reduce((sum, r) => sum + Number(r.vata_percentage), 0) / history.length;
  const prevPitta = history.reduce((sum, r) => sum + Number(r.pitta_percentage), 0) / history.length;
  const prevKapha = history.reduce((sum, r) => sum + Number(r.kapha_percentage), 0) / history.length;

  const vataDiff = current.vata - prevVata;
  const pittaDiff = current.pitta - prevPitta;
  const kaphaDiff = current.kapha - prevKapha;

  const trends: string[] = [];
  if (vataDiff > 5) {
    trends.push('Vata is consistently rising (+Air/Ether). Focus on grounding, warm teas, and rest.');
  }
  if (pittaDiff > 5) {
    trends.push('Pitta is rising (+Fire). Cooling hydration, sweet fruits, and quiet relaxation recommended.');
  }
  if (kaphaDiff > 5) {
    trends.push('Kapha is rising (+Earth/Water). Brisk exercises, light diets, and spices needed to clear stagnation.');
  }

  if (trends.length === 0) {
    return 'Your dynamic bio-elements are steady and in equilibrium relative to your weekly trend.';
  }
  return trends.join(' ');
}

/**
 * Calculates user's dynamic dosha levels for a given calendar date (YYYY-MM-DD).
 * Fetches metrics logs from Supabase, processes features, scales deltas, and saves the output.
 */
export async function calculateDailyDosha(userId: string, dateStr: string): Promise<CalculatedDoshaState> {
  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999`);
  const dayStart = startOfDay.toISOString();
  const dayEnd = endOfDay.toISOString();

  // 1. Fetch user baseline profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('dominant_dosha')
    .eq('id', userId)
    .single();

  const dominantDosha = profile?.dominant_dosha || 'default';
  const baseline = DOSHA_BASELINES[dominantDosha] || DOSHA_BASELINES.default;

  // 2. Fetch daily biometrics, sleep, nutrition, and hydration in parallel
  const [
    hrResponse,
    tempResponse,
    actResponse,
    sleepResponse,
    waterResponse,
    foodResponse
  ] = await Promise.all([
    supabase.from('heart_rate_logs').select('bpm').eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd),
    supabase.from('temperature_logs').select('temperature_celsius').eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd),
    supabase.from('activity_logs').select('steps_count, activity_type').eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd),
    supabase.from('sleep_logs').select('duration_minutes, sleep_score').eq('user_id', userId).gte('start_time', dayStart).lte('start_time', dayEnd),
    supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd),
    supabase.from('food_logs').select(`
      id,
      quantity_g,
      nutrition_analysis (
        ayurvedic_taste
      )
    `).eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd)
  ]);

  // 3. Process biometrics metrics
  const hrLogs = hrResponse.data || [];
  const tempLogs = tempResponse.data || [];
  const actLogs = actResponse.data || [];
  const sleepLogs = sleepResponse.data || [];
  const waterLogs = waterResponse.data || [];
  const foodLogs = foodResponse.data || [];

  // Resting HR details
  const hrValues = hrLogs.map(l => l.bpm);
  const avgHr = hrValues.length > 0 ? Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length) : null;
  const hrRestBase = 70; // target baseline rest HR

  // HR Variability (approximation: standard deviation of heart rate logs)
  let hrvVal = 0;
  if (hrValues.length > 1 && avgHr !== null) {
    const variance = hrValues.reduce((s, v) => s + Math.pow(v - avgHr, 2), 0) / (hrValues.length - 1);
    hrvVal = Math.sqrt(variance);
  }

  // Skin Temperature
  const tempValues = tempLogs.map(l => Number(l.temperature_celsius));
  const avgTemp = tempValues.length > 0 ? Number((tempValues.reduce((s, v) => s + v, 0) / tempValues.length).toFixed(1)) : null;
  const tempBase = 36.5;

  // Sleep
  const totalSleepMinutes = sleepLogs.reduce((s, l) => s + l.duration_minutes, 0);
  const avgSleepScore = sleepLogs.length > 0 ? sleepLogs.reduce((s, l) => s + l.sleep_score, 0) / sleepLogs.length : 100;

  // Steps & activity
  const totalSteps = actLogs.reduce((s, l) => s + l.steps_count, 0);
  const sedentaryCount = actLogs.filter(l => l.activity_type === 'sedentary').length;
  const activityRatio = actLogs.length > 0 ? (actLogs.length - sedentaryCount) / actLogs.length : 0.5;

  // Hydration
  const totalWaterMl = waterLogs.reduce((s, l) => s + l.amount_ml, 0);

  // Validate inputs
  validateInputTelemetry({
    heartRate: avgHr,
    temperature: avgTemp,
    steps: totalSteps,
    sleepMinutes: totalSleepMinutes,
    waterMl: totalWaterMl
  });

  // Nutrition tastes proportions
  const tastesCounts: Record<string, number> = {
    sweet: 0,
    sour: 0,
    salty: 0,
    bitter: 0,
    pungent: 0,
    astringent: 0
  };

  foodLogs.forEach((f: any) => {
    const taste = f.nutrition_analysis?.ayurvedic_taste;
    if (taste && taste in tastesCounts) {
      tastesCounts[taste] += 1;
    }
  });

  const totalTasteLogs = Object.values(tastesCounts).reduce((s, v) => s + v, 0);
  const tastesProportions = {
    sweet: totalTasteLogs > 0 ? tastesCounts.sweet / totalTasteLogs : 0,
    sour: totalTasteLogs > 0 ? tastesCounts.sour / totalTasteLogs : 0,
    salty: totalTasteLogs > 0 ? tastesCounts.salty / totalTasteLogs : 0,
    bitter: totalTasteLogs > 0 ? tastesCounts.bitter / totalTasteLogs : 0,
    pungent: totalTasteLogs > 0 ? tastesCounts.pungent / totalTasteLogs : 0,
    astringent: totalTasteLogs > 0 ? tastesCounts.astringent / totalTasteLogs : 0
  };

  // -------------------------------------------------------------------------
  // 4. Feature Engineering Indices Mapping & Explainability Trace
  // -------------------------------------------------------------------------
  const aggravating: string[] = [];
  const pacifying: string[] = [];

  // Vata Features
  const f_hrv = Math.min(1.0, hrvVal / 15.0);
  if (f_hrv > 0.5) aggravating.push('High HRV variability matches unstable Vata (Air) nervous energy.');
  
  const f_tempCold = avgTemp !== null && avgTemp < tempBase ? Math.min(1.0, (tempBase - avgTemp) / 1.5) : 0;
  if (f_tempCold > 0.4) aggravating.push(`Cooler body temp (${avgTemp}°C) triggers cooling Vata/Kapha properties.`);
  else if (avgTemp !== null) pacifying.push('Stable core temperature balances cooling elements.');

  const f_sleepPoor = totalSleepMinutes > 0 && totalSleepMinutes < 360 ? Math.min(1.0, (360 - totalSleepMinutes) / 120) : (avgSleepScore < 65 ? 0.5 : 0);
  if (f_sleepPoor > 0.4) aggravating.push('Restless or truncated sleep has excited Vata hyper-sensitivity.');
  else if (totalSleepMinutes >= 360) pacifying.push('Adequate sleep duration pacifies Vata attributes.');

  const f_stepsErratic = activityRatio > 0.7 && totalSteps > 8000 && totalSteps < 12000 ? 0.6 : 0;
  if (f_stepsErratic > 0.4) aggravating.push('Erratic, active physical step distribution excites Vata wind elements.');

  const f_tasteVata = tastesProportions.bitter + tastesProportions.pungent + tastesProportions.astringent;
  if (f_tasteVata > 0.5) aggravating.push('Aggravating dry/light tastes consumed (Bitter, Spicy, or Astringent).');
  
  const f_hydrationLow = totalWaterMl > 0 && totalWaterMl < 1500 ? Math.min(1.0, (1500 - totalWaterMl) / 1000) : 0;
  if (f_hydrationLow > 0.5) aggravating.push('Inadequate water intake (<1500ml) increases Vata dryness.');
  else if (totalWaterMl >= 2000) pacifying.push('Abundant hydration maintains tissue moisture (pacifying Vata).');

  // Pitta Features
  const f_hrHigh = avgHr !== null && avgHr > hrRestBase + 5 ? Math.min(1.0, (avgHr - (hrRestBase + 5)) / 15.0) : 0;
  if (f_hrHigh > 0.4) aggravating.push(`Elevated resting heart rate (${avgHr} bpm) triggers hyperactive Pitta (Fire).`);
  
  const f_tempHot = avgTemp !== null && avgTemp > tempBase + 0.3 ? Math.min(1.0, (avgTemp - (tempBase + 0.3)) / 1.5) : 0;
  if (f_tempHot > 0.4) aggravating.push(`Thermal skin temperature rises (${avgTemp}°C) activate heat-seeking Pitta.`);

  const f_stepsHigh = totalSteps > 12000 ? Math.min(1.0, (totalSteps - 12000) / 8000.0) : 0;
  if (f_stepsHigh > 0.5) aggravating.push('High cardiovascular step counts trigger metabolic Pitta fire.');

  const f_tastePitta = tastesProportions.sour + tastesProportions.salty + tastesProportions.pungent;
  if (f_tastePitta > 0.5) aggravating.push('Heating tastes logged (Sour, Salty, or Spicy/Pungent).');

  // Kapha Features
  const f_hrLow = avgHr !== null && avgHr < hrRestBase - 5 ? Math.min(1.0, ((hrRestBase - 5) - avgHr) / 15.0) : 0;
  if (f_hrLow > 0.4) aggravating.push('Bradycardic/slow heart rate triggers stable Kapha (Earth/Water) lethargy.');

  const f_sleepLong = totalSleepMinutes > 540 ? Math.min(1.0, (totalSleepMinutes - 540) / 120.0) : 0;
  if (f_sleepLong > 0.4) aggravating.push('Hypersomnia / excessive sleep duration (>9 hrs) matches sluggish Kapha.');

  const f_stepsSedentary = totalSteps < 3000 ? Math.min(1.0, (3000 - totalSteps) / 2000.0) : 0;
  if (f_stepsSedentary > 0.5) aggravating.push('Extremely low step count matches sluggish Kapha immobility.');
  else if (totalSteps > 6000) pacifying.push('Consistent steps and active circulation pacify Kapha earthiness.');

  const f_tasteKapha = tastesProportions.sweet + tastesProportions.sour + tastesProportions.salty;
  if (f_tasteKapha > 0.5) aggravating.push('Heavy, sweet, or cloying tastes logged contributing to Kapha weight.');

  const f_hydrationOver = totalWaterMl > 3500 ? Math.min(1.0, (totalWaterMl - 3500) / 1500.0) : 0;
  if (f_hydrationOver > 0.5) aggravating.push('Excessive daily water intake contributes to Kapha water retention.');

  if (pacifying.length === 0) pacifying.push('Baseline metabolic balance active.');
  if (aggravating.length === 0) aggravating.push('No aggravating anomalies detected.');

  // -------------------------------------------------------------------------
  // 5. Weight Calculation & Normalization
  // -------------------------------------------------------------------------

  // Calculate dynamic deltas
  const deltaVata = (
    WEIGHTS.VATA.hrv * f_hrv +
    WEIGHTS.VATA.tempCold * f_tempCold +
    WEIGHTS.VATA.sleepPoor * f_sleepPoor +
    WEIGHTS.VATA.stepsErratic * f_stepsErratic +
    WEIGHTS.VATA.tasteBitterPungentAstringent * f_tasteVata +
    WEIGHTS.VATA.hydrationLow * f_hydrationLow
  );

  const deltaPitta = (
    WEIGHTS.PITTA.hrRestHigh * f_hrHigh +
    WEIGHTS.PITTA.tempHot * f_tempHot +
    WEIGHTS.PITTA.stepsHigh * f_stepsHigh +
    WEIGHTS.PITTA.tasteSourSaltyPungent * f_tastePitta
  );

  const deltaKapha = (
    WEIGHTS.KAPHA.hrRestLow * f_hrLow +
    WEIGHTS.KAPHA.tempCold * f_tempCold +
    WEIGHTS.KAPHA.sleepLong * f_sleepLong +
    WEIGHTS.KAPHA.stepsSedentary * f_stepsSedentary +
    WEIGHTS.KAPHA.tasteSweetSourSalty * f_tasteKapha +
    WEIGHTS.KAPHA.hydrationOver * f_hydrationOver
  );

  // Compute final scores matching quiz baseline + dynamic deltas
  const scoreVata = baseline.vata + deltaVata * 15.0; // dynamic swing bounded to 15% range
  const scorePitta = baseline.pitta + deltaPitta * 15.0;
  const scoreKapha = baseline.kapha + deltaKapha * 15.0;

  // Softmax normalization
  const totalScore = scoreVata + scorePitta + scoreKapha;
  const pVata = Number(((scoreVata / totalScore) * 100).toFixed(1));
  const pPitta = Number(((scorePitta / totalScore) * 100).toFixed(1));
  const pKapha = Number((100.0 - (pVata + pPitta)).toFixed(1));

  // Run dynamic dosha validation rules
  validateOutputDosha({ vata: pVata, pitta: pPitta, kapha: pKapha });

  // 6. Trend Detection Analyzers
  const trends = await detectDoshaTrends(userId, { vata: pVata, pitta: pPitta, kapha: pKapha });

  const finalState: CalculatedDoshaState = {
    vata: pVata,
    pitta: pPitta,
    kapha: pKapha,
    heartRateAvg: avgHr,
    temperatureAvg: avgTemp,
    stepsCount: totalSteps,
    sleepDurationMinutes: totalSleepMinutes,
    waterIntakeMl: totalWaterMl,
    tasteProfile: tastesCounts,
    explanationSummary: {
      aggravating,
      pacifying
    },
    trendAlert: trends
  };

  // 7. Save calculated dynamic states to database
  const payload: any = {
    user_id: userId,
    date: dateStr,
    vata_percentage: finalState.vata,
    pitta_percentage: finalState.pitta,
    kapha_percentage: finalState.kapha,
    heart_rate_avg: finalState.heartRateAvg,
    temperature_avg: finalState.temperatureAvg,
    steps_count: finalState.stepsCount,
    sleep_duration_minutes: finalState.sleepDurationMinutes,
    water_intake_ml: finalState.waterIntakeMl,
    taste_profile_summary: finalState.tasteProfile,
    explanation_summary: finalState.explanationSummary,
    trend_alert: finalState.trendAlert
  };

  let { error: dbError } = await supabase
    .from('daily_dosha_states')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (dbError) {
    const errMsg = dbError.message || '';
    if (errMsg.includes('explanation_summary') || errMsg.includes('trend_alert')) {
      console.warn('[DoshaEngine] Target Supabase instance is missing the new XAI columns. Retrying without them...');
      // Fallback payload without explanation_summary and trend_alert
      const fallbackPayload = {
        user_id: userId,
        date: dateStr,
        vata_percentage: finalState.vata,
        pitta_percentage: finalState.pitta,
        kapha_percentage: finalState.kapha,
        heart_rate_avg: finalState.heartRateAvg,
        temperature_avg: finalState.temperatureAvg,
        steps_count: finalState.stepsCount,
        sleep_duration_minutes: finalState.sleepDurationMinutes,
        water_intake_ml: finalState.waterIntakeMl,
        taste_profile_summary: finalState.tasteProfile
      };

      const { error: fallbackError } = await supabase
        .from('daily_dosha_states')
        .upsert(fallbackPayload, { onConflict: 'user_id,date' });

      dbError = fallbackError;
    }
  }

  if (dbError) {
    console.error(`[DoshaEngine] Failed to save calculated dosha for ${dateStr}:`, dbError);
    throw dbError;
  }

  console.log(`[DoshaEngine] Dynamic Dosha calculated for user ${userId} on ${dateStr}: Vata:${finalState.vata}% Pitta:${finalState.pitta}% Kapha:${finalState.kapha}%`);

  return finalState;
}

/**
 * Retrieve dynamic dosha records history for trend charts.
 */
export async function getDoshaHistory(userId: string, limit: number = 7): Promise<any[]> {
  const { data, error } = await supabase
    .from('daily_dosha_states')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[DoshaEngine] Failed to fetch dosha history:', error);
    return [];
  }
  return data || [];
}
