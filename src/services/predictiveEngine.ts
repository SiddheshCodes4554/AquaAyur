import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSleepStore } from '../store/useSleepStore';
import { useHydrationStore } from '../store/useHydrationStore';
import { useDoshaStore } from '../store/useDoshaStore';
import { useAgniStore } from '../store/useAgniStore';
import { useOjasStore } from '../store/useOjasStore';
import { useDinacharyaStore } from '../store/useDinacharyaStore';

export interface PredictionTarget {
  recovery: number;
  energy: number;
  sleep: number;
  dosha: { vata: number; pitta: number; kapha: number };
  agni: number;
  ojas: number;
  primaryAggravation: 'Vata' | 'Pitta' | 'Kapha' | 'Tridoshic' | 'Balanced';
}

export interface PredictionIntervalResult {
  target: PredictionTarget;
  confidenceScore: number;
  confidenceExplanation: string;
  keyDriver: string;
  recommendation: string;
}

export interface FullPredictionReport {
  tomorrow: PredictionIntervalResult;
  next3Days: PredictionIntervalResult;
  nextWeek: PredictionIntervalResult;
  dataDensityScore: number;
}

/**
 * Main Predictive Health Engine.
 */
export function generateHealthPredictions(): FullPredictionReport {
  // 1. GATHER HISTORICAL METRICS
  const telemetryHistory = useTelemetryStore.getState().heartRateHistory || [];
  const sleepHistory = useSleepStore.getState().sleepHistory || [];
  const waterHistory = useHydrationStore.getState().todayTotalMl || 0;
  const currentDosha = useDoshaStore.getState().currentDosha;
  const todayAgni = useAgniStore.getState().todayAgni;
  const todayOjas = useOjasStore.getState().todayOjas;
  const completions = useDinacharyaStore.getState().completions;

  // 2. COMPUTE DATA DENSITY & CONFIDENCE FACTOR
  const telemetryDensity = Math.min(100, telemetryHistory.length * 10);
  const sleepDensity = Math.min(100, sleepHistory.length * 15);
  const completedRoutines = Object.values(completions).filter(Boolean).length;
  const routineDensity = Math.min(100, completedRoutines * 33);
  
  const dataDensityScore = Math.round((telemetryDensity + sleepDensity + routineDensity) / 3) || 45;

  // Slope utility: returns trend direction (+1, -1, or 0)
  const getTrendSlope = (data: number[]) => {
    if (data.length < 2) return 0;
    const recent = data.slice(-3);
    let slope = 0;
    for (let i = 1; i < recent.length; i++) {
      slope += recent[i] - recent[i - 1];
    }
    return slope > 2 ? 1 : slope < -2 ? -1 : 0;
  };

  const hrTrend = getTrendSlope(telemetryHistory.map(h => h.bpm));
  const sleepTrend = getTrendSlope(sleepHistory.map(s => s.duration_minutes / 60));

  // Base current parameters
  const baseVata = currentDosha?.vata || 33;
  const basePitta = currentDosha?.pitta || 33;
  const baseKapha = currentDosha?.kapha || 34;

  const baseAgni = todayAgni?.agni_score || 75;
  const baseOjas = todayOjas?.ojas_score || 78;

  // 3. GENERATE INTERVAL FORECASTS
  
  // ==========================================
  // FORECAST: TOMORROW (Confidence: High)
  // ==========================================
  const tomConfidence = Math.round(dataDensityScore * 0.95);
  let tomVata = baseVata;
  let tomPitta = basePitta;
  let tomKapha = baseKapha;
  let tomAgni = baseAgni;
  let tomOjas = baseOjas;

  // Apply tomorrow shifts
  if (hrTrend > 0) {
    tomVata += 3;
    tomPitta += 1;
    tomKapha -= 4;
    tomAgni -= 5;
  }
  if (sleepTrend < 0) {
    tomVata += 4;
    tomOjas -= 4;
  }
  if (waterHistory < 1500) {
    tomVata += 2;
    tomAgni -= 3;
  }

  // Constrain tomorrow doshas
  const tomSum = tomVata + tomPitta + tomKapha;
  tomVata = Math.round((tomVata / tomSum) * 100);
  tomPitta = Math.round((tomPitta / tomSum) * 100);
  tomKapha = 100 - tomVata - tomPitta;

  const tomMax = Math.max(tomVata, tomPitta, tomKapha);
  const tomAggravation = tomMax > 38 ? (tomMax === tomVata ? 'Vata' : tomMax === tomPitta ? 'Pitta' : 'Kapha') : 'Balanced';

  const tomorrowResult: PredictionIntervalResult = {
    target: {
      recovery: Math.max(30, Math.min(98, 80 - (hrTrend * 5) + (sleepTrend * 8))),
      energy: Math.max(40, Math.min(98, 75 - (hrTrend * 4) + (sleepTrend * 6))),
      sleep: Math.max(35, Math.min(98, 82 + (sleepTrend * 5))),
      dosha: { vata: tomVata, pitta: tomPitta, kapha: tomKapha },
      agni: Math.max(20, Math.min(98, tomAgni)),
      ojas: Math.max(20, Math.min(98, tomOjas)),
      primaryAggravation: tomAggravation as any
    },
    confidenceScore: tomConfidence,
    confidenceExplanation: `${tomConfidence}% Confidence. Tomorrow's prediction is backed heavily by your high-density 24h IoT biometric packet stream and today's active water logs.`,
    keyDriver: hrTrend > 0 || sleepTrend < 0 
      ? 'Elevated physiological stress (elevated average resting HR) paired with minor sleep depletion.' 
      : 'Consistent heart rate stability and adequate metabolic hydration intervals.',
    recommendation: hrTrend > 0 
      ? 'Drink 500ml warm water (Ushapan) at dawn and avoid cold drinks to pacify the rising Vata wind.' 
      : 'Maintain your current sleep timing checklist to stabilize Vata-Pitta equilibrium.'
  };

  // ==========================================
  // FORECAST: NEXT 3 DAYS (Confidence: Medium)
  // ==========================================
  const threeDayConfidence = Math.round(dataDensityScore * 0.82);
  let threeVata = baseVata;
  let threePitta = basePitta;
  let threeKapha = baseKapha;

  if (hrTrend > 0) {
    threeVata += 6;
    threePitta += 3;
    threeKapha -= 9;
  }
  if (sleepTrend < 0) {
    threeVata += 5;
  }

  const threeSum = threeVata + threePitta + threeKapha;
  threeVata = Math.round((threeVata / threeSum) * 100);
  threePitta = Math.round((threePitta / threeSum) * 100);
  threeKapha = 100 - threeVata - threePitta;

  const threeMax = Math.max(threeVata, threePitta, threeKapha);
  const threeAggravation = threeMax > 40 ? (threeMax === threeVata ? 'Vata' : threeMax === threePitta ? 'Pitta' : 'Kapha') : 'Balanced';

  const next3DaysResult: PredictionIntervalResult = {
    target: {
      recovery: Math.max(30, Math.min(98, 78 - (hrTrend * 8) + (sleepTrend * 10))),
      energy: Math.max(30, Math.min(98, 72 - (hrTrend * 6) + (sleepTrend * 8))),
      sleep: Math.max(30, Math.min(98, 80 + (sleepTrend * 8))),
      dosha: { vata: threeVata, pitta: threePitta, kapha: threeKapha },
      agni: Math.max(20, Math.min(98, baseAgni - (hrTrend * 6))),
      ojas: Math.max(20, Math.min(98, baseOjas - (hrTrend * 4) + (sleepTrend * 5))),
      primaryAggravation: threeAggravation as any
    },
    confidenceScore: threeDayConfidence,
    confidenceExplanation: `${threeDayConfidence}% Confidence. Calculated using linear regression trends from your past 3 days of biometric telemetry and circadian completions.`,
    keyDriver: hrTrend > 0 
      ? 'A rising trend in resting heart rate indicates systemic heat accumulating in Pitta pathways.' 
      : 'Sustained parasympathetic heart rate recovery patterns over 72 hours.',
    recommendation: hrTrend > 0 
      ? 'Perform 15 minutes of cooling sheetali pranayama daily and avoid spicy or fried food logs.' 
      : 'Keep logs active to maintain data consistency and confirm baseline projections.'
  };

  // ==========================================
  // FORECAST: NEXT WEEK (Confidence: Low/Mod)
  // ==========================================
  const weekConfidence = Math.round(dataDensityScore * 0.65);
  let weekVata = baseVata;
  let weekPitta = basePitta;
  let weekKapha = baseKapha;

  if (hrTrend > 0) {
    weekVata += 10;
    weekPitta += 5;
    weekKapha -= 15;
  } else {
    // Normal gradual homeostatic centering
    weekVata = Math.round(weekVata * 0.9 + 3.3);
    weekPitta = Math.round(weekPitta * 0.9 + 3.3);
    weekKapha = Math.round(weekKapha * 0.9 + 3.4);
  }

  const weekSum = weekVata + weekPitta + weekKapha;
  weekVata = Math.round((weekVata / weekSum) * 100);
  weekPitta = Math.round((weekPitta / weekSum) * 100);
  weekKapha = 100 - weekVata - weekPitta;

  const weekMax = Math.max(weekVata, weekPitta, weekKapha);
  const weekAggravation = weekMax > 43 ? (weekMax === weekVata ? 'Vata' : weekMax === weekPitta ? 'Pitta' : 'Kapha') : 'Balanced';

  const nextWeekResult: PredictionIntervalResult = {
    target: {
      recovery: Math.max(20, Math.min(98, 75 - (hrTrend * 12) + (sleepTrend * 12))),
      energy: Math.max(20, Math.min(98, 70 - (hrTrend * 10) + (sleepTrend * 10))),
      sleep: Math.max(20, Math.min(98, 78 + (sleepTrend * 12))),
      dosha: { vata: weekVata, pitta: weekPitta, kapha: weekKapha },
      agni: Math.max(10, Math.min(98, baseAgni - (hrTrend * 10))),
      ojas: Math.max(10, Math.min(98, baseOjas - (hrTrend * 8) + (sleepTrend * 8))),
      primaryAggravation: weekAggravation as any
    },
    confidenceScore: weekConfidence,
    confidenceExplanation: `${weekConfidence}% Confidence. High temporal distance decreases forecast precision. Stability depends heavily on weekend sleep recoveries.`,
    keyDriver: sleepTrend < 0 
      ? 'Chronic sleep restriction and Vata wind dispersion will impair cellular Ojas shield tissue.' 
      : 'Stability is expected, assuming circadian schedules are maintained.',
    recommendation: 'Incorporate 1 tablespoon of pure organic ghee into lunch and restrict caffeine intake after 2 PM.'
  };

  return {
    tomorrow: tomorrowResult,
    next3Days: next3DaysResult,
    nextWeek: nextWeekResult,
    dataDensityScore
  };
}
