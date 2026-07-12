import { supabase } from './supabase';

const WEIGHTS = {
  VATA: {
    hrv: 0.35,
    tempCold: 0.15,
    sleepPoor: 0.20,
    stepsErratic: 0.10,
    tasteBitterPungentAstringent: 0.10,
    hydrationLow: 0.05,
    stressHigh: 0.05
  },
  PITTA: {
    hrRestHigh: 0.30,
    tempHot: 0.30,
    stepsHigh: 0.15,
    tasteSourSaltyPungent: 0.15,
    stressHigh: 0.10
  },
  KAPHA: {
    hrRestLow: 0.30,
    tempCold: 0.15,
    sleepLong: 0.20,
    stepsSedentary: 0.20,
    tasteSweetSourSalty: 0.10,
    hydrationOver: 0.05
  }
};

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

export interface ExplainableFactor {
  name: string;
  value: string;
  impact: { vata: number; pitta: number; kapha: number };
  explanation: string;
}

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
    factors: ExplainableFactor[];
    reasoning: string;
    prediction: {
      tomorrowFollow: { vata: number; pitta: number; kapha: number };
      tomorrowIgnore: { vata: number; pitta: number; kapha: number };
    };
  };
  trendAlert: string;
}

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

export function validateOutputDosha(state: { vata: number; pitta: number; kapha: number }) {
  if (state.vata < 0 || state.pitta < 0 || state.kapha < 0) {
    throw new Error('Computed dosha percentages cannot be negative.');
  }
  const sum = state.vata + state.pitta + state.kapha;
  if (Math.abs(sum - 100.0) > 1.5) {
    throw new Error(`Dynamic dosha percentages must sum to 100%, calculated: ${sum}%`);
  }
}

export async function detectDoshaTrends(
  userId: string,
  current: { vata: number; pitta: number; kapha: number }
): Promise<string> {
  const history = await getDoshaHistory(userId, 5);
  if (history.length < 3) {
    return 'Establishing baseline trend analysis... More daily logs required.';
  }

  const prevVata = history.reduce((sum, r) => sum + Number(r.vata_percentage), 0) / history.length;
  const prevPitta = history.reduce((sum, r) => sum + Number(r.pitta_percentage), 0) / history.length;
  const prevKapha = history.reduce((sum, r) => sum + Number(r.kapha_percentage), 0) / history.length;

  const vataDiff = current.vata - prevVata;
  const pittaDiff = current.pitta - prevPitta;
  const kaphaDiff = current.kapha - prevKapha;

  const trends: string[] = [];
  if (vataDiff > 5) {
    trends.push('Vata is rising (+Air). Grounding practices and hydration recommended.');
  }
  if (pittaDiff > 5) {
    trends.push('Pitta is rising (+Fire). Cooling foods and rest needed.');
  }
  if (kaphaDiff > 5) {
    trends.push('Kapha is rising (+Earth). Dynamic movement and drying warm spices recommended.');
  }

  if (trends.length === 0) {
    return 'Your dynamic bio-elements are steady and in equilibrium relative to your weekly trend.';
  }
  return trends.join(' ');
}

