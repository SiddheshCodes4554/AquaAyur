export interface ExplanationContext {
  recommendationTitle: string;
  sensorDataUsed: string[];
  foodLogs: string[];
  dosha: string;
  agni: string;
  scientificReasoning: string;
  ayurvedicReasoning: string;
}

/**
 * Dynamically generates a customized explanation context for any recommendation.
 */
export function getExplanationForRecommendation(
  title: string,
  biometrics: { heartRate: number; temperature: number; steps: number; activity: string } | null,
  doshaState: { vata: number; pitta: number; kapha: number } | null,
  agniScore: number,
  ojasScore: number
): ExplanationContext {
  const currentHR = biometrics?.heartRate || 72;
  const currentTemp = biometrics?.temperature || 36.5;
  const currentSteps = biometrics?.steps || 4200;
  const currentActivity = biometrics?.activity || 'resting';

  const vataPct = Math.round(doshaState?.vata || 33);
  const pittaPct = Math.round(doshaState?.pitta || 33);
  const kaphaPct = Math.round(doshaState?.kapha || 34);

  // Baseline variables
  const sensorDataUsed = [
    `Heart Rate: ${currentHR} bpm`,
    `Skin Temp: ${currentTemp}°C`,
    `Steps logged: ${currentSteps}`
  ];
  const foodLogs = ['No recent heavy tastes logged today.'];
  const dosha = `Vata: ${vataPct}% | Pitta: ${pittaPct}% | Kapha: ${kaphaPct}%`;
  const agni = `Metabolic Core: ${agniScore}%`;

  const normalizedTitle = title.toLowerCase();

  // 1. Ushapan (Morning Hydration)
  if (normalizedTitle.includes('ushapan') || normalizedTitle.includes('hydration') || normalizedTitle.includes('water')) {
    return {
      recommendationTitle: 'Ushapan (Morning Hydration)',
      sensorDataUsed: [
        ...sensorDataUsed,
        `Activity Context: ${currentActivity.toUpperCase()}`
      ],
      foodLogs: ['First hydration event of the morning.'],
      dosha,
      agni,
      scientificReasoning: 'Water consumption on an empty stomach stimulates the gastrocolic reflex, which clears colon residues. It rehydrates cellular tissues depleted during sleep, supporting plasma volume and renal filtration.',
      ayurvedicReasoning: 'Morning hydration washes away metabolic waste (Ama) accumulated overnight. Warm water kindles the digestive spark (Agni) without extinguishment, balancing Vata dryness and cooling excess Pitta fire.'
    };
  }

  // 2. Exercise Timing / Pitta-Pacifying Yoga / Walks
  if (normalizedTitle.includes('yoga') || normalizedTitle.includes('exercise') || normalizedTitle.includes('walk') || normalizedTitle.includes('activity')) {
    return {
      recommendationTitle: title,
      sensorDataUsed: [
        ...sensorDataUsed,
        `Daily Steps: ${currentSteps}/10000`
      ],
      foodLogs,
      dosha,
      agni,
      scientificReasoning: 'Moderate intensity movement improves cardiovascular efficiency, lowers resting pulse rate, increases HRV (parasympathetic dominance), and decreases serum cortisol levels to alleviate physical stress.',
      ayurvedicReasoning: 'Daily Vyayama (exercise) increases peripheral circulation, ignites cellular tissue Agni, and expels heavy Kapha lethargy. By exercising during Vata/Kapha hours, you protect Pitta from overheating.'
    };
  }

  // 3. Evening Nadi Shodhana / Breathing / Wind down
  if (normalizedTitle.includes('nadi shodhana') || normalizedTitle.includes('breathing') || normalizedTitle.includes('sleep') || normalizedTitle.includes('wind down')) {
    return {
      recommendationTitle: 'Evening Nadi Shodhana',
      sensorDataUsed: [
        `Resting Heart Rate: ${currentHR} bpm`,
        `Stress Index: ${currentHR > 80 ? 'Elevated' : 'Balanced'}`
      ],
      foodLogs,
      dosha,
      agni,
      scientificReasoning: 'Alternate nostril breathing stimulates the vagus nerve, which decreases heart rate and blood pressure, shifting the autonomic nervous system from sympathetic flight to parasympathetic rest.',
      ayurvedicReasoning: 'Breathing exercises pacify dynamic Vata wind (Prana and Vyana Vayu), calming the mind (Sadhaka Pitta) and grounding the nervous system before sleep, which directly builds and preserves protective Ojas.'
    };
  }

  // 4. Agni Metabolic recommendations
  if (normalizedTitle.includes('diet') || normalizedTitle.includes('spice') || normalizedTitle.includes('meal') || normalizedTitle.includes('metabolic')) {
    return {
      recommendationTitle: title,
      sensorDataUsed,
      foodLogs: ['Logged meal intervals: 4.5 hours'],
      dosha,
      agni,
      scientificReasoning: 'Spacing meal intervals by 4-5 hours allows blood glucose and insulin levels to normalize. Incorporating digestive enzymes and thermogenic spices (like ginger) increases metabolic efficiency.',
      ayurvedicReasoning: 'Irregular meal intervals cause Agni to burn erratically (Vishamagni). Warming, fresh, and slightly spiced foods stimulate digestive juices (Pachaka Pitta), preventing the formation of toxins (Ama).'
    };
  }

  // Default Fallback
  return {
    recommendationTitle: title,
    sensorDataUsed,
    foodLogs,
    dosha,
    agni,
    scientificReasoning: 'Consistently following regular daily biological schedules (circadian rhythms) optimizes hormonal secretion, stabilizes metabolic enzymes, and improves overall heart rate recovery.',
    ayurvedicReasoning: 'Following Dinacharya (daily routine) grounds Vata, regulates the metabolic spark of Pitta, and maintains Kapha structure, preserving the integrity of all bodily tissues and keeping Ojas strong.'
  };
}