export async function calculateDailyDosha(userId: string, dateStr: string): Promise<CalculatedDoshaState> {
  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999`);
  const dayStart = startOfDay.toISOString();
  const dayEnd = endOfDay.toISOString();

  // 1. Fetch baseline user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('dominant_dosha')
    .eq('id', userId)
    .single();

  const dominantDosha = profile?.dominant_dosha || 'default';
  const baseline = DOSHA_BASELINES[dominantDosha] || DOSHA_BASELINES.default;

  // 2. Fetch daily metrics & lifestyle logs
  const [
    hrResponse,
    tempResponse,
    actResponse,
    sleepResponse,
    waterResponse,
    foodResponse,
    lifeResponse
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
    `).eq('user_id', userId).gte('timestamp', dayStart).lte('timestamp', dayEnd),
    supabase.from('lifestyle').select('stress_level').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
  ]);

  const hrLogs = hrResponse.data || [];
  const tempLogs = tempResponse.data || [];
  const actLogs = actResponse.data || [];
  const sleepLogs = sleepResponse.data || [];
  const waterLogs = waterResponse.data || [];
  const foodLogs = foodResponse.data || [];
  const stressLevel = lifeResponse.data?.stress_level || 'medium';

  // Process core biometric factors
  const hrValues = hrLogs.map(l => l.bpm);
  const avgHr = hrValues.length > 0 ? Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length) : null;
  const hrRestBase = 70;

  let hrvVal = 0;
  if (hrValues.length > 1 && avgHr !== null) {
    const variance = hrValues.reduce((s, v) => s + Math.pow(v - avgHr, 2), 0) / (hrValues.length - 1);
    hrvVal = Math.sqrt(variance);
  }

  const tempValues = tempLogs.map(l => Number(l.temperature_celsius));
  const avgTemp = tempValues.length > 0 ? Number((tempValues.reduce((s, v) => s + v, 0) / tempValues.length).toFixed(1)) : null;
  const tempBase = 36.5;

  const totalSleepMinutes = sleepLogs.reduce((s, l) => s + l.duration_minutes, 0);
  const avgSleepScore = sleepLogs.length > 0 ? sleepLogs.reduce((s, l) => s + l.sleep_score, 0) / sleepLogs.length : 80;

  const totalSteps = actLogs.reduce((s, l) => s + l.steps_count, 0);
  const sedentaryCount = actLogs.filter(l => l.activity_type === 'sedentary').length;
  const activityRatio = actLogs.length > 0 ? (actLogs.length - sedentaryCount) / actLogs.length : 0.5;

  const totalWaterMl = waterLogs.reduce((s, l) => s + l.amount_ml, 0);

  validateInputTelemetry({
    heartRate: avgHr,
    temperature: avgTemp,
    steps: totalSteps,
    sleepMinutes: totalSleepMinutes,
    waterMl: totalWaterMl
  });

  // Nutrition Taste profiles
  const tastesCounts: Record<string, number> = { sweet: 0, sour: 0, salty: 0, bitter: 0, pungent: 0, astringent: 0 };
  foodLogs.forEach((f: any) => {
    const taste = f.nutrition_analysis?.ayurvedic_taste;
    if (taste && taste in tastesCounts) tastesCounts[taste] += 1;
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
  // Explainable Scoring Engine Contribution Tracker
  // -------------------------------------------------------------------------
  const factors: ExplainableFactor[] = [];
  const aggravating: string[] = [];
  const pacifying: string[] = [];

  // 1. Heart Rate (HR & HRV)
  const f_hrv = Math.min(1.0, hrvVal / 15.0);
  const f_hrHigh = avgHr !== null && avgHr > hrRestBase + 5 ? Math.min(1.0, (avgHr - (hrRestBase + 5)) / 15.0) : 0;
  const f_hrLow = avgHr !== null && avgHr < hrRestBase - 5 ? Math.min(1.0, ((hrRestBase - 5) - avgHr) / 15.0) : 0;

  const hrVata = Math.round(f_hrv * WEIGHTS.VATA.hrv * 15 * 10) / 10;
  const hrPitta = Math.round(f_hrHigh * WEIGHTS.PITTA.hrRestHigh * 15 * 10) / 10;
  const hrKapha = Math.round(f_hrLow * WEIGHTS.KAPHA.hrRestLow * 15 * 10) / 10;

  let hrExplanation = 'Heart rate values remain within stable limits.';
  if (hrVata > 1.5) {
    aggravating.push('High HRV variability represents active Vata wind energy in the nervous system.');
    hrExplanation = 'Erratic pulse variations stimulate active Vata wind.';
  }
  if (hrPitta > 1.5) {
    aggravating.push('Elevated heart rates raise Pitta fire and metabolic heat.');
    hrExplanation = 'High resting heart rate triggers heated Pitta element.';
  }
  if (hrKapha > 1.5) {
    aggravating.push('Bradycardic resting pulses match a sluggish, heavy Kapha energy state.');
    hrExplanation = 'Bradycardic rhythm corresponds to heavy, slow Kapha.';
  }

  factors.push({
    name: 'Heart Rate',
    value: avgHr ? `${avgHr} bpm (HRV: ${Math.round(hrvVal)}ms)` : 'No Feed',
    impact: { vata: hrVata, pitta: hrPitta, kapha: hrKapha },
    explanation: hrExplanation
  });

  // 2. Body Temperature
  const f_tempCold = avgTemp !== null && avgTemp < tempBase ? Math.min(1.0, (tempBase - avgTemp) / 1.5) : 0;
  const f_tempHot = avgTemp !== null && avgTemp > tempBase + 0.3 ? Math.min(1.0, (avgTemp - (tempBase + 0.3)) / 1.5) : 0;

  const tempVata = Math.round(f_tempCold * WEIGHTS.VATA.tempCold * 15 * 10) / 10;
  const tempPitta = Math.round(f_tempHot * WEIGHTS.PITTA.tempHot * 15 * 10) / 10;
  const tempKapha = Math.round(f_tempCold * WEIGHTS.KAPHA.tempCold * 15 * 10) / 10;

  let tempExplanation = 'Skin temperature is near baseline.';
  if (tempPitta > 1.5) {
    aggravating.push(`Elevated body temperature (${avgTemp}°C) triggers active Pitta heat.`);
    tempExplanation = 'Elevated skin temperature excites Pitta fire.';
  } else if (tempVata > 1.0) {
    aggravating.push(`Cool skin temperature (${avgTemp}°C) stimulates cold Vata and Kapha.`);
    tempExplanation = 'Cooler skin temperature increases cold Vata and Kapha traits.';
  }

  factors.push({
    name: 'Temperature',
    value: avgTemp ? `${avgTemp} °C` : 'No Feed',
    impact: { vata: tempVata, pitta: tempPitta, kapha: tempKapha },
    explanation: tempExplanation
  });

  // 3. Sleep duration & depth
  const f_sleepPoor = totalSleepMinutes > 0 && totalSleepMinutes < 360 ? Math.min(1.0, (360 - totalSleepMinutes) / 120) : (avgSleepScore < 65 ? 0.5 : 0);
  const f_sleepLong = totalSleepMinutes > 540 ? Math.min(1.0, (totalSleepMinutes - 540) / 120.0) : 0;

  const sleepVata = Math.round(f_sleepPoor * WEIGHTS.VATA.sleepPoor * 15 * 10) / 10;
  const sleepPitta = 0;
  const sleepKapha = Math.round(f_sleepLong * WEIGHTS.KAPHA.sleepLong * 15 * 10) / 10;

  let sleepExplanation = 'Sleep hours are restorative.';
  if (sleepVata > 1.5) {
    aggravating.push('Restless or truncated sleep aggravates Vata hyper-sensitivity.');
    sleepExplanation = 'Insufficient sleep excites nervous Vata properties.';
  } else if (sleepKapha > 1.5) {
    aggravating.push('Hypersomnia or sleeping too long (>9 hrs) stimulates Kapha stagnation.');
    sleepExplanation = 'Excessive sleep duration promotes Kapha lethargy.';
  } else {
    pacifying.push('Consistent, restful sleep cycles maintain elemental equilibrium.');
  }

  factors.push({
    name: 'Sleep',
    value: totalSleepMinutes > 0 ? `${(totalSleepMinutes/60).toFixed(1)} hrs (Score: ${Math.round(avgSleepScore)})` : 'No Log',
    impact: { vata: sleepVata, pitta: sleepPitta, kapha: sleepKapha },
    explanation: sleepExplanation
  });

  // 4. Activity & steps
  const f_stepsErratic = activityRatio > 0.7 && totalSteps > 8000 && totalSteps < 12000 ? 0.6 : 0;
  const f_stepsHigh = totalSteps > 12000 ? Math.min(1.0, (totalSteps - 12000) / 8000.0) : 0;
  const f_stepsSedentary = totalSteps < 3000 ? Math.min(1.0, (3000 - totalSteps) / 2000.0) : 0;

  const actVata = Math.round(f_stepsErratic * WEIGHTS.VATA.stepsErratic * 15 * 10) / 10;
  const actPitta = Math.round(f_stepsHigh * WEIGHTS.PITTA.stepsHigh * 15 * 10) / 10;
  const actKapha = Math.round(f_stepsSedentary * WEIGHTS.KAPHA.stepsSedentary * 15 * 10) / 10;

  let actExplanation = 'Moderate exercise and activity levels achieved.';
  if (actPitta > 1.5) {
    aggravating.push('Heavy physical exertion (>12k steps) excites cardiovascular Pitta fire.');
    actExplanation = 'Excess steps ignite metabolic Pitta heat.';
  } else if (actVata > 1.0) {
    aggravating.push('High, erratic movement patterns trigger active Vata elements.');
    actExplanation = 'Erratic steps excite dry Vata wind.';
  } else if (actKapha > 1.5) {
    aggravating.push('Sedentary logs (<3000 steps) match sluggish Kapha accumulation.');
    actExplanation = 'Sedentary status triggers stagnant Kapha earth.';
  } else {
    pacifying.push('Moderate, regular steps keep Kapha moving and blood circulating.');
  }

  factors.push({
    name: 'Activity',
    value: `${totalSteps.toLocaleString()} steps`,
    impact: { vata: actVata, pitta: actPitta, kapha: actKapha },
    explanation: actExplanation
  });

  // 5. Food taste log proportions
  const f_tasteVata = tastesProportions.bitter + tastesProportions.pungent + tastesProportions.astringent;
  const f_tastePitta = tastesProportions.sour + tastesProportions.salty + tastesProportions.pungent;
  const f_tasteKapha = tastesProportions.sweet + tastesProportions.sour + tastesProportions.salty;

  const foodVata = Math.round(f_tasteVata * WEIGHTS.VATA.tasteBitterPungentAstringent * 15 * 10) / 10;
  const foodPitta = Math.round(f_tastePitta * WEIGHTS.PITTA.tasteSourSaltyPungent * 15 * 10) / 10;
  const foodKapha = Math.round(f_tasteKapha * WEIGHTS.KAPHA.tasteSweetSourSalty * 15 * 10) / 10;

  let foodExplanation = 'Balanced tastes consumed.';
  if (foodVata > 1.0) {
    aggravating.push('Bitter, spicy, or astringent tastes dry up tissues, increasing Vata.');
    foodExplanation = 'Drying tastes logged trigger Vata dryness.';
  }
  if (foodPitta > 1.0) {
    aggravating.push('Sour, salty, or spicy food choices excite stomach acidity and Pitta heat.');
    foodExplanation = 'Sour/spicy properties logged increase Pitta heat.';
  }
  if (foodKapha > 1.0) {
    aggravating.push('Heavy, sweet, or salty foods encourage fluid retention and Kapha density.');
    foodExplanation = 'Heavy sweet tastes excite Kapha earth.';
  }

  factors.push({
    name: 'Food',
    value: totalTasteLogs > 0 ? `${totalTasteLogs} meals logged` : 'No Meals',
    impact: { vata: foodVata, pitta: foodPitta, kapha: foodKapha },
    explanation: foodExplanation
  });

  // 6. Hydration
  const f_hydrationLow = totalWaterMl > 0 && totalWaterMl < 1500 ? Math.min(1.0, (1500 - totalWaterMl) / 1000) : 0;
  const f_hydrationOver = totalWaterMl > 3500 ? Math.min(1.0, (totalWaterMl - 3500) / 1500.0) : 0;

  const hydVata = Math.round(f_hydrationLow * WEIGHTS.VATA.hydrationLow * 15 * 10) / 10;
  const hydPitta = 0;
  const hydKapha = Math.round(f_hydrationOver * WEIGHTS.KAPHA.hydrationOver * 15 * 10) / 10;

  let hydExplanation = 'Water levels are within balanced bounds.';
  if (hydVata > 0.5) {
    aggravating.push('Low hydration intake (<1500ml) encourages dry Vata attributes.');
    hydExplanation = 'Inadequate hydration raises Vata dryness.';
  } else if (hydKapha > 0.5) {
    aggravating.push('Excessive water intake (>3500ml) causes liquid Kapha retention.');
    hydExplanation = 'Over-hydration may trigger heavy Kapha fluids.';
  } else {
    pacifying.push('Consistent water drinking pacifies Vata dryness.');
  }

  factors.push({
    name: 'Hydration',
    value: `${totalWaterMl} ml`,
    impact: { vata: hydVata, pitta: hydPitta, kapha: hydKapha },
    explanation: hydExplanation
  });

  // 7. Psychological Stress
  const f_stressHigh = stressLevel === 'high' ? 1.0 : stressLevel === 'medium' ? 0.4 : 0.0;
  
  const stressVata = Math.round(f_stressHigh * WEIGHTS.VATA.stressHigh * 15 * 10) / 10;
  const stressPitta = Math.round(f_stressHigh * WEIGHTS.PITTA.stressHigh * 15 * 10) / 10;
  const stressKapha = 0;

  let stressExplanation = 'Stress index is low and restorative.';
  if (stressLevel === 'high') {
    aggravating.push('High psychological stress levels trigger neurological Vata and hot Pitta.');
    stressExplanation = 'High stress excites nervous Vata and irritable Pitta.';
  } else if (stressLevel === 'medium') {
    stressExplanation = 'Moderate mental stress limits recovery rates.';
  } else {
    pacifying.push('Calm stress markers pacify hyper-reactive Vata and Pitta.');
  }

  factors.push({
    name: 'Stress',
    value: stressLevel.toUpperCase(),
    impact: { vata: stressVata, pitta: stressPitta, kapha: stressKapha },
    explanation: stressExplanation
  });

  if (pacifying.length === 0) pacifying.push('Baseline metabolic balance active.');
  if (aggravating.length === 0) aggravating.push('No aggravating anomalies detected.');

  // Calculate final dynamic percentages
  const deltaVata = hrVata + tempVata + sleepVata + actVata + foodVata + hydVata + stressVata;
  const deltaPitta = hrPitta + tempPitta + sleepPitta + actPitta + foodPitta + hydPitta + stressPitta;
  const deltaKapha = hrKapha + tempKapha + sleepKapha + actKapha + foodKapha + hydKapha + stressKapha;

  const scoreVata = baseline.vata + deltaVata;
  const scorePitta = baseline.pitta + deltaPitta;
  const scoreKapha = baseline.kapha + deltaKapha;

  const totalScore = scoreVata + scorePitta + scoreKapha;
  const pVata = Number(((scoreVata / totalScore) * 100).toFixed(1));
  const pPitta = Number(((scorePitta / totalScore) * 100).toFixed(1));
  const pKapha = Number((100.0 - (pVata + pPitta)).toFixed(1));

  validateOutputDosha({ vata: pVata, pitta: pPitta, kapha: pKapha });

  // 8. Tomorrow's Predictions
  // Follow recommendations tomorrow (calming breathing + proper meals + water)
  const tomorrowVataFollow = Math.round(Math.max(15, pVata - 4));
  const tomorrowPittaFollow = Math.round(Math.max(15, pPitta - 3));
  const tomorrowKaphaFollow = Math.round(100 - (tomorrowVataFollow + tomorrowPittaFollow));

  // Ignore recommendations tomorrow (late sleep + spicy food + stress)
  const tomorrowVataIgnore = Math.round(Math.min(60, pVata + 4));
  const tomorrowPittaIgnore = Math.round(Math.min(60, pPitta + 3));
  const tomorrowKaphaIgnore = Math.round(100 - (tomorrowVataIgnore + tomorrowPittaIgnore));

  // Build Diagnostic Reasoning text
  let reasoning = 'Your bio-elements are in a state of stable homeostatic equilibrium.';
  const maxPerc = Math.max(pVata, pPitta, pKapha);
  if (maxPerc === pVata && pVata > 35) {
    reasoning = 'Active Vata wind energy is currently elevated. This is primarily influenced by lighter sleep records and lower hydration levels logged today.';
  } else if (maxPerc === pPitta && pPitta > 35) {
    reasoning = 'Active Pitta fire is currently elevated. This is driven by elevated skin temperatures and a higher resting heart rate baseline.';
  } else if (maxPerc === pKapha && pKapha > 35) {
    reasoning = 'Active Kapha earth energy is currently elevated, reflecting sluggish circulation. This is correlated with a highly sedentary day or excessive sleep.';
  }

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
      pacifying,
      factors,
      reasoning,
      prediction: {
        tomorrowFollow: { vata: tomorrowVataFollow, pitta: tomorrowPittaFollow, kapha: tomorrowKaphaFollow },
        tomorrowIgnore: { vata: tomorrowVataIgnore, pitta: tomorrowPittaIgnore, kapha: tomorrowKaphaIgnore }
      }
    },
    trendAlert: trends
  };

  // Upsert to DB
  const payload = {
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
      console.warn('[DoshaEngine] Retrying without new explanation columns...');
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
    console.error(`[DoshaEngine] Save failed for ${dateStr}:`, dbError);
    throw dbError;
  }

  return finalState;
}

export async function getDoshaHistory(userId: string, limit: number = 7): Promise<any[]> {
  const { data, error } = await supabase
    .from('daily_dosha_states')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[DoshaEngine] Fetch history failed:', error);
    return [];
  }
  return data || [];
}
